import fs from 'fs'
import path from 'path'
import { exec, execSync, spawn } from 'child_process'
import { sanitizeAndBrandGameFolder } from './studioSanitizer.js'

// In-memory registry untuk memantau status instalasi yang sedang berjalan
const activeSessions = new Map()

/**
 * Deteksi apakah sebuah folder game memiliki file installer/ISO dan apakah ada folder update yang berpasangan
 */
export function detectGameInstallSetup(uploadDir, folderName) {
  const fullPath = path.join(uploadDir, folderName)
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    return null
  }

  // 1. Cari file ISO atau setup installer di folder game ini
  let isoPath = null
  let setupExePath = null
  const files = fs.readdirSync(fullPath)

  for (const f of files) {
    const p = path.join(fullPath, f)
    try {
      const st = fs.statSync(p)
      if (st.isFile()) {
        const lower = f.toLowerCase()
        if (lower.endsWith('.iso')) {
          isoPath = p
        } else if (lower === 'setup.exe' || (lower.startsWith('setup') && lower.endsWith('.exe'))) {
          setupExePath = p
        }
      }
    } catch (_) {}
  }

  // Bersihkan nama untuk calon folder game matang (Installed Game)
  const cleanTitle = folderName
    .replace(/[-_.](MULTi\d+|ElAmigos|CODEX|RUNE|TENOKE|FitGirl|DODI|Repack|SKIDROW|FLT|GoldBerg)/gi, '')
    .replace(/[._]/g, ' ')
    .trim()

  const suggestedTargetPath = path.join(uploadDir, cleanTitle)

  // 2. Cari apakah ada folder Update yang berpasangan di Upload Directory
  let updateFolder = null
  let updateExePath = null

  try {
    const allFolders = fs.readdirSync(uploadDir)
    const basePrefix = cleanTitle.toLowerCase().split(' ')[0] // kata pertama (misal: "mouse")

    for (const other of allFolders) {
      if (other === folderName) continue
      const otherLower = other.toLowerCase()
      if (
        (otherLower.includes('update') || otherLower.includes('patch')) &&
        otherLower.includes(basePrefix)
      ) {
        const otherFull = path.join(uploadDir, other)
        try {
          if (fs.statSync(otherFull).isDirectory()) {
            const updateFiles = fs.readdirSync(otherFull)
            for (const uf of updateFiles) {
              if (uf.toLowerCase().endsWith('.exe')) {
                updateFolder = other
                updateExePath = path.join(otherFull, uf)
                break
              }
            }
            if (updateFolder) break
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return {
    folderName,
    fullPath,
    cleanTitle,
    suggestedTargetPath,
    hasIso: !!isoPath,
    isoPath,
    hasSetupExe: !!setupExePath,
    setupExePath,
    hasUpdate: !!updateFolder,
    updateFolder,
    updateExePath,
    isInstallerPackage: !!isoPath || !!setupExePath
  }
}

/**
 * Mount file ISO menggunakan Win32 PowerShell Native
 */
export function mountIsoImage(isoPath) {
  if (!fs.existsSync(isoPath)) {
    throw new Error(`Berkas ISO tidak ditemukan: ${isoPath}`)
  }

  const psCmd = `powershell -NoProfile -Command "(Mount-DiskImage -ImagePath '${isoPath.replace(/'/g, "''")}' -PassThru | Get-Volume).DriveLetter"`
  const driveLetter = execSync(psCmd, { encoding: 'utf-8', timeout: 15000 }).trim()

  if (!driveLetter) {
    throw new Error('Gagal me-mount ISO: Tidak ada Drive Letter virtual yang diperoleh.')
  }

  // Cari setup.exe di virtual drive
  const driveRoot = `${driveLetter}:\\`
  let setupExePath = null
  try {
    const items = fs.readdirSync(driveRoot)
    for (const item of items) {
      if (item.toLowerCase() === 'setup.exe' || item.toLowerCase().endsWith('.exe')) {
        setupExePath = path.join(driveRoot, item)
        if (item.toLowerCase() === 'setup.exe') break
      }
    }
  } catch (_) {}

  return {
    driveLetter,
    driveRoot,
    setupExePath
  }
}

/**
 * Dismount file ISO virtual
 */
export function dismountIsoImage(isoPath) {
  try {
    const psCmd = `powershell -NoProfile -Command "Dismount-DiskImage -ImagePath '${isoPath.replace(/'/g, "''")}'"`
    execSync(psCmd, { encoding: 'utf-8', timeout: 15000 })
    return true
  } catch (err) {
    console.warn(`[Installer] Peringatan saat dismount ISO: ${err.message}`)
    return false
  }
}

/**
 * Luncurkan Installer (Setup Game atau Update) dengan target folder yang sudah diset
 */
export function launchGameSetup({ exePath, targetDir, silent = false, sessionId }) {
  if (!fs.existsSync(exePath)) {
    throw new Error(`Executable installer tidak ditemukan di: ${exePath}`)
  }

  // Pastikan target directory sudah ada
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const args = [`/DIR=${targetDir}`]
  if (silent) {
    args.push('/SILENT', '/NORESTART', '/SP-')
  }

  // Spawn installer sebagai detached process agar tidak memblokir server
  const child = spawn(exePath, args, {
    detached: true,
    stdio: 'ignore'
  })

  const session = {
    sessionId: sessionId || `inst_${Date.now()}`,
    exePath,
    targetDir,
    pid: child.pid,
    status: 'running',
    startedAt: Date.now(),
    completedAt: null,
    exitCode: null
  }

  child.on('exit', (code) => {
    session.status = 'completed'
    session.completedAt = Date.now()
    session.exitCode = code
  })

  child.on('error', (err) => {
    session.status = 'error'
    session.error = err.message
  })

  child.unref()
  activeSessions.set(session.sessionId, session)

  return session
}

/**
 * Cek status proses installer berdasarkan session ID atau PID
 */
export function getInstallerSession(sessionId) {
  const session = activeSessions.get(sessionId)
  if (!session) return null

  // Cek apakah proses masih aktif di Windows jika status belum completed
  if (session.status === 'running' && session.pid) {
    try {
      execSync(`powershell -NoProfile -Command "Get-Process -Id ${session.pid} | Select-Object -ExpandProperty Id"`, {
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 2000
      })
      // Proses masih berjalan
    } catch (_) {
      // Proses sudah tidak ada di tasklist, berarti sudah selesai
      session.status = 'completed'
      session.completedAt = Date.now()
    }
  }

  return session
}

/**
 * Bersihkan file instalasi mentah setelah sukses dan terapkan branding Direct Play
 */
export function finalizePreInstalledGame({
  targetDir,
  rawBaseFolder,
  rawUpdateFolder,
  isoPath,
  cleanTitle
}) {
  // 1. Dismount ISO jika ada
  if (isoPath) {
    dismountIsoImage(isoPath)
  }

  // 2. Pastikan target directory memiliki isi (tidak kosong)
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target folder game tidak ditemukan: ${targetDir}`)
  }

  const targetFiles = fs.readdirSync(targetDir)
  if (targetFiles.length === 0) {
    throw new Error('Instalasi gagal atau dibatalkan: Folder target kosong!')
  }

  // 3. Hapus uninstaller bawaan (unins000.exe & unins000.dat) agar game murni portable
  for (const f of targetFiles) {
    const l = f.toLowerCase()
    if (l.startsWith('unins000') || l.startsWith('uninstall')) {
      try {
        fs.unlinkSync(path.join(targetDir, f))
      } catch (_) {}
    }
  }

  // 4. Hapus folder mentah Base Game (ISO / Setup mentah)
  if (rawBaseFolder && fs.existsSync(rawBaseFolder) && rawBaseFolder.toLowerCase() !== targetDir.toLowerCase()) {
    try {
      fs.rmSync(rawBaseFolder, { recursive: true, force: true })
    } catch (err) {
      console.warn(`[Finalize] Gagal menghapus rawBaseFolder: ${err.message}`)
    }
  }

  // 5. Hapus folder mentah Update Patch
  if (rawUpdateFolder && fs.existsSync(rawUpdateFolder) && rawUpdateFolder.toLowerCase() !== targetDir.toLowerCase()) {
    try {
      fs.rmSync(rawUpdateFolder, { recursive: true, force: true })
    } catch (err) {
      console.warn(`[Finalize] Gagal menghapus rawUpdateFolder: ${err.message}`)
    }
  }

  // 6. Jalankan Sanitizer & Injeksi Branding Resmi MyGameON
  const sanitized = sanitizeAndBrandGameFolder(targetDir, cleanTitle)

  return {
    success: true,
    targetDir,
    gameTitle: cleanTitle,
    sanitized
  }
}
