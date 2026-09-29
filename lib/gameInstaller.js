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

  // 6. Jalankan Sanitizer & Injeksi Branding Resmi MyGameON
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
      pipeline.statusText = `Menginstal Game Utama ke "${path.basename(setupInfo.suggestedTargetPath)}"... (Setujui konfirmasi UAC jika muncul di layar)`

      const baseSession = launchGameSetup({
        exePath: exeToRun,
        targetDir: setupInfo.suggestedTargetPath,
        silent: true
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
          targetDir: setupInfo.suggestedTargetPath,
          silent: true
        })

        // Tunggu hingga proses update selesai
        await waitForProcessCompletion(updateSession.sessionId)
      }

      // 5. Finalisasi: Dismount ISO, hapus ISO mentah, hapus update mentah, suntik dokumen branding
      pipeline.step = 'finalizing'
      pipeline.stepIndex = pipeline.totalSteps
      pipeline.statusText = 'Membersihkan berkas ISO mentah dan menyuntikkan dokumen branding resmi MyGameON...'

      const finalResult = finalizePreInstalledGame({
        targetDir: setupInfo.suggestedTargetPath,
        rawBaseFolder: setupInfo.fullPath,
        rawUpdateFolder: setupInfo.updateFolder
          ? path.join(uploadDir, setupInfo.updateFolder)
          : null,
        isoPath: setupInfo.isoPath,
        cleanTitle: setupInfo.cleanTitle
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
