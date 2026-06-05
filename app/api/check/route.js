import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const FILE_LIST_CAP = 300 // batas nama file per folder yang dikirim ke client

function fmtSize(bytes) {
  if (!bytes) return '0 MB'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(2)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

// Semua file non-folder di dalam parent (paginated, akurat untuk >1000 file)
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

function pack(files) {
  const bytes = files.reduce((s, f) => s + f.bytes, 0)
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return {
    count: files.length,
    bytes,
    size: fmtSize(bytes),
    files: sorted.slice(0, FILE_LIST_CAP).map(f => ({ name: f.name, size: fmtSize(f.bytes) })),
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')
    if (!fileId) {
      return NextResponse.json({ error: 'File ID wajib diisi' }, { status: 400 })
    }

    const { drive } = await getGoogleClients()

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

    // Root files + daftar subfolder secara paralel
    const [rootFiles, folders] = await Promise.all([
      listFiles(drive, targetId),
      listFolders(drive, targetId),
    ])

    // Hitung tiap subfolder paralel (bukan N+1 sekuensial)
    const subfolders = await Promise.all(
      folders.map(async (f) => ({ name: f.name, ...pack(await listFiles(drive, f.id)) }))
    )

    const root = pack(rootFiles)
    const totalBytes = root.bytes + subfolders.reduce((s, sf) => s + sf.bytes, 0)
    const totalCount = root.count + subfolders.reduce((s, sf) => s + sf.count, 0)

    return NextResponse.json({
      name: file.name,
      driveUrl: `https://drive.google.com/drive/folders/${targetId}`,
      root,
      subfolders,
      total: { count: totalCount, bytes: totalBytes, size: fmtSize(totalBytes) },
    })
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
