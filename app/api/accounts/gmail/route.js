import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { verifyGmailSmtp } from '@/lib/mailer'

export async function GET() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'mygameonhub@gmail.com').trim()
  try {
    const res = await verifyGmailSmtp()
    return NextResponse.json({
      configured: true,
      adminEmail: res.adminEmail || adminEmail,
      message: `Koneksi Gmail SMTP (${res.endpoint}) aktif dan siap mengirim email.`
    })
  } catch (err) {
    const isUnset = err.message && err.message.includes('belum diatur')
    return NextResponse.json({
      configured: !isUnset,
      adminEmail,
      ...(isUnset
        ? { message: 'Sandi Aplikasi Gmail belum diatur.' }
        : { error: err.message || 'Gagal memverifikasi koneksi Gmail' })
    })
  }
}

export async function POST(req) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { appPassword } = await req.json()
    const cleanPassword = (appPassword || '').trim().replace(/\s+/g, '')

    if (!cleanPassword) {
      return NextResponse.json({ error: 'Sandi Aplikasi tidak boleh kosong' }, { status: 400 })
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'mygameonhub@gmail.com').trim()

    // 1. Verifikasi kredensial sebelum disimpan
    try {
      await verifyGmailSmtp(cleanPassword)
    } catch (verifyErr) {
      return NextResponse.json({
        error: `Verifikasi Google gagal: ${verifyErr.message}. Pastikan 2-Step Verification aktif dan gunakan Sandi Aplikasi 16 karakter dari myaccount.google.com/apppasswords.`
      }, { status: 400 })
    }

    // 2. Simpan ke .env.local di seluruh lokasi persistent
    const envPaths = [
      path.join(process.cwd(), '.env.local'),
      process.env.APPDATA ? path.join(process.env.APPDATA, 'MyGameON Studio', '.env.local') : null,
      process.env.APPDATA ? path.join(process.env.APPDATA, 'mygameon-hub', '.env.local') : null,
    ].filter(Boolean)

    for (const envPath of envPaths) {
      try {
        if (fs.existsSync(path.dirname(envPath))) {
          let envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
          if (envText.includes('GMAIL_APP_PASSWORD=')) {
            envText = envText.replace(/GMAIL_APP_PASSWORD=.*/, `GMAIL_APP_PASSWORD=${cleanPassword}`)
          } else {
            envText += `\nGMAIL_APP_PASSWORD=${cleanPassword}\n`
          }
          fs.writeFileSync(envPath, envText, 'utf8')
        }
      } catch (fsErr) {
        console.warn('[gmail route] Gagal tulis .env.local:', fsErr.message)
      }
    }
    process.env.GMAIL_APP_PASSWORD = cleanPassword

    return NextResponse.json({
      success: true,
      message: `Koneksi Gmail Admin (${adminEmail}) berhasil diverifikasi dan tersimpan permanen!`
    })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan sistem' }, { status: 500 })
  }
}
