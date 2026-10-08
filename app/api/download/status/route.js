import path from 'path'
import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { scanDownloadDirectory, getDownloadConfig, saveDownloadConfig, formatBytes } from '@/lib/downloadWatcher'
import { streamDownloader } from '@/lib/streamDownloader'
import { getCNLStatus } from '@/lib/cnlServer'
import { getActiveExtractions } from '@/lib/extractor'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await scanDownloadDirectory()
    const streamTasks = streamDownloader.getTasks()
    const extractions = getActiveExtractions()
    const cnlStatus = getCNLStatus()

    // Format task native streamDownloader ke bentuk item unduhan aktif (termasuk yang queued)
    const activeStreamItems = streamTasks
      .filter((t) => t.status === 'downloading' || t.status === 'queued' || t.status === 'paused' || t.status === 'error')
      .map((t) => ({
        id: t.id,
        folderName: t.filename,
        cleanTitle: t.cleanTitle || t.filename,
        packageName: t.packageName || null,
        fullPath: t.filePath,
        totalSize: t.totalBytes || 0,
        totalSizeFormatted: t.totalBytesFormatted,
        downloadedBytes: t.downloadedBytes || 0,
        downloadedBytesFormatted: t.downloadedBytesFormatted,
        targetBytes: t.totalBytes || 0,
        targetBytesFormatted: t.totalBytesFormatted,
        progressPercent: t.progressPercent || 0,
        downloadSpeed: t.speed || 0,
        downloadSpeedFormatted: t.speedFormatted,
        etaSeconds: null,
        etaFormatted: t.status === 'queued' ? 'Menunggu antrean...' : t.etaFormatted,
        activePartName: null,
        completedPartsCount: 0,
        fileCount: 1,
        packageType: t.filename.toLowerCase().endsWith('.iso') ? 'ISO' : 'ARCHIVE',
        displayBadge: t.packageName ? 'MULTI-PART' : 'NATIVE STREAM',
        status: t.status, // 'downloading' | 'queued' | 'paused' | 'error'
        statusText: t.status === 'queued'
          ? 'Antrean'
          : t.status === 'paused'
          ? 'Dijeda'
          : t.status === 'error'
          ? `Gagal: ${t.error}`
          : 'Sedang Mengunduh',
        isNativeStream: true,
        error: t.error,
        url: t.url,
        lastModified: new Date(t.startTime).toISOString(),
        secondsSinceLastWrite: 0
      }))

    // Format item yang sedang ditampung (staged)
    const stagedTasks = streamTasks.filter((t) => t.status === 'staged')
    const stagedMap = new Map()

    for (const task of stagedTasks) {
      const groupKey = task.packageName || task.id
      if (!stagedMap.has(groupKey)) {
        stagedMap.set(groupKey, {
          key: groupKey,
          packageName: task.packageName || task.cleanTitle || task.filename,
          isPackage: !!task.packageName,
          customDir: task.customDir,
          createdAt: task.startTime,
          items: []
        })
      }
      stagedMap.get(groupKey).items.push({
        id: task.id,
        filename: task.filename,
        cleanTitle: task.cleanTitle || task.filename,
        url: task.url,
        totalBytes: task.totalBytes || 0,
        totalBytesFormatted: task.totalBytesFormatted,
        status: task.status,
        etaFormatted: task.etaFormatted,
        password: task.password
      })
    }

    const stagedPackages = Array.from(stagedMap.values()).map((pkg) => {
      const totalEstimatedBytes = pkg.items.reduce((acc, cur) => acc + (cur.totalBytes || 0), 0)
      return {
        key: pkg.key,
        packageName: pkg.packageName,
        isPackage: pkg.isPackage,
        partsCount: pkg.items.length,
        totalBytes: totalEstimatedBytes,
        totalBytesFormatted: totalEstimatedBytes > 0 ? formatBytes(totalEstimatedBytes) : null,
        items: pkg.items,
        firstUrl: pkg.items[0]?.url,
        createdAt: pkg.createdAt,
        password: pkg.items[0]?.password || 'mygameon'
      }
    })

    // Hindari duplikasi jika nama berkas atau paket sudah ada di streamDownloader
    const existingActiveNames = new Set()
    for (const item of activeStreamItems) {
      if (item.folderName) existingActiveNames.add(item.folderName.toLowerCase().trim())
      if (item.packageName) existingActiveNames.add(item.packageName.toLowerCase().trim())
      if (item.cleanTitle) existingActiveNames.add(item.cleanTitle.toLowerCase().trim())
    }
    for (const pkg of stagedPackages) {
      if (pkg.packageName) existingActiveNames.add(pkg.packageName.toLowerCase().trim())
      if (pkg.key) existingActiveNames.add(pkg.key.toLowerCase().trim())
    }
    for (const t of streamTasks) {
      if (t.filename) existingActiveNames.add(t.filename.toLowerCase().trim())
      if (t.packageName) existingActiveNames.add(t.packageName.toLowerCase().trim())
      if (t.cleanTitle) existingActiveNames.add(t.cleanTitle.toLowerCase().trim())
      if (t.customDir) existingActiveNames.add(path.basename(t.customDir).toLowerCase().trim())
    }

    const filteredJdActive = (data.activeItems || []).filter((item) => {
      const name = (item.folderName || '').toLowerCase().trim()
      const title = (item.cleanTitle || '').toLowerCase().trim()
      return !existingActiveNames.has(name) && !existingActiveNames.has(title)
    })

    // Filter readyItems agar folder paket yang masih memiliki task aktif/staged/paused di streamDownloader
    // atau sedang diekstrak tidak masuk ke readyItems sebelum waktunya
    const incompletePackageNames = new Set(
      streamTasks
        .filter((t) => t.status !== 'completed')
        .flatMap((t) => [
          (t.packageName || '').toLowerCase().trim(),
          (t.filename || '').toLowerCase().trim(),
          (t.cleanTitle || '').toLowerCase().trim(),
          t.customDir ? path.basename(t.customDir).toLowerCase().trim() : ''
        ])
        .filter(Boolean)
    )

    const extractingPackageNames = new Set(
      (extractions || [])
        .filter((e) => e.status === 'extracting')
        .flatMap((e) => [
          (e.packageName || '').toLowerCase().trim(),
          e.folderPath ? path.basename(e.folderPath).toLowerCase().trim() : ''
        ])
        .filter(Boolean)
    )

    const filteredReady = (data.readyItems || []).filter((item) => {
      const name = (item.folderName || '').toLowerCase().trim()
      const title = (item.cleanTitle || '').toLowerCase().trim()
      if (incompletePackageNames.has(name) || incompletePackageNames.has(title)) return false
      if (extractingPackageNames.has(name) || extractingPackageNames.has(title)) return false
      return true
    })

    // Sematkan password otomatis ke item siap ekstrak (dari task stream atau pola situs)
    for (const item of filteredReady) {
      const match = streamTasks.find((t) =>
        (t.filename && item.folderName && t.filename.toLowerCase() === item.folderName.toLowerCase()) ||
        (t.cleanTitle && item.cleanTitle && t.cleanTitle.toLowerCase() === item.cleanTitle.toLowerCase()) ||
        (t.packageName && item.cleanTitle && t.packageName.toLowerCase() === item.cleanTitle.toLowerCase()) ||
        (t.customDir && path.basename(t.customDir).toLowerCase() === item.folderName.toLowerCase())
      )
      if (match?.password) {
        item.password = match.password
      } else if (item.folderName?.toLowerCase().includes('ova') || item.cleanTitle?.toLowerCase().includes('ova')) {
        item.password = 'www.ovagames.com'
      } else {
        item.password = 'mygameon'
      }
    }

    // ── Buat Kelompok Parent-Child untuk Antrean Unduhan Berjalan ──
    const groupMap = new Map()

    for (const item of activeStreamItems) {
      const groupKey = item.packageName || item.id
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          key: groupKey,
          packageName: item.packageName || item.cleanTitle || item.folderName,
          cleanTitle: item.packageName || item.cleanTitle || item.folderName,
          isPackage: !!item.packageName,
          customDir: item.fullPath ? path.dirname(item.fullPath) : null,
          packageType: item.packageType || 'ARCHIVE',
          displayBadge: item.packageName ? 'MULTI-PART' : item.displayBadge || 'NATIVE STREAM',
          items: []
        })
      }
      groupMap.get(groupKey).items.push(item)
    }

    for (const item of filteredJdActive) {
      const groupKey = item.folderName
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          key: groupKey,
          packageName: item.cleanTitle || item.folderName,
          cleanTitle: item.cleanTitle || item.folderName,
          isPackage: false,
          customDir: item.fullPath,
          packageType: item.packageType || 'ARCHIVE',
          displayBadge: item.displayBadge || 'JDOWNLOADER',
          items: [item]
        })
      }
    }

    const activeGroups = Array.from(groupMap.values()).map((grp) => {
      const totalBytes = grp.items.reduce((acc, cur) => acc + (cur.totalSize || cur.targetBytes || 0), 0)
      const downloadedBytes = grp.items.reduce((acc, cur) => acc + (cur.downloadedBytes || 0), 0)
      const downloadSpeed = grp.items.reduce((acc, cur) => acc + (cur.downloadSpeed || 0), 0)

      const progressPercent = totalBytes > 0
        ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10)
        : (grp.items[0]?.progressPercent || 0)

      const isDownloading = grp.items.some((i) => i.status === 'downloading')
      const isQueued = grp.items.some((i) => i.status === 'queued')
      const isPaused = grp.items.every((i) => i.status === 'paused')
      const isError = grp.items.some((i) => i.status === 'error')
      const firstErrorItem = grp.items.find((i) => i.status === 'error' && i.error)
      const groupError = firstErrorItem ? firstErrorItem.error : null

      const activePart = grp.items.find((i) => i.status === 'downloading') || grp.items.find((i) => i.status === 'queued')
      const activePartName = activePart ? activePart.folderName : null
      const activePartIndex = activePart ? grp.items.indexOf(activePart) + 1 : 1

      let status = 'paused'
      let statusText = 'Dijeda'
      if (isDownloading) {
        status = 'downloading'
        statusText = grp.isPackage
          ? `Sedang Mengunduh (Part ${activePartIndex}/${grp.items.length})`
          : 'Sedang Mengunduh'
      } else if (isQueued) {
        status = 'queued'
        statusText = 'Antrean'
      } else if (isError) {
        status = 'error'
        statusText = 'Gagal'
      }

      let etaSeconds = null
      let etaFormatted = null
      if (downloadSpeed > 1024 && totalBytes > downloadedBytes) {
        etaSeconds = Math.round((totalBytes - downloadedBytes) / downloadSpeed)
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

      return {
        ...grp,
        error: groupError,
        partsCount: grp.items.length,
        totalBytes,
        totalBytesFormatted: formatBytes(totalBytes),
        downloadedBytes,
        downloadedBytesFormatted: formatBytes(downloadedBytes),
        progressPercent,
        downloadSpeed,
        downloadSpeedFormatted: downloadSpeed > 0 ? `${formatBytes(downloadSpeed)}/s` : null,
        etaSeconds,
        etaFormatted: isDownloading ? etaFormatted : (isPaused ? '[Dijeda]' : 'Menunggu antrean...'),
        status,
        statusText,
        activePartName,
        activePartIndex
      }
    })

    data.activeItems = [...activeStreamItems, ...filteredJdActive]
    data.activeGroups = activeGroups
    data.readyItems = filteredReady
    data.stagedPackages = stagedPackages
    data.stagedItems = stagedTasks
    data.streamTasks = streamTasks
    data.activeExtractions = extractions
    data.cnlStatus = cnlStatus
    data.maxConcurrent = getDownloadConfig().maxConcurrent || 1

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const currentConfig = getDownloadConfig()

    const newConfig = {
      ...currentConfig,
      ...body
    }

    const saved = saveDownloadConfig(newConfig)
    return NextResponse.json({ success: true, config: saved })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
