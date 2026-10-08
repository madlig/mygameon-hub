import { NextResponse } from 'next/server'
import { getGoogleClients, getClientForEmail } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

async function listFiles(drive, parentId) {
  const files = []
  let pageToken
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1000,
      pageToken,
      fields: 'nextPageToken, files(name, size)',
    })
    for (const f of res.data.files || []) {
      files.push({ name: f.name, bytes: f.size ? parseInt(f.size) : 0 })
    }
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return files
}

async function listFolders(drive, parentId) {
  const folders = []
  let pageToken
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1000,
      pageToken,
      fields: 'nextPageToken, files(id, name)',
    })
    for (const f of res.data.files || []) folders.push({ id: f.id, name: f.name })
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return folders
}

/**
 * GET: Cek status jumlah game yang sudah vs belum terhitung ukuran filenya
 */
export async function GET() {
  try {
    const { session } = await getGoogleClients()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const totalGames = await GameCatalog.countDocuments()
    const unscannedCount = await GameCatalog.countDocuments({
      $or: [
        { totalSize: { $lte: 0 } },
        { totalSize: null },
        { fileCount: { $lte: 0 } },
        { fileCount: null },
      ]
    })
    const scannedCount = Math.max(0, totalGames - unscannedCount)

    return NextResponse.json({
      totalGames,
      unscannedCount,
      scannedCount,
      allScanned: unscannedCount === 0
    })
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST: Scan ukuran file secara bertahap (batch ter-throttle)
 * Menggunakan jeda 250ms per folder agar aman dari kuota 1000 req / 100s Google Drive
 */
export async function POST(req) {
  try {
    const { session, drive: adminDrive } = await getGoogleClients()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const body = await req.json().catch(() => ({}))
    const limit = Math.min(Math.max(parseInt(body.limit) || 20, 1), 35)
    const priorityNames = Array.isArray(body.names) ? body.names.filter(n => typeof n === 'string' && n.trim()) : []

    const query = {
      $or: [
        { totalSize: { $lte: 0 } },
        { totalSize: null },
      ]
    }

    let unscannedItems = []

    // 1. Prioritaskan game yang sedang tampil di layar operator
    if (priorityNames.length > 0) {
      unscannedItems = await GameCatalog.find({
        name: { $in: priorityNames },
        ...query
      }).limit(limit).lean()
    }

    // 2. Jika kuota batch masih ada, ambil game unscanned umum lainnya
    if (unscannedItems.length < limit) {
      const remainingQuota = limit - unscannedItems.length
      const existingNames = new Set(unscannedItems.map(i => i.name))
      const generalItems = await GameCatalog.find({
        name: { $nin: Array.from(existingNames) },
        ...query
      }).limit(remainingQuota).lean()
      unscannedItems.push(...generalItems)
    }

    if (unscannedItems.length === 0) {
      return NextResponse.json({
        success: true,
        scanned: 0,
        remaining: 0,
        message: 'Semua game di katalog sudah memiliki data ukuran file.'
      })
    }

    let processedCount = 0
    const processedNames = new Set()

    for (const item of unscannedItems) {
      if (processedNames.has(item.name)) continue
      processedNames.add(item.name)

      try {
        let drive = adminDrive
        if (item.ownerEmail) {
          try {
            drive = await getClientForEmail(item.ownerEmail)
          } catch (_) {
            drive = adminDrive
          }
        }

        let targetId = item.folderId
        // Cek shortcut
        try {
          const fileRes = await drive.files.get({
            fileId: targetId,
            fields: 'id, name, mimeType, shortcutDetails',
            supportsAllDrives: true,
          })
          if (fileRes.data.mimeType === 'application/vnd.google-apps.shortcut' && fileRes.data.shortcutDetails) {
            targetId = fileRes.data.shortcutDetails.targetId
          }
        } catch (fetchErr) {
          // Jika folder tidak ditemukan / 404, tandai ukuran 1 byte khusus agar tidak discan berulang
          if (fetchErr.code === 404 || fetchErr.message?.includes('not found')) {
            await GameCatalog.updateMany(
              { name: item.name },
              { $set: { totalSize: 1, fileCount: 0 } }
            )
          }
          continue
        }

        // Ambil root files & subfolders
        const [rootFiles, folders] = await Promise.all([
          listFiles(drive, targetId),
          listFolders(drive, targetId),
        ])

        let totalBytes = rootFiles.reduce((s, f) => s + f.bytes, 0)
        let totalCount = rootFiles.length

        for (const sub of folders) {
          const sfFiles = await listFiles(drive, sub.id)
          totalBytes += sfFiles.reduce((s, f) => s + f.bytes, 0)
          totalCount += sfFiles.length
          // Jeda micro-throttle
          await new Promise(r => setTimeout(r, 60))
        }

        // Update database (semua workspace yang memiliki game ini)
        await GameCatalog.updateMany(
          { name: item.name },
          { $set: { totalSize: Math.max(totalBytes, 1), fileCount: totalCount } }
        )

        processedCount++

        // Jeda throttle antar game untuk keamanan rate limit Google Drive
        await new Promise(r => setTimeout(r, 200))

      } catch (gameErr) {
        console.warn(`[scan-sizes] Gagal memindai ukuran untuk ${item.name}:`, gameErr.message)
      }
    }

    const remainingCount = await GameCatalog.countDocuments({
      $or: [
        { totalSize: { $lte: 0 } },
        { totalSize: null },
      ]
    })

    return NextResponse.json({
      success: true,
      processed: processedCount,
      remaining: remainingCount,
      allScanned: remainingCount === 0
    })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
