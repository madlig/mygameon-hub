import http from 'http'
import querystring from 'querystring'
import crypto from 'crypto'
import vm from 'vm'
import path from 'path'
import { exec } from 'child_process'
import { streamDownloader } from './streamDownloader.js'
import { cleanReleaseName } from './utils.js'

const CNL_PORT = 9666
const CNL_HOST = '127.0.0.1'

if (!globalThis.__mygameonCNLState) {
  globalThis.__mygameonCNLState = {
    server: null,
    running: false,
    port: CNL_PORT,
    error: null,
    retryTimer: null,
    lastReceivedPackage: null
  }
}

const cnlState = globalThis.__mygameonCNLState

/**
 * Mendekripsi payload AES-128-CBC dari Click'n'Load v2 (FileCrypt)
 */
export function decryptCNL2(cryptedBase64, jkCode) {
  let keyHex = ''
  try {
    const sandbox = {}
    vm.createContext(sandbox)
    // Evaluasi fungsi f() yang mengembalikan string 16-byte hex
    const script = `${jkCode}; f();`
    keyHex = vm.runInContext(script, sandbox, { timeout: 1000 })
  } catch (_) {
    // Fallback ekstraksi regex jika VM gagal
    const m = jkCode.match(/return\s+['"]([a-fA-F0-9]{32})['"]/)
    if (m) keyHex = m[1]
  }

  if (!keyHex || keyHex.length !== 32) {
    throw new Error(`Kunci CNL2 tidak valid (panjang hex: ${keyHex?.length || 0})`)
  }

  const key = Buffer.from(keyHex, 'hex')
  const iv = key // Protokol Click'n'Load 2: IV identik dengan Key
  const encryptedBuf = Buffer.from(cryptedBase64, 'base64')

  let decrypted = ''
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
    decrypted = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]).toString('utf-8')
  } catch (_) {
    // Fallback: tanpa auto-padding untuk mengantisipasi zero-padding dari beberapa sender
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
    decipher.setAutoPadding(false)
    decrypted = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]).toString('utf-8')
    decrypted = decrypted.replace(/\0+$/, '').replace(/[\x00-\x1F]+$/, '')
  }

  const links = decrypted
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/[\x00-\x1F]+$/, ''))
    .filter((l) => /^https?:\/\//i.test(l))

  return links
}

export function killJDownloaderProcess() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // 1. Matikan proses wrapper JDownloader2.exe
      // 2. Hanya matikan javaw.exe yang spesifik menjalankan JDownloader (tidak membunuh Java app lain)
      const cmd = `taskkill /F /IM JDownloader2.exe 2>nul & powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { ($_.Name -eq 'javaw.exe' -or $_.Name -eq 'java.exe') -and $_.CommandLine -like '*JDownloader*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`
      exec(cmd, (err) => {
        if (!err) {
          console.log('[CNL Server] JDownloader 2 berhasil ditutup secara terisolasi')
        }
        // Beri jeda 600ms agar port 9666 terbebas sepenuhnya
        setTimeout(resolve, 600)
      })
    } else {
      resolve()
    }
  })
}

/**
 * Menjalankan listener HTTP lokal port 9666 untuk menangkap Click'n'Load
 */
export function startCNLServer() {
  if (cnlState.running && cnlState.server) {
    return cnlState
  }

  try {
    const server = http.createServer((req, res) => {
      // 1. Tangani CORS Preflight untuk semua origin (FileCrypt, browser dll)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Origin, Accept, Authorization')

      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      const urlObj = new URL(req.url, `http://${req.headers.host || '127.0.0.1:9666'}`)
      const pathname = urlObj.pathname

      // 2. Health check & JDownloader detection handshake
      if (pathname === '/jdcheck.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' })
        res.end("jdownloader=true; var version='9.581';\n")
        return
      }

      if (pathname === '/crossdomain.xml') {
        res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' })
        res.end(
          '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n<allow-access-from domain="*" />\n</cross-domain-policy>\n'
        )
        return
      }

      if (pathname === '/flashgot' || pathname === '/flash') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('JDownloader\n')
        return
      }

      // 3. Tangkap payload Click'n'Load v2 (FileCrypt, OvaGames, dll)
      if (req.method === 'POST' && (pathname === '/flash/addcrypted2' || pathname === '/flash/add')) {
        let bodyRaw = ''
        req.on('data', (chunk) => {
          bodyRaw += chunk
          if (bodyRaw.length > 5 * 1024 * 1024) {
            req.destroy() // Cegah flood memory > 5MB
          }
        })

        req.on('end', async () => {
          try {
            const parsed = querystring.parse(bodyRaw)
            let urls = []
            let packageName = parsed.package || ''
            let passwords = parsed.passwords || ''
            let source = parsed.source || req.headers.referer || ''

            if (pathname === '/flash/addcrypted2') {
              const { crypted, jk } = parsed
              if (!crypted || !jk) {
                res.writeHead(400, { 'Content-Type': 'text/plain' })
                res.end('crypted dan jk wajib disertakan\n')
                return
              }
              urls = decryptCNL2(crypted, jk)
            } else {
              // Endpoint /flash/add (plaintext URLs)
              const rawUrls = parsed.urls || ''
              urls = rawUrls.split(/[\r\n,]+/).map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u))
            }

            if (urls.length === 0) {
              res.writeHead(400, { 'Content-Type': 'text/plain' })
              res.end('Tidak ada URL valid yang ditemukan dalam payload\n')
              return
            }

            // Bersihkan nama paket game
            if (!packageName) {
              try {
                packageName = path.basename(new URL(urls[0]).pathname).replace(/\.(rar|zip|7z|part\d+.*)$/i, '')
              } catch (_) {
                packageName = `GamePackage-${Date.now()}`
              }
            }
            const cleanTitle = cleanReleaseName(packageName) || 'GamePackage'

            console.log(`[CNL Server] Berhasil mendekripsi ${urls.length} link part untuk paket: "${cleanTitle}"`)

            // Masukkan seluruh URL ke antrean Stream Downloader
            const queuedTasks = await streamDownloader.queuePackage({
              packageName: cleanTitle,
              urls,
              referrer: source,
              cookies: parsed.cookies || '',
              passwords: passwords ? String(passwords) : 'mygameon'
            })

            cnlState.lastReceivedPackage = {
              packageName: cleanTitle,
              partCount: urls.length,
              time: new Date().toISOString()
            }

            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('success\r\n')
          } catch (decErr) {
            console.error('[CNL Server] Gagal memproses payload ClicknLoad:', decErr.message)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end(`error: ${decErr.message}\n`)
          }
        })
        return
      }

      // 4. Default 404
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found\n')
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        cnlState.running = false
        cnlState.error = 'Port 9666 sedang dipakai oleh aplikasi lain (misal JDownloader 2). Tutup JDownloader 2 agar MyGameON mengambil alih Click\'n\'Load.'
        console.warn(`[CNL Server] ${cnlState.error}`)

        // Coba bind ulang setiap 10 detik secara otomatis jika port telah dibebaskan
        if (!cnlState.retryTimer) {
          cnlState.retryTimer = setInterval(() => {
            if (!cnlState.running) {
              console.log('[CNL Server] Mencoba mengikat ulang port 9666...')
              startCNLServer()
            }
          }, 10000)
        }
      } else {
        cnlState.error = err.message
        console.error('[CNL Server Error]:', err.message)
      }
    })

    server.listen(CNL_PORT, CNL_HOST, () => {
      cnlState.server = server
      cnlState.running = true
      cnlState.error = null
      if (cnlState.retryTimer) {
        clearInterval(cnlState.retryTimer)
        cnlState.retryTimer = null
      }
      console.log(`[CNL Server] 🚀 Listener Click'n'Load MyGameON aktif di http://${CNL_HOST}:${CNL_PORT}`)
    })
  } catch (err) {
    cnlState.running = false
    cnlState.error = err.message
    console.error('[CNL Server] Gagal memulai listener:', err.message)
  }

  return cnlState
}

export function getCNLStatus() {
  return {
    running: !!cnlState.running,
    port: CNL_PORT,
    error: cnlState.error,
    lastReceivedPackage: cnlState.lastReceivedPackage
  }
}
