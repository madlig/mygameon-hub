import fs from 'fs'
import path from 'path'
import nodemailer from 'nodemailer'
import { SIMS4_EXTRACT_PASSWORD, SIMS4_DOWNLOAD_URL, SIMS4_TUTORIAL_URL } from './sims4.js'

/**
 * Membaca variabel dari process.env atau fallback langsung dari file .env.local di disk
 * agar pengiriman email tetap berjalan meskipun server standalone belum me-reload environment.
 */
function resolveMailEnv(key, defaultValue = '') {
  const fromMemory = (process.env[key] || '').trim()
  if (fromMemory) return fromMemory

  const candidatePaths = [
    path.join(process.cwd(), '.env.local'),
    process.env.APPDATA ? path.join(process.env.APPDATA, 'MyGameON Studio', '.env.local') : null,
    process.env.APPDATA ? path.join(process.env.APPDATA, 'mygameon-hub', '.env.local') : null,
    'c:\\mad\\proyek\\mygameon-hub\\.env.local',
  ].filter(Boolean)

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8')
        const regex = new RegExp(`^${key}\\s*=\\s*([^\\r\\n]+)`, 'm')
        const match = content.match(regex)
        if (match) {
          const val = match[1].trim().replace(/^["']|["']$/g, '').trim()
          if (val) {
            process.env[key] = val
            return val
          }
        }
      }
    } catch (_) {}
  }

  return defaultValue
}

/**
 * Daftar konfigurasi SMTP Gmail berjenjang (Port 587 STARTTLS & Port 465 SSL, IPv4)
 * untuk mencegah kegagalan akibat timeout pada satu IP/Port ISP tertentu.
 */
function getSmtpConfigs(adminEmail, appPassword) {
  const base = {
    auth: { user: adminEmail, pass: appPassword },
    family: 4,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    tls: { rejectUnauthorized: false },
  }
  return [
    { ...base, host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true, label: 'smtp.gmail.com:587' },
    { ...base, host: 'smtp.gmail.com', port: 465, secure: true, label: 'smtp.gmail.com:465' },
    { ...base, host: 'smtp.googlemail.com', port: 587, secure: false, requireTLS: true, label: 'smtp.googlemail.com:587' },
  ]
}

export async function verifyGmailSmtp(customPassword = null) {
  const adminEmail = resolveMailEnv('ADMIN_EMAIL', 'mygameonhub@gmail.com')
  const appPassword = (customPassword ?? resolveMailEnv('GMAIL_APP_PASSWORD', '')).replace(/\s+/g, '')
  if (!appPassword) {
    throw new Error('Sandi Aplikasi Gmail belum diatur.')
  }
  let lastErr = null
  for (const cfg of getSmtpConfigs(adminEmail, appPassword)) {
    try {
      const transporter = nodemailer.createTransport(cfg)
      await transporter.verify()
      return { ok: true, adminEmail, endpoint: cfg.label }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('Gagal memverifikasi koneksi SMTP Gmail.')
}

/**
 * Pengirim Email HTML Terpadu (Nodemailer Gmail SMTP Multi-Fallback + Fallback OAuth Gmail API)
 */
export async function sendHtmlEmail({ toEmail, subject, htmlBody, gmailClient = null }) {
  if (!toEmail) {
    throw new Error('Alamat email tujuan wajib diisi.')
  }

  const adminEmail = resolveMailEnv('ADMIN_EMAIL', 'mygameonhub@gmail.com')
  const appPassword = resolveMailEnv('GMAIL_APP_PASSWORD', '').replace(/\s+/g, '')

  let lastSmtpErr = null

  // METODE 1: Nodemailer dengan Gmail App Password (Sandi Aplikasi) — Multi-Port & Host Retry
  if (appPassword) {
    const configs = getSmtpConfigs(adminEmail, appPassword)
    for (const cfg of configs) {
      try {
        const transporter = nodemailer.createTransport(cfg)
        const info = await transporter.sendMail({
          from: `"MyGameON Official" <${adminEmail}>`,
          to: toEmail,
          subject,
          html: htmlBody,
        })
        return { success: true, method: `smtp (${cfg.label})`, messageId: info.messageId }
      } catch (smtpErr) {
        lastSmtpErr = smtpErr
        console.warn(`[mailer] Nodemailer SMTP (${cfg.label}) gagal:`, smtpErr.message)
      }
    }
  }

  // METODE 2: Fallback ke Gmail API OAuth (hanya jika token OAuth masih valid)
  if (gmailClient) {
    try {
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

      const res = await gmailClient.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      })

      return { success: true, method: 'oauth', messageId: res.data.id }
    } catch (oauthErr) {
      // Jika Sandi Aplikasi sudah diatur namun gagal karena masalah jaringan (misal ETIMEDOUT),
      // jangan tampilkan error 'invalid_grant' dari token OAuth lama yang membingungkan operator.
      if (lastSmtpErr) {
        throw new Error(`Koneksi SMTP Gmail gagal (${lastSmtpErr.message}). Silakan klik Kirim Ulang Email.`)
      }
      throw oauthErr
    }
  }

  if (lastSmtpErr) {
    throw new Error(`Koneksi SMTP Gmail gagal (${lastSmtpErr.message}). Silakan klik Kirim Ulang Email.`)
  }

  throw new Error('Tidak ada layanan pengiriman email aktif. Harap atur GMAIL_APP_PASSWORD di .env.local atau hubungkan akun Gmail Admin.')
}

/**
 * Pengirim Email Konfirmasi Pembelian Terpadu
 * Mendukung Gmail SMTP (Sandi Aplikasi) sebagai metode utama yang tidak pernah kadaluarsa,
 * serta fallback ke Gmail API OAuth jika tersedia.
 */
export async function sendDeliveryEmail({
  toEmail,
  invoice,
  pcGames = [],
  sims4Items = [],
  gmailClient = null
}) {
  if (!toEmail) {
    throw new Error('Alamat email tujuan wajib diisi.')
  }

  // 1. Generate Section Game PC
  let pcSectionHtml = ''
  if (pcGames.length > 0) {
    let listHtml = ''
    for (const item of pcGames) {
      const expiryNote = item.expirationTime
        ? `<p style="margin:4px 0 0;font-size:12px;color:#e67e22;">⏱ Akses berlaku hingga: ${new Date(item.expirationTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`
        : `<p style="margin:4px 0 0;font-size:12px;color:#22c55e;">♾ Akses Permanen</p>`

      listHtml += `
        <div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <p style="margin:0;font-weight:bold;color:#111;font-size:14px;">🎮 ${item.name}</p>
          <p style="margin:4px 0 0;"><a href="https://drive.google.com/open?id=${item.realId}" style="color:#2563eb;text-decoration:none;font-weight:bold;font-size:13px;">Klik di sini untuk Download →</a></p>
          ${expiryNote}
        </div>
      `
    }

    pcSectionHtml = `
      <div style="margin-bottom:24px;">
        <h3 style="color:#111;margin:0 0 10px;font-size:15px;border-bottom:2px solid #2563eb;padding-bottom:5px;">📁 Game PC (Akses Google Drive)</h3>
        ${listHtml}
      </div>
    `
  }

  // 2. Generate Section The Sims 4
  let simsSectionHtml = ''
  if (sims4Items.length > 0) {
    let listHtml = ''
    for (const item of sims4Items) {
      const variantName = item.allowCC ? 'PREMIUM (Full Mods & Custom Content)' : 'STANDARD (Game Only)'
      listHtml += `
        <div style="background:#fff9db;border-left:5px solid #FFD700;padding:14px;margin:12px 0;border-radius:6px;">
          <h4 style="margin:0 0 8px;color:#111;font-size:14px;">💎 ${item.name}</h4>
          <table style="width:100%;font-size:13px;">
            <tr><td style="font-weight:bold;color:#666;width:140px;padding-bottom:4px;">🔑 License Key:</td><td style="font-weight:bold;color:#000;">${invoice || '—'}</td></tr>
            <tr><td style="font-weight:bold;color:#666;padding-bottom:4px;">🔒 Password Extract:</td><td style="font-weight:bold;color:#000;">${SIMS4_EXTRACT_PASSWORD}</td></tr>
            <tr><td style="font-weight:bold;color:#666;padding-bottom:4px;">📦 Tipe Paket:</td><td style="font-weight:bold;color:#000;">${variantName}</td></tr>
          </table>
          <div style="margin-top:10px;">
            <a href="${SIMS4_DOWNLOAD_URL}" style="display:inline-block;background:#FFD700;color:#000;padding:8px 16px;text-decoration:none;font-weight:bold;border-radius:4px;font-size:12px;margin-right:8px;">
              🚀 Download Launcher
            </a>
            ${item.realId ? `<a href="https://drive.google.com/drive/folders/${item.realId}" style="display:inline-block;background:#333;color:#fff;padding:8px 16px;text-decoration:none;font-weight:bold;border-radius:4px;font-size:12px;">📂 Buka Google Drive</a>` : ''}
          </div>
        </div>
      `
    }

    simsSectionHtml = `
      <div style="margin-bottom:24px;">
        <h3 style="color:#111;margin:0 0 10px;font-size:15px;border-bottom:2px solid #FFD700;padding-bottom:5px;">⭐ The Sims 4 Launcher & Akses</h3>
        ${listHtml}
      </div>
    `
  }

  // 3. Subject Email
  const subject = sims4Items.length > 0 && pcGames.length > 0
    ? `MyGameON | Pengiriman Pesanan Game & The Sims 4`
    : sims4Items.length > 0
      ? `MyGameON | Pengiriman Akses The Sims 4 (${invoice})`
      : pcGames.length === 1
        ? `MyGameON | Pengiriman Akses Download ${pcGames[0].name}`
        : `MyGameON | Pengiriman Akses Download Game Pesananmu`

  // 4. HTML Body
  const htmlBody = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#333;max-width:620px;margin:0 auto;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;background:#fff;">
      <div style="background:#111;padding:24px;text-align:center;">
        <h1 style="color:#FFD700;margin:0;font-size:22px;letter-spacing:1.5px;">MYGAMEON</h1>
        <p style="color:#bbb;margin:4px 0 0;font-size:12px;">Pusat Game Digital & Launcher Store</p>
      </div>
      <div style="padding:28px 24px;">
        <h2 style="color:#111;margin-top:0;font-size:18px;">Halo, Kak! 👋</h2>
        <p style="color:#555;font-size:14px;line-height:1.6;">Terima kasih sudah berbelanja di MyGameON. Pesanan kamu sudah kami proses dan akses file siap digunakan.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">

        ${pcSectionHtml}
        ${simsSectionHtml}

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <h4 style="color:#111;margin:0 0 8px;font-size:13px;">Petunjuk Penting:</h4>
        <ol style="color:#555;font-size:12.5px;line-height:1.7;padding-left:18px;margin:0 0 16px;">
          <li>Download file <b>satu per satu</b> agar tidak mengalami kendala kuota/corrupt.</li>
          <li>Tambahkan folder game ke <b>Exclusion / Pengecualian Antivirus</b> sebelum ekstrak file.</li>
          <li>Tonton video tutorial melalui tombol di bawah atau putar langsung file video di dalam folder Google Drive.</li>
        </ol>
        <div style="text-align:center;margin:20px 0 10px;">
          <a href="${SIMS4_TUTORIAL_URL}" style="background:#111;color:#fff;padding:10px 24px;text-decoration:none;font-weight:bold;border-radius:6px;display:inline-block;font-size:13px;">
            🎬 Tonton Video Tutorial Instalasi
          </a>
        </div>
        <p style="font-size:11px;color:#aaa;text-align:center;margin-top:24px;">Email ini dikirim otomatis oleh sistem operasional MyGameON.</p>
      </div>
    </div>
  `

  return sendHtmlEmail({
    toEmail,
    subject,
    htmlBody,
    gmailClient,
  })
}

