import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

export async function POST(request) {
  try {
    const { email, invoice, allowCC } = await request.json()

    if (!email || !invoice) {
      return NextResponse.json({ error: 'Email dan invoice wajib diisi' }, { status: 400 })
    }

    const { drive, gmail, sheets } = await getGoogleClients()
    const folderId = process.env.SIMS4_FOLDER_ID
    const sheetId = process.env.GSHEET_SIMS4_ID

    // Resolve shortcut
    let realFolderId = folderId
    try {
      const f = await drive.files.get({
        fileId: folderId,
        fields: 'mimeType, shortcutDetails',
        supportsAllDrives: true,
      })
      if (f.data.mimeType === 'application/vnd.google-apps.shortcut') {
        realFolderId = f.data.shortcutDetails.targetId
      }
    } catch (e) {}

    // Share akses ke folder Sims 4
    await drive.permissions.create({
      fileId: realFolderId,
      supportsAllDrives: true,
      sendNotificationEmail: false,
      requestBody: {
        role: 'reader',
        type: 'user',
        emailAddress: email,
      },
    })

    // Catat ke spreadsheet Sims 4
    const ccVal = allowCC ? 'Y' : 'N'
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Licenses!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[invoice, '', '', ccVal, 'Active', email, new Date().toISOString()]],
      },
    })

    // Kirim email ke pembeli
    const driveLink = `https://drive.google.com/drive/folders/${realFolderId}`
    const variantName = allowCC ? 'PREMIUM (Full Mods/CC)' : 'STANDARD (Game Only)'

    const htmlBody = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
        <div style="background:#000;padding:25px;text-align:center;">
          <h1 style="color:#FFD700;margin:0;font-size:24px;letter-spacing:2px;">MYGAMEON</h1>
          <p style="color:#fff;margin:5px 0 0;font-size:12px;">The Sims 4 Ultimate Installer</p>
        </div>
        <div style="padding:30px;background:#fff;">
          <h2 style="color:#333;margin-top:0;">Halo Kak! 👋</h2>
          <p style="color:#555;">Terima kasih sudah berbelanja di MyGameON. Pesanan kakak sudah kami proses.</p>
          <div style="background:#fff9db;border-left:5px solid #FFD700;padding:15px;margin:25px 0;border-radius:4px;">
            <table style="width:100%;">
              <tr><td style="font-weight:bold;color:#555;padding-bottom:5px;">🧾 Password Extract:</td><td style="font-weight:bold;">mygameonlauncher</td></tr>
              <tr><td style="font-weight:bold;color:#555;padding-bottom:5px;">🔑 License Key:</td><td style="font-weight:bold;">${invoice}</td></tr>
              <tr><td style="font-weight:bold;color:#555;">📦 Tipe Paket:</td><td style="font-weight:bold;">${variantName}</td></tr>
            </table>
          </div>
          <div style="text-align:center;margin:35px 0;">
            <a href="${driveLink}" style="background:#FFD700;color:#000;padding:16px 30px;text-decoration:none;font-weight:bold;border-radius:50px;display:inline-block;">
              📂 BUKA FOLDER GAME
            </a>
          </div>
        </div>
      </div>
    `

    const rawMessage = [
      `To: ${email}`,
      `Subject: 🎮 Akses The Sims 4 Siap! - Pesanan #${invoice}`,
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

    return NextResponse.json({ success: true })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Sims4 order error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}