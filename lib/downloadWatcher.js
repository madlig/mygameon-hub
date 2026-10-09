import fs from 'fs'
import path from 'path'
import { exec, execSync, spawn } from 'child_process'
import zlib from 'zlib'
import { getStudioQueue, saveStudioQueue } from './studioConfig.js'
import { sanitizeAndBrandGameFolder, detectPackageType } from './studioSanitizer.js'
import { cleanReleaseName, formatBytes } from './utils.js'
import { getActiveExtractions } from './extractor.js'

const DEFAULT_DOWNLOAD_DIR = 'D:\\Game\\Shopee\\GameDownload'
const DEFAULT_UPLOAD_DIR = 'D:\\Game\\Shopee\\GameUpload'
const JDOWNLOADER_EXE_PATH = path.join(
  process.env.LOCALAPPDATA || 'C:\\Users\\madli\\AppData\\Local',
  'JDownloader 2',
  'JDownloader2.exe'
)
const STATE_FILE_PATH = path.join(process.cwd(), 'download-state.json')

function getActiveInstallerPipeline(nameOrTitle) {
  try {
    if (typeof globalThis.__mygameonGetActiveInstallPipeline === 'function') {
      return globalThis.__mygameonGetActiveInstallPipeline(nameOrTitle)
    }
  } catch (_) {}
  return null
}

// ── 1. Baca & Tulis State Konfigurasi Downloader ──
export function getDownloadConfig() {
  const defaults = {
    downloadDir: DEFAULT_DOWNLOAD_DIR,
    uploadDir: DEFAULT_UPLOAD_DIR,
    autoHandoff: false,
    maxConcurrent: 1,
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
export { formatBytes }

// Memory cache untuk kalkulasi kecepatan & ETA download
const progressTracker = new Map()

// Cache untuk pembacaan package JDownloader agar hemat I/O
let cachedJdPackages = new Map()
let lastJdCacheTime = 0

// Helper membaca file zip JDownloader secara native dengan zlib (tanpa dependensi eksternal)
function readZipCentralDirectory(filePath) {
  try {
    const buf = fs.readFileSync(filePath)
    let offset = 0
    const entries = []

    while (offset < buf.length - 4) {
      const idx = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), offset)
      if (idx === -1) break

      const method = buf.readUInt16LE(idx + 10)
      const compSize = buf.readUInt32LE(idx + 20)
      const uncompSize = buf.readUInt32LE(idx + 24)
      const nameLen = buf.readUInt16LE(idx + 28)
      const extraLen = buf.readUInt16LE(idx + 30)
      const commentLen = buf.readUInt16LE(idx + 32)
      const localHeaderOffset = buf.readUInt32LE(idx + 42)

      const name = buf.toString('utf-8', idx + 46, idx + 46 + nameLen)
      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26)
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28)
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
      const compressedData = buf.subarray(dataStart, dataStart + compSize)

      let contentBuf
      if (method === 0) {
        contentBuf = compressedData
      } else if (method === 8) {
        contentBuf = zlib.inflateRawSync(compressedData)
      }

      if (contentBuf) {
        entries.push({ name, content: contentBuf.toString('utf-8') })
      }

      offset = idx + 46 + nameLen + extraLen + commentLen
    }
    return entries
  } catch (_) {
    return []
  }
}

export async function getActiveJDownloaderPackages() {
  const now = Date.now()
  if (now - lastJdCacheTime < 1500 && cachedJdPackages.size > 0) {
    return cachedJdPackages
  }

  const cfgDir = path.join(
    process.env.LOCALAPPDATA || 'C:\\Users\\madli\\AppData\\Local',
    'JDownloader 2',
    'cfg'
  )
  if (!fs.existsSync(cfgDir)) return new Map()

  try {
    const files = fs.readdirSync(cfgDir)
      .filter((f) => /^downloadList\d+\.zip$/.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0], 10)
        const numB = parseInt(b.match(/\d+/)[0], 10)
        return numB - numA
      })

    if (files.length === 0) return new Map()

    // Jika zip paling baru kosong (hanya extraInfo), antrean unduhan JDownloader saat ini sedang kosong
    const latestEntries = readZipCentralDirectory(path.join(cfgDir, files[0]))
    const hasItems = latestEntries.some((e) => /^\d+$/.test(e.name))
    if (!hasItems) {
      cachedJdPackages = new Map()
      lastJdCacheTime = now
      return cachedJdPackages
    }

    for (const zipFileName of files.slice(0, 3)) {
      try {
        const zipPath = path.join(cfgDir, zipFileName)
        const entries = readZipCentralDirectory(zipPath)
        const packageMap = new Map()
        const links = []

        for (const entry of entries) {
          if (/^\d+$/.test(entry.name)) {
            const pkg = JSON.parse(entry.content)
            packageMap.set(entry.name, {
              ...pkg,
              totalExpectedBytes: 0,
              currentDownloadedBytes: 0,
              activeLinksCount: 0,
              totalLinksCount: 0,
              activeLinkName: null,
              links: []
            })
          } else if (/^\d+_\d+$/.test(entry.name)) {
            const link = JSON.parse(entry.content)
            const pkgKey = entry.name.split('_')[0]
            links.push({ pkgKey, link })
          }
        }

        if (packageMap.size > 0 && links.length > 0) {
          for (const { pkgKey, link } of links) {
            const pkg = packageMap.get(pkgKey)
            if (pkg) {
              pkg.totalLinksCount++
              pkg.totalExpectedBytes += (link.size || 0)
              pkg.currentDownloadedBytes += (link.current || 0)
              const isFinished = link.finalLinkState === 'FINISHED' || link.linkStatus === 'FINISHED'
              if (!isFinished) {
                pkg.activeLinksCount++
                if (!pkg.activeLinkName && link.name) {
                  pkg.activeLinkName = link.name
                }
              }
              pkg.links.push(link)
            }
          }

          const resultMap = new Map()
          for (const [key, pkg] of packageMap) {
            if (pkg.name) {
              resultMap.set(pkg.name.toLowerCase().trim(), pkg)
            }
            if (pkg.downloadFolder) {
              const base = path.basename(pkg.downloadFolder).toLowerCase().trim()
              resultMap.set(base, pkg)
            }
          }

          cachedJdPackages = resultMap
          lastJdCacheTime = now
          return resultMap
        }
      } catch (_) {}
    }
  } catch (_) {}

  return new Map()
}

export function getFolderDownloadMetrics(folderPath, folderName, jdPkg = null, diskTotalSize = 0) {
  const now = Date.now()
  const prev = progressTracker.get(folderName)

  // Current bytes: ambil nilai terbesar antara file di disk dan tracker JD
  let currentBytes = Math.max(diskTotalSize, jdPkg?.currentDownloadedBytes || 0)
  if (currentBytes === 0 && prev?.bytes) {
    currentBytes = prev.bytes
  }

  // Target bytes: jika ada paket JD gunakan ukuran total asli paket
  let targetBytes = jdPkg?.totalExpectedBytes || prev?.total || 0
  if (targetBytes === 0 || targetBytes < currentBytes) {
    targetBytes = currentBytes
  }

  // Hitung kecepatan unduh (Moving Average)
  let speed = 0 // bytes per second
  if (prev && prev.timestamp && currentBytes > prev.bytes) {
    const deltaTime = (now - prev.timestamp) / 1000
    const deltaBytes = currentBytes - prev.bytes
    if (deltaTime >= 0.5 && deltaTime <= 60) {
      const instantSpeed = deltaBytes / deltaTime
      speed = prev.speed ? (prev.speed * 0.35 + instantSpeed * 0.65) : instantSpeed
    } else if (prev.speed && (now - prev.timestamp) < 15000) {
      speed = prev.speed
    }
  } else if (prev && prev.speed && (now - prev.timestamp) < 12000) {
    speed = prev.speed * 0.8
  }

  // Hitung perkiraan waktu selesai (ETA)
  let etaSeconds = null
  let etaFormatted = null
  if (speed > 1024 && targetBytes > currentBytes) {
    etaSeconds = Math.round((targetBytes - currentBytes) / speed)
    if (etaSeconds < 60) {
      etaFormatted = `${etaSeconds}d tersisa`
    } else if (etaSeconds < 3600) {
      const m = Math.floor(etaSeconds / 60)
      const s = etaSeconds % 60
      etaFormatted = `${m}m ${s}d tersisa`
    } else {
      const h = Math.floor(etaSeconds / 3600)
      const m = Math.floor((etaSeconds % 3600) / 60)
      etaFormatted = `${h}j ${m}m tersisa`
    }
  }

  // Persentase Progres Real
  let progressPercent = 0
  if (targetBytes > 0 && currentBytes > 0) {
    progressPercent = Math.min(99.9, Math.max(0.1, Math.round((currentBytes / targetBytes) * 1000) / 10))
  } else if (prev?.progressPercent) {
    progressPercent = prev.progressPercent
  }

  // Simpan state terkini
  progressTracker.set(folderName, {
    bytes: currentBytes,
    total: targetBytes,
    speed,
    progressPercent,
    timestamp: now
  })

  return {
    logical: targetBytes,
    physical: currentBytes,
    speed,
    etaSeconds,
    etaFormatted,
    progressPercent
  }
}

// ── 3. Cek Status Proses JDownloader di Windows (Cepat & Hemat CPU) ──
let lastJdCheckTime = 0
let lastJdRunningResult = false

export function checkJDownloaderRunning() {
  if (process.platform !== 'win32') return false
  const now = Date.now()
  if (now - lastJdCheckTime < 5000) {
    return lastJdRunningResult
  }
  try {
    const stdout = execSync('tasklist', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 2000
    })
    lastJdRunningResult = stdout.toLowerCase().includes('jdownloader')
    lastJdCheckTime = now
    return lastJdRunningResult
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
export async function scanDownloadDirectory() {
  const config = getDownloadConfig()
  const targetDir = config.downloadDir || DEFAULT_DOWNLOAD_DIR

  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true })
    } catch (_) {}
    return { targetDir, isRunning: checkJDownloaderRunning(), activeItems: [], readyItems: [], historyItems: config.history || [] }
  }

  const jdPackages = await getActiveJDownloaderPackages()
  const items = fs.readdirSync(targetDir)
  const activeItems = []
  const readyItems = []
  const now = Date.now()

  // Ambil task native dari streamDownloader untuk mencegah duplikasi dan status palsu
  const streamTasks = globalThis.__mygameonStreamDownloader
    ? globalThis.__mygameonStreamDownloader.getTasks()
    : []

  const activeStreamFolders = new Set()
  const incompleteStreamFolders = new Set()

  for (const t of streamTasks) {
    const pName = (t.packageName || '').toLowerCase().trim()
    const cDir = t.customDir ? path.basename(t.customDir).toLowerCase().trim() : ''
    const fName = (t.filename || '').toLowerCase().trim()

    if (pName) activeStreamFolders.add(pName)
    if (cDir) activeStreamFolders.add(cDir)
    if (fName) activeStreamFolders.add(fName)

    if (t.status !== 'completed') {
      if (pName) incompleteStreamFolders.add(pName)
      if (cDir) incompleteStreamFolders.add(cDir)
      if (fName) incompleteStreamFolders.add(fName)
    }
  }

  for (const item of items) {
    if (item.startsWith('.') || item === '$RECYCLE.BIN' || item === 'System Volume Information') continue

    const fullPath = path.join(targetDir, item)
    let stats
    try {
      stats = fs.statSync(fullPath)
    } catch (_) {
      continue
    }

    // ── Dukung Berkas Mandiri (.rar, .zip, .7z, .iso, .exe) ──
    if (stats.isFile()) {
      const lower = item.toLowerCase()
      if (incompleteStreamFolders.has(lower)) {
        continue
      }
      const isGameArchive = /\.(rar|zip|7z|iso|exe)$/i.test(lower)
      if (!isGameArchive) continue

      const alreadyTransferred = (config.history || []).some((h) => h.folderName === item && h.status === 'transferred')
      const cleanTitle = cleanReleaseName(item).replace(/\.(rar|zip|7z|iso|exe)$/i, '').trim() || item
      const hasIso = lower.endsWith('.iso')
      const hasExe = lower.endsWith('.exe')
      const hasRar = /\.(rar|zip|7z)$/i.test(lower)
      const packageType = hasIso ? 'ISO' : (hasExe ? 'REPACK' : 'PRE-INSTALLED')
      const displayBadge = hasIso ? 'ISO' : (hasExe ? 'SETUP' : 'ARCHIVE')

      const uploadBase = config.uploadDir || DEFAULT_UPLOAD_DIR
      const targetInstalledPath = path.join(uploadBase, cleanTitle)
      let isInstalledInStudio = false
      let installedSize = 0
      if (fs.existsSync(targetInstalledPath)) {
        try {
          const istat = fs.statSync(targetInstalledPath)
          if (istat.isDirectory()) {
            isInstalledInStudio = true
            const targetFiles = fs.readdirSync(targetInstalledPath)
            for (const tf of targetFiles) {
              try { installedSize += fs.statSync(path.join(targetInstalledPath, tf)).size } catch (_) {}
            }
          }
        } catch (_) {}
      }

      const gameInfo = {
        folderName: item,
        cleanTitle,
        fullPath,
        totalSize: stats.size,
        totalSizeFormatted: formatBytes(stats.size),
        downloadedBytes: stats.size,
        downloadedBytesFormatted: formatBytes(stats.size),
        targetBytes: stats.size,
        targetBytesFormatted: formatBytes(stats.size),
        progressPercent: 100,
        downloadSpeed: 0,
        downloadSpeedFormatted: null,
        etaSeconds: null,
        etaFormatted: null,
        activePartName: null,
        completedPartsCount: 1,
        fileCount: 1,
        hasIso,
        hasExe,
        hasRar,
        hasPartFiles: false,
        partFilesCount: 0,
        isExtracted: false,
        canCleanRar: false,
        rarPartsCount: hasRar ? 1 : 0,
        rarTotalBytes: hasRar ? stats.size : 0,
        rarSizeFormatted: hasRar ? formatBytes(stats.size) : null,
        extractedTotalBytes: hasIso || hasExe ? stats.size : 0,
        extractedSizeFormatted: hasIso || hasExe ? formatBytes(stats.size) : null,
        mainIsoName: hasIso ? item : null,
        packageType,
        displayBadge,
        mainExecutable: hasExe ? item : 'Game.exe',
        isInstalledInStudio,
        installedPath: isInstalledInStudio ? targetInstalledPath : null,
        installedSizeFormatted: isInstalledInStudio ? formatBytes(installedSize) : null,
        status: alreadyTransferred ? 'transferred' : 'ready',
        statusText: alreadyTransferred ? 'Sudah Dioper ke Workbench' : 'Siap Dioper ke Workbench',
        lastModified: stats.mtime,
        secondsSinceLastWrite: Math.floor((now - stats.mtimeMs) / 1000),
        isFile: true
      }

      readyItems.push(gameInfo)
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
    let activePartName = null
    let completedPartsCount = 0
    let hasIso = false
    let hasExe = false
    let hasRar = false
    let latestMtime = stats.mtimeMs
    let rarTotalBytes = 0
    let rarPartsCount = 0
    let extractedTotalBytes = 0
    let mainIsoName = null

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
          const isArchive = lower.match(/\.part(\d+)\.rar$/i) || lower.match(/\.(rar|7z|zip|r\d+)$/i)

          if (isArchive) {
            rarPartsCount++
            rarTotalBytes += fStats.size
            if (lower.match(/\.part(\d+)\.rar$/i)) {
              completedPartsCount++
            } else {
              hasRar = true
            }
          } else if (lower.endsWith('.part') || lower.endsWith('.crdownload') || lower.endsWith('.tmp') || lower.endsWith('.downloading')) {
            hasPartFiles = true
            partFilesCount++
            const pMatch = f.match(/part(\d+)/i)
            if (pMatch && !activePartName) {
              activePartName = `Part ${pMatch[1]}`
            }
          } else if (lower.endsWith('.iso')) {
            hasIso = true
            if (!mainIsoName) mainIsoName = f
            extractedTotalBytes += fStats.size
          } else if (lower.endsWith('.exe')) {
            hasExe = true
            extractedTotalBytes += fStats.size
          } else if (!fStats.isDirectory()) {
            extractedTotalBytes += fStats.size
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
                const isSubArchive = subLower.match(/\.part(\d+)\.rar$/i) || subLower.match(/\.(rar|7z|zip|r\d+)$/i)

                if (isSubArchive) {
                  rarPartsCount++
                  rarTotalBytes += sfStats.size
                } else if (subLower.endsWith('.iso')) {
                  hasIso = true
                  if (!mainIsoName) mainIsoName = sf
                  extractedTotalBytes += sfStats.size
                } else if (subLower.endsWith('.exe')) {
                  hasExe = true
                  extractedTotalBytes += sfStats.size
                } else if (subLower.endsWith('.part') || subLower.endsWith('.downloading')) {
                  hasPartFiles = true
                } else {
                  extractedTotalBytes += sfStats.size
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (_) {}

    const isExtracted = (hasIso || hasExe || alreadyTransferred) && (rarPartsCount > 0 || completedPartsCount > 0 || hasRar)
    const canCleanRar = isExtracted && rarPartsCount > 0

    const secondsSinceLastWrite = Math.floor((now - latestMtime) / 1000)

    const cleanTitle = cleanReleaseName(item)
    const itemLower = item.toLowerCase().trim()
    const cleanLower = cleanTitle.toLowerCase().trim()

    // Jika folder ini sedang aktif/staged di streamDownloader, tugasnya sudah dilaporkan oleh streamDownloader
    // Jangan tampilkan folder sebagai duplikat di activeItems ataupun premature di readyItems
    if (incompleteStreamFolders.has(itemLower) || incompleteStreamFolders.has(cleanLower)) {
      continue
    }

    // Jika proses ekstraksi native UnRAR sedang berjalan untuk folder ini, prosesnya sudah memiliki
    // kartu khusus di hero section (activeExtractions), sehingga jangan masukkan ke readyItems atau activeItems
    const activeExt = (getActiveExtractions() || []).find(
      (e) => e.folderPath === fullPath || e.packageName?.toLowerCase() === itemLower || e.packageName?.toLowerCase() === cleanLower
    )
    if (activeExt && activeExt.status === 'extracting') {
      continue
    }

    // Tentukan Status & Hitung Metrik Download Realtime (untuk JDownloader / unduhan luar)
    let status = 'ready'
    let statusText = 'Siap Dioper ke Workbench'
    let downloadedBytes = totalSize
    let targetBytes = totalSize
    let progressPercent = 100
    let downloadSpeed = 0
    let downloadSpeedFormatted = null
    let etaSeconds = null
    let etaFormatted = null

    const jdPkg = jdPackages.get(itemLower) || jdPackages.get(cleanLower) || null
    const isJdDownloading = jdPkg && jdPkg.activeLinksCount > 0 && (hasPartFiles || secondsSinceLastWrite < 30)

    if (jdPkg && jdPkg.activeLinkName && !activePartName) {
      activePartName = jdPkg.activeLinkName
    }

    if (hasPartFiles || isJdDownloading) {
      status = 'downloading'
      const metrics = getFolderDownloadMetrics(fullPath, item, jdPkg, totalSize)
      downloadedBytes = metrics.physical
      targetBytes = metrics.logical || totalSize
      progressPercent = metrics.progressPercent
      downloadSpeed = metrics.speed
      downloadSpeedFormatted = metrics.speed > 0 ? `${formatBytes(metrics.speed)}/s` : null
      etaSeconds = metrics.etaSeconds
      etaFormatted = metrics.etaFormatted
      statusText = activePartName ? `Mengunduh (${activePartName})` : `Mengunduh (${partFilesCount || 1} part aktif)`
    } else {
      if (alreadyTransferred) {
        status = 'transferred'
        statusText = 'Sudah Dioper ke Workbench'
      }
    }

    const packageInfo = detectPackageType(fullPath)
    const uploadBase = config.uploadDir || DEFAULT_UPLOAD_DIR
    const targetInstalledPath = path.join(uploadBase, cleanTitle)
    let isInstalledInStudio = false
    let installedSize = 0

    if (fs.existsSync(targetInstalledPath)) {
      try {
        const istat = fs.statSync(targetInstalledPath)
        if (istat.isDirectory()) {
          const targetFiles = fs.readdirSync(targetInstalledPath)
          for (const tf of targetFiles) {
            try {
              installedSize += fs.statSync(path.join(targetInstalledPath, tf)).size
            } catch (_) {}
          }
          // Dianggap terpasang jika folder tidak kosong
          isInstalledInStudio = targetFiles.length > 0
        }
      } catch (_) {}
    }

    // Periksa apakah folder ini sedang aktif menjalani pipeline instalasi silent
    const activePipeline = getActiveInstallerPipeline(item) || getActiveInstallerPipeline(cleanTitle)
    const isInstalling = Boolean(activePipeline && activePipeline.status === 'running')
    // Jika sedang dalam proses instalasi aktif, statusnya BELUM matang
    if (isInstalling) {
      isInstalledInStudio = false
    }

    const gameInfo = {
      folderName: item,
      cleanTitle,
      fullPath,
      isInstalling,
      installPipeline: isInstalling ? {
        pipelineId: activePipeline.pipelineId,
        status: activePipeline.status,
        step: activePipeline.step,
        stepIndex: activePipeline.stepIndex,
        totalSteps: activePipeline.totalSteps,
        statusText: activePipeline.statusText,
        progress: activePipeline.progress || null
      } : null,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      downloadedBytes,
      downloadedBytesFormatted: formatBytes(downloadedBytes),
      targetBytes,
      targetBytesFormatted: formatBytes(targetBytes),
      progressPercent,
      downloadSpeed,
      downloadSpeedFormatted,
      etaSeconds,
      etaFormatted,
      activePartName,
      completedPartsCount,
      fileCount,
      hasIso,
      hasExe,
      hasRar,
      hasPartFiles,
      partFilesCount,
      isExtracted,
      canCleanRar,
      rarPartsCount,
      rarTotalBytes,
      rarSizeFormatted: formatBytes(rarTotalBytes),
      extractedTotalBytes,
      extractedSizeFormatted: formatBytes(extractedTotalBytes),
      mainIsoName,
      packageType: packageInfo.packageType,
      displayBadge: packageInfo.displayBadge,
      mainExecutable: packageInfo.mainExecutable,
      isInstalledInStudio,
      installedPath: isInstalledInStudio ? targetInstalledPath : null,
      installedSizeFormatted: isInstalledInStudio ? formatBytes(installedSize) : null,
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

  // Ukur sisa ruang disk di partisi targetDir
  let diskSpace = null
  try {
    if (fs.existsSync(targetDir) && typeof fs.statfsSync === 'function') {
      const statfs = fs.statfsSync(targetDir)
      const freeBytes = statfs.bavail * statfs.bsize
      const totalDiskBytes = statfs.blocks * statfs.bsize
      diskSpace = {
        freeBytes,
        freeFormatted: formatBytes(freeBytes),
        totalBytes: totalDiskBytes,
        totalFormatted: formatBytes(totalDiskBytes),
        usedPercent: totalDiskBytes > 0 ? Math.round(((totalDiskBytes - freeBytes) / totalDiskBytes) * 100) : 0
      }
    }
  } catch (_) {}

  return {
    targetDir,
    uploadDir: config.uploadDir || DEFAULT_UPLOAD_DIR,
    autoHandoff: !!config.autoHandoff,
    isRunning: checkJDownloaderRunning(),
    diskSpace,
    activeItems,
    readyItems,
    historyItems: config.history || []
  }
}

function safeMovePath(src, dst) {
  try {
    fs.renameSync(src, dst)
  } catch (err) {
    if (err.code === 'EXDEV' || err.message?.includes('cross-device')) {
      const stat = fs.statSync(src)
      if (stat.isDirectory()) {
        fs.cpSync(src, dst, { recursive: true })
        fs.rmSync(src, { recursive: true, force: true })
      } else {
        fs.copyFileSync(src, dst)
        fs.unlinkSync(src)
      }
    } else {
      throw err
    }
  }
}

// ── 6. Handoff: Pindahkan Folder ke GameUpload & Masukkan Antrean Workbench ──
export async function executeHandoff(folderName, options = {}) {
  const config = getDownloadConfig()
  const sourceBase = config.downloadDir || DEFAULT_DOWNLOAD_DIR
  const targetBase = config.uploadDir || DEFAULT_UPLOAD_DIR

  const sourcePath = path.join(sourceBase, folderName)

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Folder game sumber tidak ditemukan: ${sourcePath}`)
  }

  // Pastikan folder tidak sedang aktif diunduh (hanya block jika status 'downloading' atau 'queued')
  const streamTasks = globalThis.__mygameonStreamDownloader ? globalThis.__mygameonStreamDownloader.getTasks() : []
  const isStillDownloading = streamTasks.some(
    (t) => (t.status === 'downloading' || t.status === 'queued') && (
      (t.packageName && t.packageName.toLowerCase() === folderName.toLowerCase()) ||
      (t.filename && t.filename.toLowerCase() === folderName.toLowerCase()) ||
      (t.customDir && path.basename(t.customDir).toLowerCase() === folderName.toLowerCase())
    )
  )
  if (isStillDownloading) {
    throw new Error(`Folder "${folderName}" masih aktif dalam antrean unduhan dan belum selesai sepenuhnya.`)
  }

  const isExtracting = (getActiveExtractions() || []).some(
    (e) => e.status === 'extracting' && (
      e.folderPath === sourcePath ||
      (e.packageName && e.packageName.toLowerCase() === folderName.toLowerCase())
    )
  )
  if (isExtracting) {
    throw new Error(`Folder "${folderName}" masih dalam proses ekstraksi UnRAR. Mohon tunggu hingga 100% selesai.`)
  }

  if (!fs.existsSync(targetBase)) {
    fs.mkdirSync(targetBase, { recursive: true })
  }

  const sourceStats = fs.statSync(sourcePath)

  // 1. Bersihkan nama judul game (hapus tag rilis seperti MULTi7-ElAmigos, CODEX, dll dan ekstensi file jika ada)
  const cleanTitle = folderName
    .replace(/\.(rar|zip|7z|iso|exe)$/i, '')
    .replace(/[-_.](MULTi\d+|ElAmigos|CODEX|RUNE|TENOKE|FitGirl|DODI|Repack|SKIDROW|FLT|GoldBerg)/gi, '')
    .replace(/[._]/g, ' ')
    .trim()

  let finalTargetPath = path.join(targetBase, folderName)

  if (sourceStats.isFile()) {
    // Jika berkas tunggal (.rar, .iso, .exe), bungkus ke dalam folder game tersendiri di GameUpload
    const folderForGame = path.join(targetBase, cleanTitle)
    if (!fs.existsSync(folderForGame)) {
      fs.mkdirSync(folderForGame, { recursive: true })
    }
    const destFilePath = path.join(folderForGame, folderName)
    if (fs.existsSync(destFilePath)) {
      try { fs.unlinkSync(destFilePath) } catch (_) {}
    }
    safeMovePath(sourcePath, destFilePath)
    finalTargetPath = folderForGame
  } else {
    // Jika berupa folder, pindahkan folder langsung ke GameUpload
    if (sourcePath.toLowerCase() !== finalTargetPath.toLowerCase()) {
      if (fs.existsSync(finalTargetPath)) {
        if (options.cleanReplace !== false) {
          fs.rmSync(finalTargetPath, { recursive: true, force: true })
        } else {
          throw new Error(`Folder dengan nama yang sama sudah ada di GameUpload: ${finalTargetPath}`)
        }
      }
      safeMovePath(sourcePath, finalTargetPath)
    }
  }

  // 2. Sanitasi file sampah pihak ketiga & Injeksi branding resmi MyGameON
  const sanitizeResult = sanitizeAndBrandGameFolder(finalTargetPath, cleanTitle)

  // 3. Ambil informasi folder di target (setelah disanitasi & di-branding)
  const targetStats = fs.statSync(finalTargetPath)
  const targetFiles = fs.readdirSync(finalTargetPath)
  let totalSize = 0
  for (const f of targetFiles) {
    try {
      totalSize += fs.statSync(path.join(finalTargetPath, f)).size
    } catch (_) {}
  }

  // 4. Masukkan otomatis ke antrean Upload Studio (POST /api/studio/queue)
  const queue = getStudioQueue()
  const queueItemId = `queue_${Date.now()}_${Math.floor(Math.random() * 1000)}`

  const newQueueItem = {
    id: queueItemId,
    folder: {
      name: path.basename(finalTargetPath),
      path: finalTargetPath,
      size: totalSize,
      sizeFormatted: formatBytes(totalSize),
      hasArchive: false,
      archiveParts: 0,
      isArchiveFile: sourceStats.isFile()
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
    targetPath: finalTargetPath,
    finalTargetPath,
    cleanTitle,
    packageType: sanitizeResult.packageType,
    displayBadge: sanitizeResult.displayBadge,
    deletedFiles: sanitizeResult.deletedFiles,
    addedFiles: sanitizeResult.addedFiles,
    queueItem: newQueueItem
  }
}
