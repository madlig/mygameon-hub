import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import connectToDatabase from '@/lib/db'
import AccessLog from '@/models/AccessLog'
import GameCatalog from '@/models/GameCatalog'
import { getClientForEmail } from '@/lib/googleClient'

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
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectToDatabase()
    const { drive: adminDrive, gmail, sheets } = await getAdminClients()
    const sheetId = process.env.GSHEET_ID
    const now = new Date()

    // 1. Sinkronkan dari MongoDB AccessLog (Status Active yang sudah Expired)
    const expiredLogs = await AccessLog.find({
      status: 'active',
      expiresAt: { $lte: now, $ne: null }
    }).lean()

    const revokedCount = []
    const notifiedCount = []

    for (const log of expiredLogs) {
      try {
        let drive = adminDrive
        if (log.ownerEmail && log.ownerEmail !== process.env.ADMIN_EMAIL) {
          try {
            drive = await getClientForEmail(log.ownerEmail)
          } catch (_) {
            drive = adminDrive
          }
        }

        if (log.permissionId && log.fileId) {
          await drive.permissions.delete({
            fileId: log.fileId,
            permissionId: log.permissionId,
            supportsAllDrives: true,
          })
        }

        await AccessLog.findByIdAndUpdate(log._id, { status: 'revoked' })
        revokedCount.push(log.gameName || log.fileName || log.fileId)
      } catch (err) {
        if (err.code === 404 || (err.message && err.message.toLowerCase().includes('not found'))) {
          await AccessLog.findByIdAndUpdate(log._id, { status: 'revoked' })
        } else {
          console.error(`Gagal revoke AccessLog ${log._id}:`, err.message)
        }
      }
    }

    // 2. Baca Google Sheet ExpiringAccess jika tersedia
    if (sheetId && sheets) {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'ExpiringAccess!A:F',
        })

        const rows = res.data.values || []

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const [email, fileId, permissionId, gameName, expiredAt, status] = row

          if (!email || email === 'email' || status === 'revoked') continue

          const expDate = new Date(expiredAt)

          // Kirim notifikasi H-1
          const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24))
          if (diffDays === 1 && status === 'active' && gmail) {
            try {
              await sendExpiryNotification(gmail, email, gameName, expDate)
              notifiedCount.push(gameName)
            } catch (e) {
              console.error('Notify error:', e.message)
            }
          }

          // Revoke jika sudah expired di Sheets
          if (expDate <= now && status === 'active') {
            try {
              let drive = adminDrive
              const cat = await GameCatalog.findOne({ folderId: fileId }).lean()
              if (cat?.ownerEmail && cat.ownerEmail !== process.env.ADMIN_EMAIL) {
                try {
                  drive = await getClientForEmail(cat.ownerEmail)
                } catch (_) {}
              }

              await drive.permissions.delete({
                fileId,
                permissionId,
                supportsAllDrives: true,
              })

              await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: `ExpiringAccess!F${i + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [['revoked']] },
              })
            } catch (e) {
              if (e.code === 404 || (e.message && e.message.toLowerCase().includes('not found'))) {
                await sheets.spreadsheets.values.update({
                  spreadsheetId: sheetId,
                  range: `ExpiringAccess!F${i + 1}`,
                  valueInputOption: 'USER_ENTERED',
                  requestBody: { values: [['revoked']] },
                })
              }
            }
          }
        }
      } catch (sheetErr) {
        console.warn('ExpiringAccess sheet sync warning:', sheetErr.message)
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