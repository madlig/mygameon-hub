import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import { getClientForEmail } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

export async function POST(request) {
  try {
    const { email, cart, expirationTime, isBonus } = await request.json()

    if (!email || !cart || cart.length === 0) {
      return NextResponse.json({ error: 'Email dan cart wajib diisi' }, { status: 400 })
    }

    // Admin clients: untuk Gmail (kirim email) dan Sheets (log)
    const { drive: adminDrive, gmail, sheets } = await getGoogleClients()
    const sheetId = process.env.GSHEET_ID
    const report = []
    const successItems = []

    await connectToDatabase()

    for (const item of cart) {
      try {
        // Cari semua opsi workspace dari katalog untuk game ini (urutkan dari sendCount terkecil)
        const catalogEntries = await GameCatalog.find({ name: item.name }).sort({ sendCount: 1 }).lean()
        
        let driveForShare = null
        let ownerEmail = null
        let realId = null
        let permissionId = null
        let successEntry = null

        // Coba kirim dari workspace yang beban pengirimannya paling sedikit
        for (const entry of catalogEntries) {
          try {
            const drive = await getClientForEmail(entry.ownerEmail)
            const permRes = await drive.permissions.create({
              fileId: entry.folderId,
              supportsAllDrives: true,
              sendNotificationEmail: false,
              requestBody: { role: 'reader', type: 'user', emailAddress: email },
            })
            // Berhasil!
            driveForShare = drive
            ownerEmail = entry.ownerEmail
            realId = entry.folderId
            permissionId = permRes.data.id
            successEntry = entry
            break // Keluar dari loop jika sukses
          } catch (e) {
            console.error(`Gagal menggunakan workspace ${entry.ownerEmail} untuk ${item.name}: ${e.message}`)
            // Lanjut ke workspace berikutnya jika yang ini gagal (misal kena rate limit)
          }
        }

        // Jika semua workspace gagal, atau tidak ada di katalog, fallback ke id bawaan (menggunakan token admin)
        if (!driveForShare) {
          console.warn(`Semua workspace gagal untuk ${item.name}, menggunakan fallback admin.`)
          realId = item.targetId || item.id
          ownerEmail = item.ownerEmail || 'Unknown'
          
          if (!realId) throw new Error('Game tidak ditemukan di katalog dan tidak ada fallback ID')

          const permRes = await adminDrive.permissions.create({
            fileId: realId,
            supportsAllDrives: true,
            sendNotificationEmail: false,
            requestBody: { role: 'reader', type: 'user', emailAddress: email },
          })
          permissionId = permRes.data.id
        } else if (successEntry) {
          // Jika sukses melalui workspace, tambahkan counter pengiriman
          await GameCatalog.updateOne(
            { _id: successEntry._id },
            { $inc: { sendCount: 1 } }
          )
        }

        // Log ke Sheet1 (tetap menggunakan admin sheets)
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Sheet1!A:E',
            valueInputOption: 'RAW',
            requestBody: {
              values: [[new Date().toISOString(), email, item.name, ownerEmail || 'Unknown', isBonus ? 'bonus' : '']],
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

    // Kirim email konfirmasi dari akun admin
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
      ? `<p style="margin:6px 0 0;font-size:12px;color:#e67e22;">⏱ Akses berlaku hingga: ${new Date(item.expirationTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`
      : ''
    emailList += `
      <div style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <p style="margin:0;font-weight:bold;color:#111;">🎮 ${item.name}</p>
        <p style="margin:6px 0 0;"><a href="https://drive.google.com/open?id=${item.realId}" style="color:#2563eb;text-decoration:none;font-weight:bold;">Klik di sini untuk Download →</a></p>
        ${expiryNote}
      </div>
    `
  }

  const subject = successItems.length === 1
    ? `MyGameON | Pengiriman Akses Download ${successItems[0].name}`
    : `MyGameON | Pengiriman Akses Download Game Pesananmu`

  const htmlBody = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
      <div style="background:#111;padding:20px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:1px;">MYGAMEON</h1>
        <p style="color:#aaa;margin:4px 0 0;font-size:12px;">Game Digital Store</p>
      </div>
      <div style="padding:30px;background:#fff;">
        <h2 style="color:#111;margin-top:0;">Halo, Kak! 👋</h2>
        <p style="color:#555;">Terima kasih sudah berbelanja di MyGameON. Pesanan kamu sudah kami proses dan akses Google Drive sudah siap.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        ${emailList}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <h3 style="color:#111;margin-bottom:12px;">Langkah Selanjutnya</h3>
        <ol style="color:#555;line-height:1.8;padding-left:20px;">
          <li>Download file <b>satu per satu</b> — jangan sekaligus agar tidak error.</li>
          <li>Tambahkan folder ke <b>Exclusion Antivirus</b> sebelum ekstrak file.</li>
          <li>Tonton video tutorial di bawah agar proses instalasi berjalan lancar.</li>
        </ol>
        <div style="text-align:center;margin:25px 0;">
          <a href="https://bit.ly/vidtutorekstrakdownload" style="background:#111;color:#fff;padding:12px 28px;text-decoration:none;font-weight:bold;border-radius:6px;display:inline-block;font-size:14px;">
            🎬 Tonton Video Tutorial
          </a>
        </div>
        <p style="font-size:11px;color:#aaa;text-align:center;margin-top:20px;">Email ini dikirim otomatis oleh sistem MyGameON.</p>
      </div>
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