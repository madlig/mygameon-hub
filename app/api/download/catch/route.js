import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import http from 'http'
import querystring from 'querystring'
import path from 'path'
import { spawn } from 'child_process'
import { cleanReleaseName } from '@/lib/utils'
import { checkJDownloaderRunning } from '@/lib/downloadWatcher'
import { streamDownloader } from '@/lib/streamDownloader'

const JDOWNLOADER_EXE_PATH = path.join(
  process.env.LOCALAPPDATA || 'C:\\Users\\madli\\AppData\\Local',
  'JDownloader 2',
  'JDownloader2.exe'
)

// Helper: Kirim payload ke port FlashGot / Click'n'Load JDownloader 2
function sendToJDownloader(packageName, downloadUrl, referrer = '', cookies = '') {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      package: packageName,
      urls: downloadUrl,
      referer: referrer || '',
      cookies: cookies || '',
      autostart: '1',
      dir: 'D:\\Game\\Shopee\\GameDownload'
    })

    const req = http.request(
      {
        host: '127.0.0.1',
        port: 9666,
        path: '/flash/add',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Origin': 'http://filecrypt.cc'
        },
        timeout: 4000
      },
      (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode })
        } else {
          reject(new Error(`JDownloader merespons dengan status HTTP ${res.statusCode}`))
        }
      }
    )

    req.on('error', (err) => reject(err))
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Koneksi ke port JDownloader 2 (9666) timeout'))
    })

    req.write(postData)
    req.end()
  })
}

// ── GET: Ping & Health Check untuk Ekstensi Browser ──
export async function GET(request) {
  const isJdRunning = checkJDownloaderRunning()
  const activeStreamTasks = streamDownloader.getTasks().filter((t) => t.status === 'downloading')
  return NextResponse.json({
    success: true,
    service: 'MyGameON Download Catcher Bridge',
    status: 'online',
    engine: 'native_stream',
    activeTasksCount: activeStreamTasks.length,
    jdownloaderRunning: isJdRunning,
    targetDirectory: 'D:\\Game\\Shopee\\GameDownload',
    timestamp: new Date().toISOString()
  })
}

// ── POST: Tangkap Unduhan dari Ekstensi dan Mulai Download Native ──
export async function POST(request) {
  try {
    // 🛡️ Lapis 1: Autentikasi Kunci Rahasia Eksklusif
    const authKey = request.headers.get('x-mygameon-key')
    const secretKey = process.env.DOWNLOAD_CATCHER_KEY || 'mgo_catcher_sec_99a8b7c6d5e4f3a2b1'

    let isAuthorized = authKey === secretKey
    if (!isAuthorized) {
      // Fallback: Cek sesi login aktif di browser
      const session = await auth()
      if (session?.user?.email) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Kunci rahasia (Secret Key) tidak valid atau salah.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { url, filename, referrer, cookies, pageTitle, engine } = body

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL unduhan tidak ditemukan.' }, { status: 400 })
    }

    // Bersihkan nama paket game
    let cleanPackageName = filename
    if (!cleanPackageName) {
      const rawName = pageTitle || (function () {
        try {
          return path.basename(new URL(url).pathname)
        } catch (_) {
          return 'GameDownload'
        }
      })()
      cleanPackageName = cleanReleaseName(rawName).trim() || 'GameDownload'
    }

    // Pilihan Engine: default adalah 'native' (Solusi 1), opsi 'jdownloader' jika diminta
    if (engine === 'jdownloader') {
      let jdActive = checkJDownloaderRunning()
      if (!jdActive) {
        try {
          spawn(JDOWNLOADER_EXE_PATH, [], { detached: true, stdio: 'ignore' }).unref()
          await new Promise((r) => setTimeout(r, 2500))
          jdActive = true
        } catch (launchErr) {
          console.warn('[Download Catcher] Gagal menjalankan JDownloader2.exe otomatis:', launchErr.message)
        }
      }

      await sendToJDownloader(cleanPackageName, url, referrer, cookies)
      return NextResponse.json({
        success: true,
        engine: 'jdownloader',
        message: `Unduhan "${cleanPackageName}" berhasil dikirim ke JDownloader 2.`,
        gameName: cleanPackageName,
        targetDir: 'D:\\Game\\Shopee\\GameDownload',
        url
      })
    }

    // 🚀 Solusi 1: Native Stream Downloader MyGameON
    const userAgent = request.headers.get('user-agent') || ''
    const task = await streamDownloader.startDownload({
      url,
      filename: cleanPackageName,
      referrer: referrer || '',
      cookies: cookies || '',
      userAgent
    })

    return NextResponse.json({
      success: true,
      engine: 'native_stream',
      message: `Unduhan "${task.filename}" berhasil ditangkap dan ditampung di antrean (Siap Mulai).`,
      task,
      targetDir: 'D:\\Game\\Shopee\\GameDownload',
      url
    })
  } catch (err) {
    console.error('[Download Catcher Error]:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

