import fs from 'fs'
import path from 'path'
import { exec, execSync, spawn } from 'child_process'
import { sanitizeAndBrandGameFolder } from './studioSanitizer.js'
import { cleanReleaseName } from './utils.js'

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
  const cleanTitle = cleanReleaseName(folderName)

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
 * Suntikkan Username ke seluruh file konfigurasi emulator game (Steam, Goldberg, Codex, Rune, FLT, ALI213, dll)
 */
export function injectEmulatorUsername(gameDir, userName = 'mygameon') {
  if (!fs.existsSync(gameDir)) return

  const EMULATOR_FILES = [
    'steam_emu.ini',
    'steam_api.ini',
    'steam_api64.ini',
    'RUNE.ini',
    'CODEX.ini',
    'flt.ini',
    'hlm.ini',
    'ALI213.ini',
    'settings.ini'
  ]

  function scanAndPatch(currentDir) {
    try {
      const items = fs.readdirSync(currentDir)
      for (const item of items) {
        const full = path.join(currentDir, item)
        const stat = fs.statSync(full)
        if (stat.isDirectory()) {
          // Khusus folder steam_settings (Goldberg / Steam Emu)
          if (item.toLowerCase() === 'steam_settings') {
            try {
              const forceAccountFile = path.join(full, 'force_account_name.txt')
              fs.writeFileSync(forceAccountFile, `${userName}\n`, 'utf-8')
            } catch (_) {}
          }
          scanAndPatch(full)
        } else if (stat.isFile()) {
          const lower = item.toLowerCase()
          if (EMULATOR_FILES.some((ef) => lower === ef.toLowerCase()) || lower.endsWith('.ini')) {
            try {
              let content = fs.readFileSync(full, 'utf-8')
              let modified = false

              // Ganti UserName=... atau PlayerName=... atau AccountId=...
              if (/UserName\s*=/i.test(content)) {
                content = content.replace(/(UserName\s*=\s*)(.*)/gi, `$1${userName}`)
                modified = true
              }
              if (/PlayerName\s*=/i.test(content)) {
                content = content.replace(/(PlayerName\s*=\s*)(.*)/gi, `$1${userName}`)
                modified = true
              }
              if (/PersonaName\s*=/i.test(content)) {
                content = content.replace(/(PersonaName\s*=\s*)(.*)/gi, `$1${userName}`)
                modified = true
              }
              if (/account_name\s*=/i.test(content)) {
                content = content.replace(/(account_name\s*=\s*)(.*)/gi, `$1${userName}`)
                modified = true
              }

              if (modified) {
                fs.writeFileSync(full, content, 'utf-8')
              }
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }

  scanAndPatch(gameDir)
}

/**
 * Bersihkan shortcut desktop dan start menu yang mungkin dibuat oleh installer
 */
export function cleanDesktopShortcuts(gameTitle) {
  const possibleDirs = []
  if (process.env.USERPROFILE) {
    possibleDirs.push(path.join(process.env.USERPROFILE, 'Desktop'))
    possibleDirs.push(path.join(process.env.USERPROFILE, 'OneDrive', 'Desktop'))
  }
  if (process.env.PUBLIC) {
    possibleDirs.push(path.join(process.env.PUBLIC, 'Desktop'))
  }
  if (process.env['OneDriveConsumer']) {
    possibleDirs.push(path.join(process.env['OneDriveConsumer'], 'Desktop'))
  }

  const cleanLower = gameTitle.toLowerCase()
  const words = cleanLower.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 2)

  for (const deskDir of possibleDirs) {
    if (!fs.existsSync(deskDir)) continue
    try {
      const files = fs.readdirSync(deskDir)
      for (const f of files) {
        if (!f.toLowerCase().endsWith('.lnk')) continue
        const fileLower = f.toLowerCase()
        const matchTitle = fileLower.includes(cleanLower)
        const matchWord = words.length > 0 && words.some((w) => fileLower.includes(w))
        if (matchTitle || matchWord) {
          try {
            const st = fs.statSync(path.join(deskDir, f))
            const ageMs = Date.now() - Math.max(st.mtimeMs, st.birthtimeMs)
            if (ageMs < 3600000 || matchTitle) {
              fs.unlinkSync(path.join(deskDir, f))
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }
}

/**
 * Luncurkan Installer (Setup Game atau Update) dengan target folder yang sudah diset
 */
export function launchGameSetup({ exePath, targetDir, silent = false, sessionId, userName = 'mygameon' }) {
  if (!fs.existsSync(exePath)) {
    throw new Error(`Executable installer tidak ditemukan di: ${exePath}`)
  }

  // Bersihkan trailing slash pada targetDir
  const cleanTargetDir = targetDir.replace(/[\\/]+$/, '')

  // Pastikan target directory sudah ada
  if (!fs.existsSync(cleanTargetDir)) {
    fs.mkdirSync(cleanTargetDir, { recursive: true })
  }

  // Parameter otomatisasi standar Inno Setup / Repack
  const args = [
    `/DIR=${cleanTargetDir}`,
    '/NOICONS',                                              // Don't create Start Menu folder
    '/TASKS=!desktopicon,!desktop_icon,!desktopshortcut',   // Don't create desktop icon
    '/MERGETASKS=!desktopicon,!desktop_icon,!desktopshortcut',
    `/USERNAME=${userName}`,                                 // Preset username jika didukung setup
    `/USER=${userName}`
  ]

  if (silent) {
    args.push('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-')
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
  cleanTitle,
  userName = 'mygameon'
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

  // 4. Hapus folder mentah Base Game (ISO / Setup mentah) dengan retry delay
  if (rawBaseFolder && fs.existsSync(rawBaseFolder) && rawBaseFolder.toLowerCase() !== targetDir.toLowerCase()) {
    try {
      fs.rmSync(rawBaseFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
    } catch (err) {
      console.warn(`[Finalize] Gagal menghapus rawBaseFolder: ${err.message}`)
    }
  }

  // 5. Hapus folder mentah Update Patch dengan retry delay
  if (rawUpdateFolder && fs.existsSync(rawUpdateFolder) && rawUpdateFolder.toLowerCase() !== targetDir.toLowerCase()) {
    try {
      fs.rmSync(rawUpdateFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
    } catch (err) {
      console.warn(`[Finalize] Gagal menghapus rawUpdateFolder: ${err.message}`)
    }
  }

  // 6. Injeksi Username ke file konfigurasi emulator (Steam, Goldberg, Codex, Rune, FLT, dll)
  try {
    injectEmulatorUsername(targetDir, userName)
  } catch (err) {
    console.warn(`[Finalize] Gagal injeksi username emulator: ${err.message}`)
  }

  // 7. Bersihkan shortcut desktop atau start menu jika terbuat
  try {
    cleanDesktopShortcuts(cleanTitle)
  } catch (_) {}

  // 8. Jalankan Sanitizer & Injeksi Branding Resmi MyGameON
  const sanitized = sanitizeAndBrandGameFolder(targetDir, cleanTitle)

  return {
    success: true,
    targetDir,
    gameTitle: cleanTitle,
    sanitized
  }
}

// In-memory registry untuk memantau status pipeline instalasi otomatis
const activePipelines = new Map()

/**
 * Helper menunggu proses installer selesai
 */
function waitForProcessCompletion(sessionId, maxWaitMs = 1800000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const checkInterval = setInterval(() => {
      const session = getInstallerSession(sessionId)
      if (!session) {
        clearInterval(checkInterval)
        resolve()
        return
      }

      if (session.status === 'completed') {
        clearInterval(checkInterval)
        resolve(session)
        return
      }

      if (session.status === 'error') {
        clearInterval(checkInterval)
        reject(new Error(session.error || 'Proses installer mengalami kesalahan'))
        return
      }

      if (Date.now() - startTime > maxWaitMs) {
        clearInterval(checkInterval)
        reject(new Error('Waktu tunggu instalasi melebihi batas (Timeout 30 menit)'))
        return
      }
    }, 2000)
  })
}

/**
 * Dapatkan status pipeline berdasarkan ID
 */
export function getPipelineSession(pipelineId) {
  return activePipelines.get(pipelineId) || null
}

/**
 * Jalankan Full-Automated (Unattended) ISO Installation & Update Pipeline
 */
export function runAutoInstallPipeline({
  uploadDir,
  folderName,
  customTargetDir = null,
  userName = 'mygameon',
  pipelineId = `pipe_${Date.now()}`
}) {
  const pipeline = {
    pipelineId,
    folderName,
    status: 'running', // 'running' | 'completed' | 'error'
    step: 'detecting', // 'detecting' | 'mounting' | 'installing_base' | 'installing_update' | 'finalizing' | 'completed'
    stepIndex: 1,
    totalSteps: 4,
    statusText: 'Memulai pipeline instalasi otomatis...',
    startedAt: Date.now(),
    completedAt: null,
    error: null,
    result: null
  }
  activePipelines.set(pipelineId, pipeline)

  // Jalankan asynchronous di latar belakang
  ;(async () => {
    let mountedDriveLetter = null
    let detectedIsoPath = null

    try {
      // 1. Deteksi komponen installer
      pipeline.statusText = 'Mendeteksi berkas ISO dan komponen update...'
      const setupInfo = detectGameInstallSetup(uploadDir, folderName)
      if (!setupInfo) {
        throw new Error(`Folder tidak ditemukan: ${folderName}`)
      }

      const effectiveTargetDir = (customTargetDir && customTargetDir.trim())
        ? customTargetDir.trim().replace(/[\\/]+$/, '')
        : setupInfo.suggestedTargetPath

      const effectiveCleanTitle = path.basename(effectiveTargetDir) || setupInfo.cleanTitle

      const totalSteps = setupInfo.hasUpdate ? 4 : 3
      pipeline.totalSteps = totalSteps

      let exeToRun = setupInfo.setupExePath
      detectedIsoPath = setupInfo.isoPath

      // 2. Mount ISO jika ada berkas ISO
      if (setupInfo.hasIso) {
        pipeline.step = 'mounting'
        pipeline.stepIndex = 1
        pipeline.statusText = `Me-mount berkas ISO (${path.basename(setupInfo.isoPath)}) ke Virtual Drive...`
        const mountData = mountIsoImage(setupInfo.isoPath)
        mountedDriveLetter = mountData.driveLetter
        exeToRun = mountData.setupExePath
      }

      if (!exeToRun) {
        throw new Error('Tidak dapat menemukan setup.exe di dalam file ISO maupun folder game.')
      }

      // 3. Eksekusi Setup Game Utama secara SILENT
      pipeline.step = 'installing_base'
      pipeline.stepIndex = setupInfo.hasIso ? 2 : 1
      pipeline.statusText = `Menginstal Game Utama ke "${path.basename(effectiveTargetDir)}"... (Setujui konfirmasi UAC jika muncul di layar)`

      const baseSession = launchGameSetup({
        exePath: exeToRun,
        targetDir: effectiveTargetDir,
        silent: true,
        userName
      })

      // Tunggu hingga proses setup game utama selesai
      await waitForProcessCompletion(baseSession.sessionId)

      // 4. Eksekusi Update Patch jika ada
      if (setupInfo.hasUpdate && setupInfo.updateExePath) {
        pipeline.step = 'installing_update'
        pipeline.stepIndex = pipeline.totalSteps - 1
        pipeline.statusText = `Menginstal Patch Update (${setupInfo.updateFolder})...`

        const updateSession = launchGameSetup({
          exePath: setupInfo.updateExePath,
          targetDir: effectiveTargetDir,
          silent: true,
          userName
        })

        // Tunggu hingga proses update selesai
        await waitForProcessCompletion(updateSession.sessionId)
      }

      // 5. Finalisasi: Dismount ISO, hapus ISO mentah, hapus update mentah, suntik dokumen branding & username emulator
      pipeline.step = 'finalizing'
      pipeline.stepIndex = pipeline.totalSteps
      pipeline.statusText = 'Membersihkan berkas ISO mentah, menyetel username emulator, dan menyuntikkan dokumen branding resmi MyGameON...'

      const finalResult = finalizePreInstalledGame({
        targetDir: effectiveTargetDir,
        rawBaseFolder: setupInfo.fullPath,
        rawUpdateFolder: setupInfo.updateFolder
          ? path.join(uploadDir, setupInfo.updateFolder)
          : null,
        isoPath: setupInfo.isoPath,
        cleanTitle: effectiveCleanTitle,
        userName
      })

      pipeline.status = 'completed'
      pipeline.step = 'completed'
      pipeline.statusText = 'Game sukses dimatangkan ke format Pre-Installed! Siap diarsip WinRAR.'
      pipeline.completedAt = Date.now()
      pipeline.result = finalResult

    } catch (err) {
      console.error('[AutoPipeline] Error:', err)
      pipeline.status = 'error'
      pipeline.error = err.message
      pipeline.statusText = `Gagal: ${err.message}`

      // Jika terjadi error dan ISO masih ter-mount, coba bersihkan
      if (detectedIsoPath) {
        try { dismountIsoImage(detectedIsoPath) } catch (_) {}
      }
    }
  })()

  return pipeline
}
