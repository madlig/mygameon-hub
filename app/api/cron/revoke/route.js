import { NextResponse } from 'next/server'
import { google } from 'googleapis'

// Vercel Cron memanggil endpoint ini — tidak pakai session user
async function getAdminClients() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })
  const drive = google.drive({ version: 'v3', auth })
  const gmail = google.gmail({ version: 'v1', auth })
  const sheets = google.sheets({ version: 'v4', auth })
  return { drive, gmail, sheets }
}

export async function GET(request) {
  // Verifikasi request dari Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { drive, gmail, sheets } = await getAdminClients()
    const sheetId = process.env.GSHEET_ID
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Baca semua baris ExpiringAccess
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'ExpiringAccess!A:F',
    })

    const rows = res.data.values || []
    const revokedCount = []
    const notifiedCount = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const [email, fileId, permissionId, gameName, expiredAt, status] = row

      // Skip header atau baris yang sudah direvoke
      if (!email || email === 'email' || status === 'revoked') continue

      const expDate = new Date(expiredAt)

      // 1. Kirim notifikasi H-1
      const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24))
      if (diffDays === 1 && status === 'active') {
        try {
          await sendExpiryNotification(gmail, email, gameName, expDate)
          notifiedCount.push(gameName)
        } catch (e) {
          console.error('Notify error:', e.message)
        }
      }

      // 2. Revoke jika sudah expired
      if (expDate <= now && status === 'active') {
        try {
          await drive.permissions.delete({
            fileId,
            permissionId,
            supportsAllDrives: true,
          })

          // Update status di Sheets jadi 'revoked'
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `ExpiringAccess!F${i + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['revoked']] },
          })

          revokedCount.push(gameName)
        } catch (e) {
          console.error('Revoke error:', e.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      revoked: revokedCount,
      notified: notifiedCount,
    })

  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function sendExpiryNotification(gmail, toEmail, gameName, expDate) {
  const dateStr = expDate.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;color:#333;max-width:600px;border:1px solid #ddd;padding:20px;border-radius:10px;">
      <h2 style="color:#e67e22;">⚠️ Akses Game Akan Berakhir Besok</h2>
      <p>Halo Kak,</p>
      <p>Akses Google Drive kakak untuk game berikut akan <b>berakhir besok, ${dateStr}</b>:</p>
      <div style="background:#fff9db;border-left:5px solid #f39c12;padding:15px;margin:20px 0;border-radius:4px;">
        <b>🎮 ${gameName}</b>
      </div>
      <p>Pastikan kakak sudah mendownload semua file sebelum akses dicabut.</p>
      <p>Jika ingin memperpanjang akses, silakan hubungi admin.</p>
      <p style="font-size:12px;color:#777;"><i>Email ini dikirim otomatis oleh sistem MyGameON.</i></p>
    </div>
  `

  const rawMessage = [
    `To: ${toEmail}`,
    'Subject: ⚠️ Akses Game Kamu Akan Berakhir Besok - MyGameON',
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