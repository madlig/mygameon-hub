import fs from 'fs'
import path from 'path'
import { exec, execSync, spawn } from 'child_process'
import { getStudioQueue, saveStudioQueue } from './studioConfig.js'
import { sanitizeAndBrandGameFolder, detectPackageType } from './studioSanitizer.js'

const DEFAULT_DOWNLOAD_DIR = 'D:\\Game\\Shopee\\GameDownload'
const DEFAULT_UPLOAD_DIR = 'D:\\Game\\Shopee\\GameUpload'
const JDOWNLOADER_EXE_PATH = path.join(
  process.env.LOCALAPPDATA || 'C:\\Users\\madli\\AppData\\Local',
  'JDownloader 2',
  'JDownloader2.exe'
)
const STATE_FILE_PATH = path.join(process.cwd(), 'download-state.json')

// ── 1. Baca & Tulis State Konfigurasi Downloader ──
export function getDownloadConfig() {
  const defaults = {
    downloadDir: DEFAULT_DOWNLOAD_DIR,
    uploadDir: DEFAULT_UPLOAD_DIR,
    autoHandoff: false,
    history: []
  }

  if (!fs.existsSync(STATE_FILE_PATH)) {
    return defaults
  }

  try {
    const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return { ...defaults, ...parsed }
  } catch (err) {
    console.error('[downloadWatcher] Gagal membaca download-state.json:', err.message)
    return defaults
  }
}

export function saveDownloadConfig(config) {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8')
    return config
  } catch (err) {
    console.error('[downloadWatcher] Gagal menyimpan download-state.json:', err.message)
    return config
  }
}

// ── 2. Format Byte & Utilities ──
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// ── 3. Cek Status Proses JDownloader di Windows ──
export function checkJDownloaderRunning() {
  if (process.platform !== 'win32') return false
  try {
    const stdout = execSync(
      'powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -match \'JDownloader\' } | Select-Object -ExpandProperty Id"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 3000 }
    )
    return stdout.trim().length > 0
  } catch (_) {
    return false
  }
}

// ── 4. Luncurkan JDownloader 2 ──
export function launchJDownloader() {
  if (!fs.existsSync(JDOWNLOADER_EXE_PATH)) {
    throw new Error(`Executable JDownloader tidak ditemukan di: ${JDOWNLOADER_EXE_PATH}`)
  }

  // Spawn detached process agar tidak memblokir server
  const child = spawn(JDOWNLOADER_EXE_PATH, [], {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
  return true
}

// ── 5. Scan Folder GameDownload ──
export function scanDownloadDirectory() {
  const config = getDownloadConfig()
  const targetDir = config.downloadDir || DEFAULT_DOWNLOAD_DIR

  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true })
    } catch (_) {}
    return { targetDir, isRunning: checkJDownloaderRunning(), activeItems: [], readyItems: [], historyItems: config.history || [] }
  }

  const items = fs.readdirSync(targetDir)
  const activeItems = []
  const readyItems = []
  const now = Date.now()

  for (const item of items) {
    if (item.startsWith('.') || item === '$RECYCLE.BIN' || item === 'System Volume Information') continue

    const fullPath = path.join(targetDir, item)
    let stats
    try {
      stats = fs.statSync(fullPath)
    } catch (_) {
      continue
    }

    if (!stats.isDirectory()) continue

    // Cek apakah item ini sudah pernah ditransfer
    const alreadyTransferred = (config.history || []).some((h) => h.folderName === item && h.status === 'transferred')

    // Analisis isi folder
    let totalSize = 0
    let fileCount = 0
    let hasPartFiles = false
    let partFilesCount = 0
    let hasIso = false
    let hasExe = false
    let hasRar = false
    let latestMtime = stats.mtimeMs

    try {
      const files = fs.readdirSync(fullPath)
      for (const f of files) {
        const filePath = path.join(fullPath, f)
        try {
          const fStats = fs.statSync(filePath)
          totalSize += fStats.size
          fileCount++
          if (fStats.mtimeMs > latestMtime) latestMtime = fStats.mtimeMs

          const lower = f.toLowerCase()
          if (lower.endsWith('.part') || lower.endsWith('.crdownload') || lower.endsWith('.tmp')) {
            hasPartFiles = true
            partFilesCount++
          } else if (lower.endsWith('.iso')) {
            hasIso = true
          } else if (lower.endsWith('.exe')) {
            hasExe = true
          } else if (lower.match(/\.(rar|7z|zip|r\d+)$/)) {
            hasRar = true
          }

          // Cek subfolder 1 level (misal hasil ekstrak ElAmigos)
          if (fStats.isDirectory()) {
            try {
              const subFiles = fs.readdirSync(filePath)
              for (const sf of subFiles) {
                const subPath = path.join(filePath, sf)
                const sfStats = fs.statSync(subPath)
                totalSize += sfStats.size
                fileCount++
                if (sfStats.mtimeMs > latestMtime) latestMtime = sfStats.mtimeMs
                const subLower = sf.toLowerCase()
                if (subLower.endsWith('.iso')) hasIso = true
                if (subLower.endsWith('.exe')) hasExe = true
                if (subLower.endsWith('.part')) hasPartFiles = true
              }
            } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (_) {}

    const secondsSinceLastWrite = Math.floor((now - latestMtime) / 1000)

    // Tentukan Status:
    // 1. Jika ada file .part -> sedang didownload
    // 2. Jika tidak ada file .part, tapi mtime baru berubah < 10 detik lalu -> sedang diekstrak
    // 3. Jika tidak ada .part dan file stabil -> ready
    let status = 'ready'
    let statusText = 'Siap Dioper ke Studio'

    if (hasPartFiles) {
      status = 'downloading'
      statusText = `Mengunduh (${partFilesCount} part aktif)`
    } else if (secondsSinceLastWrite < 15 && totalSize > 0) {
      status = 'extracting'
      statusText = 'Sedang Mengekstrak (UnRAR)...'
    } else if (alreadyTransferred) {
      status = 'transferred'
      statusText = 'Sudah Dioper ke Studio'
    }

    const packageInfo = detectPackageType(fullPath)

    const gameInfo = {
      folderName: item,
      fullPath,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      fileCount,
      hasIso,
      hasExe,
      hasRar,
      hasPartFiles,
      partFilesCount,
      packageType: packageInfo.packageType,
      displayBadge: packageInfo.displayBadge,
      mainExecutable: packageInfo.mainExecutable,
      status,
      statusText,
      lastModified: stats.mtime,
      secondsSinceLastWrite
    }

    if (status === 'downloading' || status === 'extracting') {
      activeItems.push(gameInfo)
    } else {
      readyItems.push(gameInfo)
    }
  }

  // Sort descending berdasarkan mtime terbaru
  activeItems.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
  readyItems.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())

  return {
    targetDir,
    uploadDir: config.uploadDir || DEFAULT_UPLOAD_DIR,
    autoHandoff: !!config.autoHandoff,
    isRunning: checkJDownloaderRunning(),
    activeItems,
    readyItems,
    historyItems: config.history || []
  }
}

// ── 6. Handoff: Pindahkan Folder ke GameUpload & Masukkan Antrean Studio ──
export async function executeHandoff(folderName, options = {}) {
  const config = getDownloadConfig()
  const sourceBase = config.downloadDir || DEFAULT_DOWNLOAD_DIR
  const targetBase = config.uploadDir || DEFAULT_UPLOAD_DIR

  const sourcePath = path.join(sourceBase, folderName)
  const targetPath = path.join(targetBase, folderName)

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Folder game sumber tidak ditemukan: ${sourcePath}`)
  }

  if (!fs.existsSync(targetBase)) {
    fs.mkdirSync(targetBase, { recursive: true })
  }

  // 1. Pindahkan folder game ke target Upload Studio
  // Karena keduanya di drive yang sama (D:), renameSync berjalan instan (0.01s)
  if (sourcePath.toLowerCase() !== targetPath.toLowerCase()) {
    if (fs.existsSync(targetPath)) {
      throw new Error(`Folder dengan nama yang sama sudah ada di GameUpload: ${targetPath}`)
    }
    fs.renameSync(sourcePath, targetPath)
  }

  // 2. Bersihkan nama judul game (hapus tag rilis seperti MULTi7-ElAmigos, CODEX, dll)
  const cleanTitle = folderName
    .replace(/[-_.](MULTi\d+|ElAmigos|CODEX|RUNE|TENOKE|FitGirl|DODI|Repack|SKIDROW|FLT|GoldBerg)/gi, '')
    .replace(/[._]/g, ' ')
    .trim()

  // 3. Sanitasi file sampah pihak ketiga & Injeksi branding resmi MyGameON
  const sanitizeResult = sanitizeAndBrandGameFolder(targetPath, cleanTitle)

  // 4. Ambil informasi folder di target (setelah disanitasi & di-branding)
  const targetStats = fs.statSync(targetPath)
  const targetFiles = fs.readdirSync(targetPath)
  let totalSize = 0
  for (const f of targetFiles) {
    try {
      totalSize += fs.statSync(path.join(targetPath, f)).size
    } catch (_) {}
  }

  // 5. Masukkan otomatis ke antrean Upload Studio (POST /api/studio/queue)
  const queue = getStudioQueue()
  const queueItemId = `queue_${Date.now()}_${Math.floor(Math.random() * 1000)}`

  const newQueueItem = {
    id: queueItemId,
    folder: {
      name: folderName,
      path: targetPath,
      size: totalSize,
      sizeFormatted: formatBytes(totalSize),
      hasArchive: false,
      archiveParts: 0,
      isArchiveFile: false
    },
    customTitle: cleanTitle,
    packageType: sanitizeResult.packageType,
    displayBadge: sanitizeResult.displayBadge,
    sanitized: {
      deletedFiles: sanitizeResult.deletedFiles,
      addedFiles: sanitizeResult.addedFiles
    },
    mode: options.mode || 'new', // 'new' | 'update'
    cleanReplace: options.cleanReplace !== undefined ? options.cleanReplace : true,
    targetGameId: options.targetGameId || '',
    workspace: options.workspace || null,
    status: 'waiting',
    text: 'Menunggu antrean upload',
    progress: 0,
    addedAt: new Date().toISOString()
  }

  queue.push(newQueueItem)
  saveStudioQueue(queue)

  // 6. Catat riwayat handoff
  const history = config.history || []
  history.unshift({
    id: queueItemId,
    folderName,
    cleanTitle,
    packageType: sanitizeResult.packageType,
    deletedFilesCount: sanitizeResult.deletedFiles.length,
    addedFilesCount: sanitizeResult.addedFiles.length,
    sizeFormatted: formatBytes(totalSize),
    transferredAt: new Date().toISOString(),
    status: 'transferred'
  })

  // Simpan maksimal 30 riwayat terakhir
  config.history = history.slice(0, 30)
  saveDownloadConfig(config)

  return {
    success: true,
    folderName,
    targetPath,
    cleanTitle,
    packageType: sanitizeResult.packageType,
    displayBadge: sanitizeResult.displayBadge,
    deletedFiles: sanitizeResult.deletedFiles,
    addedFiles: sanitizeResult.addedFiles,
    queueItem: newQueueItem
  }
}
