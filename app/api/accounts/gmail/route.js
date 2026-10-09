import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { auth } from '@/app/api/auth/[...nextauth]/route'

export async function GET() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'mygameonhub@gmail.com').trim()
    const appPassword = (process.env.GMAIL_APP_PASSWORD || '').trim().replace(/\s+/g, '')

    if (!appPassword) {
      return NextResponse.json({
        configured: false,
        adminEmail,
        message: 'Sandi Aplikasi Gmail belum diatur.'
      })
    }

    // Uji koneksi SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: adminEmail, pass: appPassword }
    })

    await transporter.verify()

    return NextResponse.json({
      configured: true,
      adminEmail,
      message: 'Koneksi Gmail SMTP aktif dan siap mengirim email.'
    })
  } catch (err) {
    return NextResponse.json({
      configured: true,
      adminEmail: process.env.ADMIN_EMAIL,
      error: err.message || 'Gagal memverifikasi koneksi Gmail'
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
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: adminEmail, pass: cleanPassword }
    })

    try {
      await transporter.verify()
    } catch (verifyErr) {
      return NextResponse.json({
        error: `Verifikasi Google gagal: ${verifyErr.message}. Pastikan 2-Step Verification aktif dan gunakan Sandi Aplikasi 16 karakter dari myaccount.google.com/apppasswords.`
      }, { status: 400 })
    }

    // 2. Simpan ke .env.local
    try {
      const envPath = path.join(process.cwd(), '.env.local')
      let envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
      if (envText.includes('GMAIL_APP_PASSWORD=')) {
        envText = envText.replace(/GMAIL_APP_PASSWORD=.*/, `GMAIL_APP_PASSWORD=${cleanPassword}`)
      } else {
        envText += `\nGMAIL_APP_PASSWORD=${cleanPassword}\n`
      }
      fs.writeFileSync(envPath, envText, 'utf8')
      process.env.GMAIL_APP_PASSWORD = cleanPassword
    } catch (fsErr) {
      console.warn('[gmail route] Gagal tulis .env.local:', fsErr.message)
    }

    return NextResponse.json({
      success: true,
      message: `Koneksi Gmail Admin (${adminEmail}) berhasil diverifikasi dan tersimpan permanen!`
    })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan sistem' }, { status: 500 })
  }
}
