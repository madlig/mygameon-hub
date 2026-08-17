import { NextResponse } from 'next/server'
import { getGoogleClients, getClientForEmail } from '@/lib/googleClient'
import { parseSheetDate } from '@/lib/utils'
import connectToDatabase from '@/lib/db'
import WorkspaceAccount from '@/models/WorkspaceAccount'
import GameCatalog from '@/models/GameCatalog'

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
    
    // Admin client untuk Sheets (konteks log)
    const { sheets } = await getGoogleClients()

    await connectToDatabase()
    
    // Ambil semua workspace yang aktif
    const accounts = await WorkspaceAccount.find({ status: 'active' })

    // Scan setiap workspace secara paralel untuk mencari permissions email customer
    const drivePromise = (async () => {
      const allFiles = []
      
      // Query untuk mencari folder asli atau shortcut lama
      const query = `'${safeEmail}' in readers and (mimeType = '${FOLDER_MIME}' or mimeType = 'application/vnd.google-apps.shortcut') and trashed = false`

      // Tambahkan adminDrive ke dalam daftar yang harus di-scan
      const { drive: adminDrive, session } = await getGoogleClients()
      const adminEmail = session?.user?.email || 'admin'

      const scanDrive = async (driveClient, ownerEmail) => {
        let pageToken
        do {
          const res = await driveClient.files.list({
            q: query,
            pageSize: 100,
            pageToken,
            fields: 'nextPageToken, files(id, name, permissions(id, emailAddress))',
          })
          for (const f of res.data.files || []) {
            f._ownerEmail = ownerEmail
            allFiles.push(f)
          }
          pageToken = res.data.nextPageToken
        } while (pageToken)
      }

      const promises = accounts.map(async (acc) => {
        try {
          const drive = await getClientForEmail(acc.email)
          await scanDrive(drive, acc.email)
        } catch (e) {
          console.error(`Revoke scan error for ${acc.email}:`, e.message)
        }
      })

      // Scan admin drive juga
      promises.push(scanDrive(adminDrive, adminEmail).catch(e => console.error('Admin drive scan error:', e.message)))

      await Promise.all(promises)
      
      return allFiles
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

    // Deduplikasi: jika file yang sama terdeteksi dari beberapa workspace, ambil yang pertama
    const seenFileIds = new Set()
    const uniqueFiles = files.filter(f => {
      if (seenFileIds.has(f.id)) return false
      seenFileIds.add(f.id)
      return true
    })

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
    for (const file of uniqueFiles) {
      if (!file.permissions) continue
      const perm = file.permissions.find(p => p.emailAddress?.toLowerCase() === emailLower)
      if (!perm) continue
      const exp = expMap.get(`${emailLower}|${file.id}`) || null
      accessList.push({
        fileId: file.id,
        fileName: file.name,
        permissionId: perm.id,
        ownerEmail: file._ownerEmail, // BARU: workspace pemilik
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

    const { sheets } = await getGoogleClients()
    await connectToDatabase()

    const results = []
    for (const item of items) {
      if (!item.fileId || !item.permissionId) {
        results.push({ fileId: item.fileId, fileName: item.fileName, status: 'error', message: 'Parameter tidak lengkap' })
        continue
      }
      try {
        // Gunakan workspace pemilik untuk revoke
        let drive
        if (item.ownerEmail === 'admin' || !item.ownerEmail) {
          const clients = await getGoogleClients()
          drive = clients.drive
        } else {
          try {
            drive = await getClientForEmail(item.ownerEmail)
          } catch (e) {
            // Fallback: cari di katalog
            const game = await GameCatalog.findOne({ folderId: item.fileId }).lean()
            if (game?.ownerEmail) {
              drive = await getClientForEmail(game.ownerEmail)
            } else {
              const clients = await getGoogleClients()
              drive = clients.drive
            }
          }

        }

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
