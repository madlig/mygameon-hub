import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import { parseSheetDate } from '@/lib/utils'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    const emailLower = email.toLowerCase()
    const safeEmail = email.replace(/'/g, "\\'") // cegah query injection
    const { drive, sheets } = await getGoogleClients()

    // Scan Drive (paginated) + baca sheet konteks paralel
    const drivePromise = (async () => {
      const files = []
      let pageToken
      do {
        const res = await drive.files.list({
          q: `'${safeEmail}' in readers and mimeType = '${FOLDER_MIME}' and trashed = false`,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          pageSize: 100,
          pageToken,
          fields: 'nextPageToken, files(id, name, permissions(id, emailAddress))',
        })
        for (const f of res.data.files || []) files.push(f)
        pageToken = res.data.nextPageToken
      } while (pageToken)
      return files
    })()

    const sheetPromise = (async () => {
      try {
        const [logRes, expRes] = await Promise.all([
          sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_ID, range: 'Sheet1!A:D', valueRenderOption: 'UNFORMATTED_VALUE' }),
          sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_ID, range: 'ExpiringAccess!A:F' }),
        ])
        return { log: logRes.data.values || [], exp: expRes.data.values || [] }
      } catch (e) {
        return { log: [], exp: [] }
      }
    })()

    const [files, sheetData] = await Promise.all([drivePromise, sheetPromise])

    // Map kapan diberikan: email|namaFolder -> grantedAt (ISO terbaru)
    const grantedMap = new Map()
    for (const row of sheetData.log) {
      const e = (row[1] || '').toLowerCase()
      const name = (row[2] || '').toLowerCase()
      const t = parseSheetDate(row[0])
      if (!e || !name || !t) continue
      const key = `${e}|${name}`
      const prev = grantedMap.get(key)
      if (!prev || new Date(t) > new Date(prev)) grantedMap.set(key, t)
    }

    // Map kadaluarsa: email|fileId -> { expiresAt, status }
    const expMap = new Map()
    for (const row of sheetData.exp) {
      const e = (row[0] || '').toLowerCase()
      const fid = row[1]
      if (!e || !fid) continue
      expMap.set(`${e}|${fid}`, { expiresAt: row[4] || null, status: (row[5] || '').toLowerCase() })
    }

    const accessList = []
    for (const file of files) {
      if (!file.permissions) continue
      const perm = file.permissions.find(p => p.emailAddress?.toLowerCase() === emailLower)
      if (!perm) continue
      const exp = expMap.get(`${emailLower}|${file.id}`) || null
      accessList.push({
        fileId: file.id,
        fileName: file.name,
        permissionId: perm.id,
        grantedAt: grantedMap.get(`${emailLower}|${(file.name || '').toLowerCase()}`) || null,
        expiresAt: exp?.expiresAt || null,
        tracked: !!exp,
        sheetStatus: exp?.status || null,
      })
    }

    return NextResponse.json({ accessList })
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Revoke scan error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { email, items } = await request.json()
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Tidak ada akses yang dipilih' }, { status: 400 })
    }

    const { drive, sheets } = await getGoogleClients()

    const results = []
    for (const item of items) {
      if (!item.fileId || !item.permissionId) {
        results.push({ fileId: item.fileId, fileName: item.fileName, status: 'error', message: 'Parameter tidak lengkap' })
        continue
      }
      try {
        await drive.permissions.delete({
          fileId: item.fileId,
          permissionId: item.permissionId,
          supportsAllDrives: true,
        })
        results.push({ fileId: item.fileId, fileName: item.fileName, status: 'success' })
      } catch (e) {
        results.push({ fileId: item.fileId, fileName: item.fileName, status: 'error', message: e.message })
      }
    }

    // Sinkronkan ExpiringAccess → 'revoked' untuk yang berhasil dicabut
    const okIds = new Set(results.filter(r => r.status === 'success').map(r => r.fileId))
    if (email && okIds.size > 0) {
      try {
        const expRes = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GSHEET_ID,
          range: 'ExpiringAccess!A:F',
        })
        const rows = expRes.data.values || []
        const emailLower = email.toLowerCase()
        const updates = []
        rows.forEach((row, i) => {
          const e = (row[0] || '').toLowerCase()
          const fid = row[1]
          const status = (row[5] || '').toLowerCase()
          if (e === emailLower && okIds.has(fid) && status === 'active') {
            updates.push({ range: `ExpiringAccess!F${i + 1}`, values: [['revoked']] })
          }
        })
        if (updates.length > 0) {
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: process.env.GSHEET_ID,
            requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
          })
        }
      } catch (e) {
        console.error('Sync ExpiringAccess error:', e.message)
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
