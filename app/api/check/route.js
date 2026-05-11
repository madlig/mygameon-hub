import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json({ error: 'File ID wajib diisi' }, { status: 400 })
    }

    const { drive } = await getGoogleClients()

    // Ambil info file
    const fileRes = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, shortcutDetails',
      supportsAllDrives: true,
    })

    const file = fileRes.data
    let targetId = file.id
    if (file.mimeType === 'application/vnd.google-apps.shortcut' && file.shortcutDetails) {
      targetId = file.shortcutDetails.targetId
    }

    // Hitung file di root folder
    const rootStats = await calcStats(drive, `'${targetId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`)

    // Cari subfolder
    const subRes = await drive.files.list({
      q: `'${targetId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name)',
    })

    const subfolders = []
    for (const sub of subRes.data.files || []) {
      const stats = await calcStats(drive, `'${sub.id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`)
      subfolders.push({ name: sub.name, ...stats })
    }

    return NextResponse.json({
      name: file.name,
      root: rootStats,
      subfolders,
    })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function calcStats(drive, q) {
  const res = await drive.files.list({
    q,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1000,
    fields: 'files(size)',
  })

  const files = res.data.files || []
  let totalBytes = 0
  for (const f of files) {
    if (f.size) totalBytes += parseInt(f.size)
  }

  const mb = totalBytes / (1024 * 1024)
  const sizeStr = mb >= 1024
    ? (mb / 1024).toFixed(2) + ' GB'
    : mb.toFixed(2) + ' MB'

  return { count: files.length, size: sizeStr }
}