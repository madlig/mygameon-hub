import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import Sims4License from '@/models/Sims4License'
import Order from '@/models/Order'
import Customer from '@/models/Customer'
import AccessLog from '@/models/AccessLog'

export async function POST(request) {
  try {
    const { mode = 'email', email, invoice, allowCC } = await request.json()

    if (!invoice || !invoice.trim()) {
      return NextResponse.json({ error: 'Kode pesanan (invoice) wajib diisi' }, { status: 400 })
    }

    const cleanInvoice = invoice.trim()
    const cleanEmail = email ? email.toLowerCase().trim() : ''

    await connectToDatabase()

    // 1. Cek duplikasi invoice (Cegah E11000 duplicate key crash)
    const existing = await Sims4License.findOne({ invoice: cleanInvoice })
    if (existing) {
      return NextResponse.json({ error: `Kode pesanan '${cleanInvoice}' sudah terdaftar sebagai lisensi The Sims 4 aktif.` }, { status: 409 })
    }

    // 2. Cek status blacklist customer jika email ada
    if (cleanEmail) {
      const customer = await Customer.findOne({ email: cleanEmail })
      if (customer?.status === 'blacklisted') {
        return NextResponse.json({ error: 'Akses ditolak: Email pelanggan telah diblokir permanen (Blacklisted).' }, { status: 403 })
      }
    }

    const { drive, gmail, sheets } = await getGoogleClients()
    const folderId = process.env.SIMS4_FOLDER_ID
    const sheetId = process.env.GSHEET_SIMS4_ID
    const ccVal = allowCC ? 'Y' : 'N'
    const createdAt = new Date()

    // ── Mode "Lisensi saja" — tanpa share Drive & tanpa kirim email ──
    if (mode === 'license') {
      // 1. Simpan lisensi ke MongoDB (Ground Truth)
      await Sims4License.create({
        invoice: cleanInvoice,
        hwid: '',
        hwids: [],
        cc: ccVal,
        status: 'Active',
        email: cleanEmail,
        createdAt
      })

      // 2. Simpan catatan ke Order MongoDB
      try {
        await Order.create({
          email: cleanEmail,
          invoice: cleanInvoice,
          cartItems: [{
            name: 'The Sims 4',
            targetId: folderId || '',
            ownerEmail: process.env.ADMIN_EMAIL || 'mygameon',
            isBonus: false,
            isSims4: true,
            allowCC: !!allowCC
          }],
          bonusEligible: 0,
          bonusClaimed: 0
        })
      } catch (orderErr) {
        console.warn('Sims 4 license-only order log warning:', orderErr.message)
      }

      // 3. Simpan ke Sheets (Dual Write Non-blocking)
      if (sheetId && sheets) {
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Licenses!A:G',
            valueInputOption: 'RAW',
            requestBody: {
              values: [[cleanInvoice, '', '', ccVal, 'Active', cleanEmail, createdAt.toISOString()]],
            },
          })
        } catch (sheetErr) {
          console.warn('Sims 4 Sheet log warning:', sheetErr.message)
        }
      }

      return NextResponse.json({ success: true, mode: 'license' })
    }

    // ── Mode "Kirim via Email" ──
    if (!cleanEmail) {
      return NextResponse.json({ error: 'Email pembeli wajib diisi untuk mode kirim via email' }, { status: 400 })
    }

    // Resolve shortcut jika folderId berupa Google Apps Shortcut
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
    } catch (_) {}

    // Share akses folder Sims 4 di Google Drive
    await drive.permissions.create({
      fileId: realFolderId,
      supportsAllDrives: true,
      sendNotificationEmail: false,
      requestBody: {
        role: 'reader',
        type: 'user',
        emailAddress: cleanEmail,
      },
    })

    // Catat ke MongoDB Sims4License (Ground Truth)
    await Sims4License.create({
      invoice: cleanInvoice,
      hwid: '',
      hwids: [],
      cc: ccVal,
      status: 'Active',
      email: cleanEmail,
      createdAt
    })

    // Catat ke Order MongoDB
    try {
      await Order.create({
        email: cleanEmail,
        invoice: cleanInvoice,
        cartItems: [{
          name: 'The Sims 4',
          targetId: realFolderId,
          ownerEmail: process.env.ADMIN_EMAIL || 'mygameon',
          isBonus: false,
          isSims4: true,
          allowCC: !!allowCC
        }],
        bonusEligible: 0,
        bonusClaimed: 0
      })
    } catch (orderErr) {
      console.warn('Sims 4 Order create warning:', orderErr.message)
    }

    // Update Customer MongoDB
    try {
      await Customer.findOneAndUpdate(
        { email: cleanEmail },
        {
          $inc: { orderCount: 1 },
          $setOnInsert: { status: 'active', createdAt: new Date() }
        },
        { upsert: true }
      )
    } catch (custErr) {
      console.warn('Customer update warning:', custErr.message)
    }

    // Catat riwayat akses ke AccessLog
    try {
      await AccessLog.create({
        email: cleanEmail,
        gameName: 'The Sims 4',
        folderId: realFolderId,
        permissionId: '',
        ownerEmail: process.env.ADMIN_EMAIL || 'mygameon',
        isBonus: false,
        expiresAt: null
      })
    } catch (logErr) {
      console.warn('AccessLog warning:', logErr.message)
    }

    // Dual-write ke Google Sheets Sims 4 (Non-blocking)
    if (sheetId && sheets) {
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: 'Licenses!A:G',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[cleanInvoice, '', '', ccVal, 'Active', cleanEmail, createdAt.toISOString()]],
          },
        })
      } catch (sheetErr) {
        console.warn('Sims 4 Sheet log warning:', sheetErr.message)
      }
    }

    // Kirim email konfirmasi ke pembeli via Gmail
    const driveLink = `https://drive.google.com/drive/folders/${realFolderId}`
    const variantName = allowCC ? 'PREMIUM (Full Mods/CC)' : 'STANDARD (Game Only)'

    const htmlBody = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
        <div style="background:#000;padding:25px;text-align:center;">
          <h1 style="color:#FFD700;margin:0;font-size:24px;letter-spacing:2px;">MYGAMEON</h1>
          <p style="color:#fff;margin:5px 0 0;font-size:12px;">The Sims 4 Ultimate Installer</p>
        </div>
        <div style="padding:30px;background:#fff;">
          <h2 style="color:#333;margin-top:0;">Halo, Kak! 👋</h2>
          <p style="color:#555;">Terima kasih sudah berbelanja di MyGameON. Akses The Sims 4 kamu sudah siap dan bisa langsung digunakan.</p>
          <div style="background:#fff9db;border-left:5px solid #FFD700;padding:15px;margin:25px 0;border-radius:4px;">
            <table style="width:100%;">
              <tr><td style="font-weight:bold;color:#555;padding-bottom:5px;">🧾 Password Extract:</td><td style="font-weight:bold;">mygameonlauncher</td></tr>
              <tr><td style="font-weight:bold;color:#555;padding-bottom:5px;">🔑 License Key:</td><td style="font-weight:bold;">${cleanInvoice}</td></tr>
              <tr><td style="font-weight:bold;color:#555;">📦 Tipe Paket:</td><td style="font-weight:bold;">${variantName}</td></tr>
            </table>
          </div>
          <div style="text-align:center;margin:30px 0 15px;">
            <a href="${driveLink}" style="background:#FFD700;color:#000;padding:16px 30px;text-decoration:none;font-weight:bold;border-radius:50px;display:inline-block;">
              📂 Buka Folder Game
            </a>
          </div>
          <div style="text-align:center;margin:15px 0 30px;">
            <a href="https://bit.ly/vidtutorekstrakdownload" style="background:#333;color:#fff;padding:12px 28px;text-decoration:none;font-weight:bold;border-radius:50px;display:inline-block;font-size:14px;">
              🎬 Tonton Video Tutorial
            </a>
          </div>
          <p style="font-size:11px;color:#aaa;text-align:center;margin-top:20px;">Email ini dikirim otomatis oleh sistem MyGameON.</p>
        </div>
      </div>
    `

    const rawMessage = [
      `To: ${cleanEmail}`,
      `Subject: MyGameON | Pengiriman Akses Download The Sims 4`,
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
    if (err.message && (err.message.toLowerCase().includes('invalid') || err.message.toLowerCase().includes('bad request') || err.code === 400)) {
      return NextResponse.json({ error: 'Email tujuan salah atau tidak valid' }, { status: 400 })
    }
    console.error('Sims4 order error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}