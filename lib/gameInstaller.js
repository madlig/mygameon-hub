import fs from 'fs'
import path from 'path'
import { exec, execSync, spawn } from 'child_process'
import { sanitizeAndBrandGameFolder } from './studioSanitizer.js'
import { cleanReleaseName, formatBytes, formatSpeed } from './utils.js'
import { getDownloadConfig } from './downloadWatcher.js'

// In-memory registry untuk memantau status instalasi yang sedang berjalan
const activeSessions = new Map()

/**
 * Pengukur ukuran folder rekursif cepat untuk memantau progress ekstraksi
 */
export function measureFolderSize(dirPath) {
  let size = 0
  let count = 0
  if (!fs.existsSync(dirPath)) return { size: 0, count: 0 }
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const sub = measureFolderSize(full)
        size += sub.size
        count += sub.count
      } else if (entry.isFile()) {
        try {
          size += fs.statSync(full).size
          count++
        } catch (_) {}
      }
    }
  } catch (_) {}
  return { size, count }
}

/**
 * Format detik sisa ke estimasi waktu yang mudah dipahami
 */
export function formatRemainingTime(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return null
  if (seconds < 60) return `~${Math.round(seconds)} dtk`
  const minutes = Math.floor(seconds / 60)
  const remainingSec = Math.round(seconds % 60)
  if (minutes < 60) return `~${minutes} mnt ${remainingSec} dtk`
  const hours = Math.floor(minutes / 60)
  const remainingMin = minutes % 60
  return `~${hours} jam ${remainingMin} mnt`
}

// Singleton registry untuk memantau status pipeline instalasi otomatis (survives Next.js Fast Refresh)
if (!globalThis.__mygameonActiveInstallPipelines) {
  globalThis.__mygameonActiveInstallPipelines = new Map()
}
const activePipelines = globalThis.__mygameonActiveInstallPipelines

export function getPipelineSession(pipelineId) {
  return activePipelines.get(pipelineId) || null
}

export function getActivePipelineByFolder(folderName) {
  if (!folderName) return null
  const cleanTarget = folderName.toLowerCase().trim()
  for (const pipeline of activePipelines.values()) {
    if (pipeline.status === 'running') {
      const pFolder = (pipeline.folderName || '').toLowerCase().trim()
      const pClean = (pipeline.cleanTitle || '').toLowerCase().trim()
      if (pFolder === cleanTarget || pClean === cleanTarget) {
        return pipeline
      }
    }
  }
  return null
}

globalThis.__mygameonGetActiveInstallPipeline = getActivePipelineByFolder


/**
 * Deteksi apakah sebuah folder game memiliki file installer/ISO dan apakah ada folder update yang berpasangan.
 * Fleksibel mendeteksi folder di GameDownload maupun GameUpload, dan selalu menyarankan target di GameUpload.
 */
export function detectGameInstallSetup(arg1, arg2, arg3 = {}) {
  let folderName
  let options = {}

  if (typeof arg2 === 'string') {
    // Kompatibilitas mundur: detectGameInstallSetup(uploadDir, folderName, options)
    folderName = arg2
    options = { uploadDir: arg1, ...arg3 }
  } else {
    // Pemanggilan modern: detectGameInstallSetup(folderName, options)
    folderName = arg1
    options = arg2 || {}
  }

  const config = getDownloadConfig()
  const downloadDir = options.downloadDir || config.downloadDir || 'D:\\Game\\Shopee\\GameDownload'
  const uploadDir = options.uploadDir || config.uploadDir || 'D:\\Game\\Shopee\\GameUpload'

  // Cari lokasi source game folder: options.sourceDir -> downloadDir -> uploadDir
  let sourceDir = options.sourceDir || null
  let fullPath = null

  if (sourceDir && fs.existsSync(path.join(sourceDir, folderName))) {
    fullPath = path.join(sourceDir, folderName)
  } else if (fs.existsSync(path.join(downloadDir, folderName))) {
    sourceDir = downloadDir
    fullPath = path.join(downloadDir, folderName)
  } else if (fs.existsSync(path.join(uploadDir, folderName))) {
    sourceDir = uploadDir
    fullPath = path.join(uploadDir, folderName)
  } else {
    return null
  }

  try {
    if (!fs.statSync(fullPath).isDirectory()) return null
  } catch (_) {
    return null
  }

  // 1. Cari file ISO atau setup installer di folder game ini (dan 1 level subfolder jika ada)
  let isoPath = null
  let setupExePath = null

  try {
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
        } else if (st.isDirectory()) {
          // Cek 1 level subfolder untuk file ISO/setup (beberapa repack meletakkan file di dalam subfolder)
          try {
            const subFiles = fs.readdirSync(p)
            for (const sf of subFiles) {
              const sp = path.join(p, sf)
              const sst = fs.statSync(sp)
              if (sst.isFile()) {
                const sLower = sf.toLowerCase()
                if (sLower.endsWith('.iso') && !isoPath) {
                  isoPath = sp
                } else if ((sLower === 'setup.exe' || (sLower.startsWith('setup') && sLower.endsWith('.exe'))) && !setupExePath) {
                  setupExePath = sp
                }
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
  } catch (_) {}

  // Bersihkan nama untuk calon folder game matang (Installed Game di Upload Studio)
  const cleanTitle = cleanReleaseName(folderName)
  const suggestedTargetPath = path.join(uploadDir, cleanTitle)

  // 2. Cari apakah ada folder Update yang berpasangan di sourceDir maupun uploadDir
  let updateFolder = null
  let updateExePath = null

  const searchDirs = [sourceDir, uploadDir].filter(Boolean)
  const basePrefix = cleanTitle.toLowerCase().split(' ')[0] // kata pertama (misal: "mouse")

  for (const sDir of searchDirs) {
    if (!fs.existsSync(sDir)) continue
    try {
      const allFolders = fs.readdirSync(sDir)
      for (const other of allFolders) {
        if (other === folderName) continue
        const otherLower = other.toLowerCase()
        if (
          (otherLower.includes('update') || otherLower.includes('patch')) &&
          otherLower.includes(basePrefix)
        ) {
          const otherFull = path.join(sDir, other)
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
      if (updateFolder) break
    } catch (_) {}
  }

  let isoSizeBytes = 0
  if (isoPath) {
    try {
      isoSizeBytes = fs.statSync(isoPath).size
    } catch (_) {}
  }

  let targetDriveFreeBytes = 0
  try {
    const rootOrTarget = fs.existsSync(suggestedTargetPath)
      ? suggestedTargetPath
      : path.parse(suggestedTargetPath).root || suggestedTargetPath.substring(0, 3)
    const statfs = fs.statfsSync(rootOrTarget)
    targetDriveFreeBytes = Number(statfs.bavail) * Number(statfs.bsize)
  } catch (_) {}

  const activePipeline = getActivePipelineByFolder(folderName)

  return {
    folderName,
    fullPath,
    sourceDir,
    uploadDir,
    cleanTitle,
    suggestedTargetPath,
    hasIso: !!isoPath,
    isoPath,
    isoSizeBytes,
    isoSizeFormatted: isoSizeBytes > 0 ? formatBytes(isoSizeBytes) : null,
    targetDriveFreeBytes,
    targetDriveFreeFormatted: targetDriveFreeBytes > 0 ? formatBytes(targetDriveFreeBytes) : null,
    hasEnoughDiskSpace: isoSizeBytes > 0 ? targetDriveFreeBytes >= (isoSizeBytes * 0.95) : true,
    hasSetupExe: !!setupExePath,
    setupExePath,
    hasUpdate: !!updateFolder,
    updateFolder,
    updateExePath,
    isInstallerPackage: !!isoPath || !!setupExePath,
    activePipeline: activePipeline ? {
      pipelineId: activePipeline.pipelineId,
      status: activePipeline.status,
      step: activePipeline.step,
      stepIndex: activePipeline.stepIndex,
      totalSteps: activePipeline.totalSteps,
      statusText: activePipeline.statusText,
      progress: activePipeline.progress || null
    } : null
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

  // Mode Headless Silent (Option A) vs Semi-Silent:
  // silent: true atau silent: 'headless' -> Jendela installer disembunyikan 100% (Full Background Silent)
  // silent: 'semi' -> Tampilkan jendela progress bar bawaan Inno Setup
  if (silent === true || silent === 'headless') {
    args.push('/VERYSILENT', '/SUPPRESSMSGBOXES', '/SP-', '/NORESTART')
  } else if (silent === 'semi') {
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
    exitCode: null,
    error: null
  }

  child.on('exit', (code) => {
    session.exitCode = code
    // Jangan langsung set completed jika child worker Inno Setup (setup.tmp) masih aktif
    const workersRunning = hasActiveInstallerProcesses(exePath)
    if (!workersRunning) {
      if (code !== 0 && code !== null) {
        session.status = 'error'
        session.error = `Installer berhenti dengan kode keluar error: ${code}`
      } else {
        session.status = 'completed'
      }
      session.completedAt = Date.now()
    }
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
 * Cek apakah sebuah PID masih aktif secara native di Windows (Win32 0ms check)
 */
function isPidRunning(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/**
 * Cek apakah ada proses installer (setup.exe, setup.tmp, dll) yang masih aktif di sistem
 */
function hasActiveInstallerProcesses(exePath) {
  if (process.platform !== 'win32') return false
  try {
    const stdout = execSync(
      'powershell -NoProfile -Command "Get-Process -Name \'setup*\', \'is-*\', \'unarc*\' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"',
      { encoding: 'utf-8', timeout: 4000, stdio: ['pipe', 'pipe', 'ignore'] }
    )
    return stdout.trim().length > 0
  } catch (_) {
    return false
  }
}

/**
 * Cek status proses installer berdasarkan session ID atau PID
 */
export function getInstallerSession(sessionId) {
  const session = activeSessions.get(sessionId)
  if (!session) return null

  // Cek apakah proses masih aktif di Windows jika status belum completed/error
  if (session.status === 'running') {
    const mainPidAlive = session.pid ? isPidRunning(session.pid) : false
    const workersAlive = hasActiveInstallerProcesses(session.exePath)

    if (mainPidAlive || workersAlive) {
      // Installer masih aktif mengekstrak file
      return session
    }

    // Seluruh proses installer telah selesai / tertutup
    if (session.exitCode !== null && session.exitCode !== 0) {
      session.status = 'error'
      session.error = `Installer gagal (exit code: ${session.exitCode})`
    } else {
      session.status = 'completed'
    }
    session.completedAt = Date.now()
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
  // 1. Pastikan seluruh proses installer sudah benar-benar mati sebelum menyentuh file
  if (hasActiveInstallerProcesses()) {
    throw new Error('Tidak dapat memfinalisasi: Proses installer/setup masih aktif berjalan di latar belakang!')
  }

  // 2. Pastikan target directory memiliki isi (tidak kosong)
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target folder game tidak ditemukan: ${targetDir}`)
  }

  const targetFiles = fs.readdirSync(targetDir)
  if (targetFiles.length === 0) {
    throw new Error('Instalasi gagal atau dibatalkan: Folder target kosong!')
  }

  // 3. VALIDASI INTEGRITAS EKSTRAKSI: Periksa apakah ada file/folder sementara .tmp yang menandakan crash/unarc error
  const hasIncompleteTmp = targetFiles.some((f) => {
    const l = f.toLowerCase()
    return (l.startsWith('freearc') && l.endsWith('.tmp')) || l.endsWith('.tmp')
  })
  if (hasIncompleteTmp) {
    throw new Error(
      'Instalasi gagal atau belum selesai! Terdeteksi berkas ekstraksi sementara (.tmp) di folder target. Folder mentah TIDAK dihapus untuk melindungi data Anda.'
    )
  }

  // 4. VALIDASI EXECUTABLE: Pastikan ada executable game utama (bukan hanya uninstaller)
  const hasGameExe = targetFiles.some((f) => {
    const l = f.toLowerCase()
    return l.endsWith('.exe') && !l.startsWith('unins')
  })
  if (!hasGameExe) {
    throw new Error('Instalasi tidak lengkap: Tidak ditemukan executable (.exe) game di folder tujuan!')
  }

  // 5. Dismount ISO HANYA setelah ekstraksi terbukti 100% sukses
  if (isoPath) {
    dismountIsoImage(isoPath)
  }

  // 6. Hapus uninstaller bawaan (unins000.exe & unins000.dat) agar game murni portable
  for (const f of targetFiles) {
    const l = f.toLowerCase()
    if (l.startsWith('unins000') || l.startsWith('uninstall')) {
      try {
        fs.unlinkSync(path.join(targetDir, f))
      } catch (_) {}
    }
  }

  // 7. Kebijakan Integritas Berkas (Rule A1 & A4): Berkas mentah (ISO / Update) dipertahankan 100%
  // TIDAK ADA PENGHAPUSAN OTOMATIS. Berkas ISO tetap tersimpan aman di GameDownload.
  // Pengguna dapat menghapus secara manual melalui tombol di Download Hub jika diinginkan.

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

/**
 * Hentikan / batalkan pipeline instalasi otomatis yang sedang berjalan
 */
export function abortAutoInstallPipeline(pipelineId) {
  const pipeline = activePipelines.get(pipelineId)
  if (!pipeline) return false

  // 1. Hentikan child process installer jika masih aktif
  if (pipeline.activeSession?.pid) {
    try {
      execSync(`taskkill /F /T /PID ${pipeline.activeSession.pid}`, { stdio: 'ignore' })
    } catch (_) {}
  }
  try {
    execSync('powershell -NoProfile -Command "Stop-Process -Name \'setup*\', \'is-*\', \'unarc*\' -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' })
  } catch (_) {}

  // 2. Dismount ISO jika masih terpasang
  if (pipeline.detectedIsoPath) {
    try {
      dismountIsoImage(pipeline.detectedIsoPath)
    } catch (_) {}
  }

  pipeline.status = 'aborted'
  pipeline.statusText = 'Instalasi dibatalkan oleh operator.'
  pipeline.completedAt = Date.now()
  if (pipeline.progress) {
    pipeline.progress.phase = 'aborted'
  }

  return true
}

/**
 * Helper menunggu proses installer selesai
 */
function waitForProcessCompletion(sessionId, maxWaitMs = 7200000) {
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
        reject(new Error('Waktu tunggu instalasi melebihi batas (Timeout 2 jam)'))
        return
      }
    }, 2000)
  })
}

/**
 * Jalankan Full-Automated (Unattended) ISO Installation & Update Pipeline (Option A: Silent Headless)
 */
export function runAutoInstallPipeline({
  uploadDir = null,
  downloadDir = null,
  sourceDir = null,
  folderName,
  customTargetDir = null,
  userName = 'mygameon',
  silentMode = 'headless', // 'headless' (Option A - default) | 'semi' | false
  pipelineId = `pipe_${Date.now()}`
}) {
  const pipeline = {
    pipelineId,
    folderName,
    status: 'running', // 'running' | 'completed' | 'error' | 'aborted'
    step: 'detecting', // 'detecting' | 'mounting' | 'installing_base' | 'installing_update' | 'finalizing' | 'completed'
    stepIndex: 1,
    totalSteps: 3,
    statusText: 'Memulai pipeline instalasi otomatis...',
    startedAt: Date.now(),
    completedAt: null,
    error: null,
    result: null,
    detectedIsoPath: null,
    activeSession: null,
    progress: {
      currentBytes: 0,
      totalExpectedBytes: 0,
      percent: 0,
      speedBytesPerSec: 0,
      formattedSpeed: '0 B/s',
      formattedCurrent: '0 B',
      formattedTotal: '0 B',
      filesCount: 0,
      etaSeconds: null,
      formattedEta: null,
      phase: 'detecting',
      lastUpdatedAt: Date.now()
    }
  }
  activePipelines.set(pipelineId, pipeline)

  // Jalankan asynchronous di latar belakang
  ;(async () => {
    let mountedDriveLetter = null
    let detectedIsoPath = null
    let progressTimer = null

    try {
      // 1. Deteksi komponen installer
      pipeline.statusText = 'Mendeteksi berkas ISO dan komponen update...'
      pipeline.progress.phase = 'detecting'
      const setupInfo = detectGameInstallSetup(folderName, { sourceDir, uploadDir, downloadDir })
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
      pipeline.detectedIsoPath = detectedIsoPath

      const expectedTotalBytes = setupInfo.isoSizeBytes || 0
      pipeline.progress.totalExpectedBytes = expectedTotalBytes
      pipeline.progress.formattedTotal = formatBytes(expectedTotalBytes)

      // 2. Mount ISO jika ada berkas ISO
      if (setupInfo.hasIso) {
        pipeline.step = 'mounting'
        pipeline.stepIndex = 1
        pipeline.progress.phase = 'mounting'
        pipeline.statusText = `Me-mount berkas ISO (${path.basename(setupInfo.isoPath)}) ke Virtual Drive...`
        const mountData = mountIsoImage(setupInfo.isoPath)
        mountedDriveLetter = mountData.driveLetter
        exeToRun = mountData.setupExePath
      }

      if (!exeToRun) {
        throw new Error('Tidak dapat menemukan setup.exe di dalam file ISO maupun folder game.')
      }

      // 3. Eksekusi Setup Game Utama secara Silent (Option A)
      pipeline.step = 'installing_base'
      pipeline.stepIndex = setupInfo.hasIso ? 2 : 1
      pipeline.progress.phase = 'extracting'
      pipeline.statusText = `Mengekstrak Game Utama ke "${path.basename(effectiveTargetDir)}" di latar belakang (Silent)...`

      const silentParam = silentMode === 'semi' ? 'semi' : true
      const baseSession = launchGameSetup({
        exePath: exeToRun,
        targetDir: effectiveTargetDir,
        silent: silentParam,
        userName
      })
      pipeline.activeSession = baseSession

      // Mulai live polling folder size & metrics setiap 1 detik
      let lastBytes = 0
      let lastTime = Date.now()

      progressTimer = setInterval(() => {
        if (pipeline.status !== 'running') {
          if (progressTimer) clearInterval(progressTimer)
          return
        }
        try {
          const now = Date.now()
          const { size: curSize, count: curCount } = measureFolderSize(effectiveTargetDir)
          const timeDeltaSec = Math.max(0.5, (now - lastTime) / 1000)
          const bytesDelta = Math.max(0, curSize - lastBytes)
          const instantSpeed = bytesDelta / timeDeltaSec

          // Smoothing exponential moving average
          const smoothed = pipeline.progress.speedBytesPerSec > 0
            ? (pipeline.progress.speedBytesPerSec * 0.65) + (instantSpeed * 0.35)
            : instantSpeed

          lastBytes = curSize
          lastTime = now

          const remaining = Math.max(0, expectedTotalBytes - curSize)
          const eta = smoothed > 500 * 1024 ? Math.round(remaining / smoothed) : null
          const calcPercent = expectedTotalBytes > 0
            ? Math.min(99, Math.round((curSize / expectedTotalBytes) * 100))
            : (pipeline.progress.percent < 95 ? pipeline.progress.percent + 1 : 95)

          pipeline.progress = {
            currentBytes: curSize,
            totalExpectedBytes: expectedTotalBytes,
            percent: calcPercent,
            speedBytesPerSec: smoothed,
            formattedSpeed: formatSpeed(smoothed) || 'Mengekstrak...',
            formattedCurrent: formatBytes(curSize),
            formattedTotal: formatBytes(expectedTotalBytes),
            filesCount: curCount,
            etaSeconds: eta,
            formattedEta: formatRemainingTime(eta),
            phase: 'extracting',
            lastUpdatedAt: now
          }
        } catch (_) {}
      }, 1000)

      // Tunggu hingga proses setup game utama selesai
      await waitForProcessCompletion(baseSession.sessionId)
      if (progressTimer) clearInterval(progressTimer)

      // 4. Eksekusi Update Patch jika ada
      if (setupInfo.hasUpdate && setupInfo.updateExePath) {
        pipeline.step = 'installing_update'
        pipeline.stepIndex = pipeline.totalSteps - 1
        pipeline.progress.phase = 'patching'
        pipeline.statusText = `Menginstal Patch Update (${setupInfo.updateFolder}) secara Silent...`

        const updateSession = launchGameSetup({
          exePath: setupInfo.updateExePath,
          targetDir: effectiveTargetDir,
          silent: silentParam,
          userName
        })
        pipeline.activeSession = updateSession

        // Tunggu hingga proses update selesai
        await waitForProcessCompletion(updateSession.sessionId)
      }

      // 5. Finalisasi: Dismount ISO, suntik dokumen branding & username emulator
      pipeline.step = 'finalizing'
      pipeline.stepIndex = pipeline.totalSteps
      pipeline.progress.phase = 'finalizing'
      pipeline.progress.percent = 99
      pipeline.statusText = 'Dismount virtual ISO, menyetel username emulator, dan menyuntikkan dokumen branding resmi MyGameON...'

      const finalResult = finalizePreInstalledGame({
        targetDir: effectiveTargetDir,
        rawBaseFolder: setupInfo.fullPath,
        rawUpdateFolder: setupInfo.updateFolder
          ? path.join(setupInfo.sourceDir || setupInfo.uploadDir, setupInfo.updateFolder)
          : null,
        isoPath: setupInfo.isoPath,
        cleanTitle: effectiveCleanTitle,
        userName
      })

      const finalMeasure = measureFolderSize(effectiveTargetDir)
      pipeline.progress = {
        ...pipeline.progress,
        currentBytes: finalMeasure.size,
        formattedCurrent: formatBytes(finalMeasure.size),
        percent: 100,
        filesCount: finalMeasure.count,
        phase: 'completed',
        speedBytesPerSec: 0,
        formattedSpeed: null,
        etaSeconds: null,
        formattedEta: null,
        lastUpdatedAt: Date.now()
      }

      pipeline.status = 'completed'
      pipeline.step = 'completed'
      pipeline.statusText = 'Game sukses dimatangkan ke format Pre-Installed di Upload Studio! File ISO mentah tetap aman di GameDownload.'
      pipeline.completedAt = Date.now()
      pipeline.result = finalResult

    } catch (err) {
      if (progressTimer) clearInterval(progressTimer)
      console.error('[AutoPipeline] Error:', err)
      pipeline.status = 'error'
      pipeline.error = err.message
      pipeline.statusText = `Gagal: ${err.message}`
      if (pipeline.progress) {
        pipeline.progress.phase = 'error'
      }

      // Jika terjadi error dan ISO masih ter-mount, coba bersihkan
      if (detectedIsoPath) {
        try { dismountIsoImage(detectedIsoPath) } catch (_) {}
      }
    }
  })()

  return pipeline
}
