import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

export async function POST(request) {
  try {
    const { email, cart, expirationTime } = await request.json()

    if (!email || !cart || cart.length === 0) {
      return NextResponse.json({ error: 'Email dan cart wajib diisi' }, { status: 400 })
    }

    const { drive, gmail, sheets } = await getGoogleClients()
    const folderId = process.env.GDRIVE_FOLDER_ID
    const sheetId = process.env.GSHEET_ID
    const report = []
    const successItems = []

    for (const item of cart) {
      try {
        const q = `'${folderId}' in parents and name = '${item.name.replace(/'/g, "\\'")}' and trashed = false`
        const searchRes = await drive.files.list({
          q,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          pageSize: 100,
          fields: 'files(id, name, mimeType, shortcutDetails)',
        })

        const matches = searchRes.data.files || []
        if (matches.length === 0) {
          report.push({ name: item.name, status: 'error', message: 'File tidak ditemukan' })
          continue
        }

        const picked = matches[Math.floor(Math.random() * matches.length)]
        let realId = picked.id
        if (picked.mimeType === 'application/vnd.google-apps.shortcut' && picked.shortcutDetails) {
          realId = picked.shortcutDetails.targetId
        }

        // Share akses — tanpa expiration (tidak support di Shared Drive)
        const permRes = await drive.permissions.create({
          fileId: realId,
          supportsAllDrives: true,
          sendNotificationEmail: false,
          requestBody: {
            role: 'reader',
            type: 'user',
            emailAddress: email,
          },
        })

        const permissionId = permRes.data.id

        // Log ke Sheet1 (log umum)
        try {
          let ownerEmail = 'Unknown'
          try {
            const fileInfo = await drive.files.get({
              fileId: realId,
              fields: 'owners',
              supportsAllDrives: true,
            })
            if (fileInfo.data.owners?.length > 0) {
              ownerEmail = fileInfo.data.owners[0].emailAddress
            }
          } catch (e) {
            ownerEmail = 'Hidden'
          }

          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Sheet1!A:D',
            valueInputOption: 'RAW',
            requestBody: {
              values: [[new Date().toISOString(), email, item.name, ownerEmail]],
            },
          })
        } catch (e) {
          console.error('Log error:', e.message)
        }

        // Catat ke ExpiringAccess hanya jika ada expiration
        if (expirationTime && permissionId) {
          try {
            await sheets.spreadsheets.values.append({
              spreadsheetId: sheetId,
              range: 'ExpiringAccess!A:F',
              valueInputOption: 'RAW',
              requestBody: {
                values: [[
                  email,
                  realId,
                  permissionId,
                  item.name,
                  expirationTime,
                  'active',
                ]],
              },
            })
          } catch (e) {
            console.error('ExpiringAccess log error:', e.message)
          }
        }

        successItems.push({ name: item.name, realId, expirationTime })
        report.push({ name: item.name, status: 'success' })

      } catch (e) {
        report.push({ name: item.name, status: 'error', message: e.message })
      }
    }

    if (successItems.length > 0) {
      try {
        await sendPurchaseEmail(gmail, email, successItems)
      } catch (e) {
        console.error('Email error:', e.message)
      }
    }

    return NextResponse.json({ report })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Send error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function sendPurchaseEmail(gmail, toEmail, successItems) {
  let emailList = ''
  for (const item of successItems) {
    const expiryNote = item.expirationTime
      ? `<br><i style="color:#e67e22;">⏱ Akses berlaku hingga: ${new Date(item.expirationTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</i>`
      : ''

    emailList += `
      <b>🎮 ${item.name}</b><br>
      Link: <a href="https://drive.google.com/open?id=${item.realId}">Klik Disini untuk Download</a>
      ${expiryNote}<br><br>
    `
  }

  const subject = '✅ Orderan MyGameON: Akses Game Siap!'
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;color:#333;max-width:600px;border:1px solid #ddd;padding:20px;border-radius:10px;">
      <h2 style="color:#2E86C1;">Terima Kasih sudah Order di MyGameON!</h2>
      <p>Halo Kak,</p>
      <p>Pesanan game kakak sudah kami proses. Berikut adalah akses Google Drive khusus untuk kakak:</p>
      <hr>
      ${emailList}
      <hr>
      <h3>⚠️ PENTING: Langkah Selanjutnya</h3>
      <ol>
        <li style="margin-bottom:10px;">Download <b>SEMUA PART</b> secara <b>SATU PER SATU</b> (Bergantian).<br>
        <i style="color:#d35400;">Jangan download semua file sekaligus!</i></li>
        <li style="margin-bottom:10px;"><b>PENTING SOAL ANTIVIRUS:</b> Buat <b>Folder Exclusion</b> agar file aman.</li>
        <li>Wajib tonton <b>VIDEO TUTORIAL</b> agar 100% Work.</li>
      </ol>
      <p style="font-size:12px;color:#777;"><i>Email ini dikirim otomatis oleh sistem MyGameON.</i></p>
    </div>
  `

  const rawMessage = [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ].join('\r\n')

  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  })
}