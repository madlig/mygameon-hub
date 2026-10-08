import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { cleanReleaseName } from './utils.js'
import { getDownloadConfig } from './downloadWatcher.js'
import { extractMultiPartArchive } from './extractor.js'
import { startCNLServer } from './cnlServer.js'

const TASKS_STATE_FILE = path.join(process.cwd(), 'download-tasks.json')

/**
 * Ekstraksi nama berkas asli dari URL hosting (MediaFire, PixelDrain, Gofile, Buzzheavier, dsb.)
 */
export function extractFilenameFromUrl(urlStr, defaultName = '', index = 0, total = 1) {
  try {
    const parsed = new URL(urlStr)
    const segments = parsed.pathname.split('/').filter(Boolean)
    // Cari segmen dari belakang yang memiliki ekstensi file asli (.rar, .zip, .iso, .7z)
    for (let s = segments.length - 1; s >= 0; s--) {
      const seg = decodeURIComponent(segments[s]).trim()
      if (seg && seg.toLowerCase() !== 'file' && /\.[a-z0-9]+$/i.test(seg)) {
        return seg.replace(/[\\/:*?"<>|]/g, '').trim()
      }
    }
  } catch (_) {}

  const pad = String(index + 1).padStart(2, '0')
  return total > 1 ? `${defaultName}.part${pad}.rar` : `${defaultName}.rar`
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function formatEta(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return null
  if (seconds < 60) return `${Math.round(seconds)}d tersisa`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}m ${s}d tersisa`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}j ${m}m tersisa`
}

/**
 * Pengurai direct URL untuk hosting yang menyediakan landing page (misal MediaFire / PixelDrain)
 */
export async function resolveDirectUrl(url, userAgent = '') {
  if (!url) return url
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    // 1. MediaFire Landing Page Resolver
    if (host.includes('mediafire.com')) {
      if (host.startsWith('download')) {
        return url
      }
      const resp = await fetch(url, {
        headers: {
          'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
      })
      const html = await resp.text()
      const match =
        html.match(/aria-label=["']Download file["'][^>]*href=["']([^"']+)["']/i) ||
        html.match(/id=["']downloadButton["'][^>]*href=["']([^"']+)["']/i) ||
        html.match(/href=["'](https?:\/\/download[^"']+)["']/i) ||
        html.match(/href=["']([^"']+)["'][^>]*id=["']downloadButton["']/i)

      if (match && match[1]) {
        console.log(`[URL Resolver] Berhasil resolve MediaFire direct URL: ${match[1].slice(0, 80)}...`)
        return match[1]
      }
    }

    // 2. PixelDrain Resolver (/u/ID -> /api/file/ID)
    if (host.includes('pixeldrain.com') && parsed.pathname.startsWith('/u/')) {
      const fileId = parsed.pathname.replace('/u/', '')
      return `https://pixeldrain.com/api/file/${fileId}`
    }

    // 3. Gofile Landing Page Resolver (/d/ID)
    if (host.includes('gofile.io')) {
      const contentId = parsed.pathname.replace(/^\/d\//, '').replace(/^\//, '').split('/')[0]
      if (contentId) {
        // Ambil guest token atau gunakan token cache
        if (!globalThis.__gofileToken) {
          try {
            const accRes = await fetch('https://api.gofile.io/accounts', { method: 'POST' })
            const accData = await accRes.json()
            if (accData.status === 'ok' && accData.data?.token) {
              globalThis.__gofileToken = accData.data.token
            }
          } catch (_) {}
        }

        const token = globalThis.__gofileToken || 'MRtBzcceYcgza8U8w41cDthTs1VtNoCN'
        const contentRes = await fetch(`https://api.gofile.io/contents/${contentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const contentData = await contentRes.json()

        if (contentData.status === 'error-notPremium') {
          throw new Error('Gofile: Berkas dibatasi hanya untuk akun Premium (Server Gofile Overload/Premium Only)')
        }
        if (contentData.status === 'error-notFound') {
          throw new Error('Gofile: Berkas tidak ditemukan atau telah dihapus oleh pengunggah')
        }
        if (contentData.status === 'ok' && contentData.data) {
          const direct = contentData.data.directLink || contentData.data.link
          if (direct) {
            console.log(`[URL Resolver] Berhasil resolve Gofile direct URL untuk ${contentId}: ${direct.slice(0, 80)}...`)
            return direct
          }
          if (contentData.data.children) {
            const firstChild = Object.values(contentData.data.children)[0]
            if (firstChild && (firstChild.directLink || firstChild.link)) {
              return firstChild.directLink || firstChild.link
            }
          }
        }
      }
    }

    // 4. Buzzheavier / BZZHR Resolver (/f/ID -> /f/ID/download)
    if (host.includes('buzzheavier.com') || host.includes('bzzhr.to')) {
      if (parsed.pathname.startsWith('/f/') && !parsed.pathname.endsWith('/download')) {
        const direct = `https://${parsed.hostname}${parsed.pathname}/download`
        console.log(`[URL Resolver] Direct stream Buzzheavier diarahkan ke: ${direct}`)
        return direct
      }
    }

    return url
  } catch (err) {
    console.warn(`[URL Resolver] Gagal resolve URL (${url}):`, err.message)
    if (err.message.includes('Gofile:')) {
      throw err
    }
    return url
  }
}

class StreamDownloader {
  constructor() {
    this.tasks = new Map() // id -> task object

    // Booting server Click'n'Load Port 9666 saat StreamDownloader dimuat
    try {
      startCNLServer()
    } catch (e) {
      console.warn('[StreamDownloader] Inisialisasi awal CNL Server tertunda:', e.message)
    }

    // Muat antrean unduhan tersimpan dari disk agar tahan saat aplikasi ditutup/restart
    this.loadTasksFromDisk()
  }

  saveTasksToDisk() {
    try {
      const serializable = []
      for (const task of this.tasks.values()) {
        serializable.push({
          id: task.id,
          url: task.url,
          filename: task.filename,
          cleanTitle: task.cleanTitle,
          packageName: task.packageName,
          customDir: task.customDir,
          filePath: task.filePath,
          tempPath: task.tempPath,
          referrer: task.referrer,
          cookies: task.cookies,
          userAgent: task.userAgent,
          password: task.password,
          // Jika sedang aktif mengunduh atau antre, simpan sebagai paused saat aplikasi ditutup
          status: task.status === 'downloading' || task.status === 'queued' ? 'paused' : task.status,
          downloadedBytes: task.downloadedBytes || 0,
          totalBytes: task.totalBytes || 0,
          progressPercent: task.progressPercent || 0,
          etaFormatted: task.status === 'downloading' || task.status === 'queued' ? '[Dijeda]' : task.etaFormatted,
          error: task.error,
          startTime: task.startTime,
          completedAt: task.completedAt
        })
      }
      fs.writeFileSync(TASKS_STATE_FILE, JSON.stringify(serializable, null, 2), 'utf-8')
    } catch (err) {
      console.error('[StreamDownloader] Gagal menyimpan download-tasks.json:', err.message)
    }
  }

  loadTasksFromDisk() {
    if (!fs.existsSync(TASKS_STATE_FILE)) return
    try {
      const raw = fs.readFileSync(TASKS_STATE_FILE, 'utf-8')
      const items = JSON.parse(raw)
      if (!Array.isArray(items)) return

      for (const item of items) {
        if (!item.id || !item.url) continue

        let downloadedBytes = item.downloadedBytes || 0
        if (item.tempPath && fs.existsSync(item.tempPath)) {
          try {
            downloadedBytes = fs.statSync(item.tempPath).size
          } catch (_) {}
        } else if (item.filePath && fs.existsSync(item.filePath)) {
          try {
            downloadedBytes = fs.statSync(item.filePath).size
          } catch (_) {}
        }

        const totalBytes = item.totalBytes || 0
        const progressPercent = totalBytes > 0
          ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10)
          : (item.progressPercent || 0)

        const isCompleted = item.status === 'completed' || (totalBytes > 0 && downloadedBytes >= totalBytes && fs.existsSync(item.filePath))
        const status = isCompleted
          ? 'completed'
          : item.status === 'staged'
          ? 'staged'
          : 'paused'

        const task = {
          ...item,
          downloadedBytes,
          progressPercent,
          speed: 0,
          speedFormatted: null,
          etaFormatted: status === 'staged' ? 'Ditampung (Siap Mulai)' : (status === 'completed' ? 'Selesai' : '[Dijeda]'),
          status,
          abortController: new AbortController()
        }

        this.tasks.set(task.id, task)
      }
      if (this.tasks.size > 0) {
        console.log(`[StreamDownloader] 📂 Berhasil memuat ${this.tasks.size} antrean unduhan tersimpan dari download-tasks.json`)
      }
    } catch (err) {
      console.error('[StreamDownloader] Gagal memuat download-tasks.json:', err.message)
    }
  }

  getTasks() {
    const list = []
    for (const [id, task] of this.tasks) {
      list.push(this.formatTask(task))
    }
    return list
  }

  getTask(id) {
    const task = this.tasks.get(id)
    return task ? this.formatTask(task) : null
  }

  formatTask(task) {
    return {
      id: task.id,
      url: task.url,
      filename: task.filename,
      cleanTitle: task.cleanTitle,
      packageName: task.packageName || null,
      customDir: task.customDir || null,
      status: task.status, // 'staged' | 'downloading' | 'queued' | 'paused' | 'completed' | 'error' | 'cancelled'
      downloadedBytes: task.downloadedBytes || 0,
      downloadedBytesFormatted: formatBytes(task.downloadedBytes || 0),
      totalBytes: task.totalBytes || 0,
      totalBytesFormatted: formatBytes(task.totalBytes || 0),
      progressPercent: task.progressPercent || 0,
      speed: task.speed || 0,
      speedFormatted: task.speed > 0 ? `${formatBytes(task.speed)}/s` : null,
      etaFormatted: task.etaFormatted,
      error: task.error || null,
      filePath: task.filePath,
      tempPath: task.tempPath,
      startTime: task.startTime,
      completedAt: task.completedAt || null,
      password: task.password || null
    }
  }

  /**
   * Menjadwalkan pemrosesan antrean task berstatus 'queued'
   */
  processQueue() {
    const config = getDownloadConfig()
    const max = config.maxConcurrent || 1

    let activeCount = 0
    for (const task of this.tasks.values()) {
      if (task.status === 'downloading') activeCount++
    }

    if (activeCount >= max) return

    for (const task of this.tasks.values()) {
      if (task.status === 'queued') {
        task.status = 'downloading'
        task.abortController = new AbortController()
        task.etaFormatted = 'Menghubungkan...'

        this.runDownloadStream(task).catch((err) => {
          console.error(`[StreamDownloader Error] (${task.filename}):`, err.message)
          task.status = 'error'
          task.error = err.message
          this.processQueue()
        })

        activeCount++
        if (activeCount >= max) break
      }
    }
  }

  /**
   * Memulai tugas unduhan tunggal yang sedang berstatus 'staged' atau 'paused'
   */
  startTask(id) {
    const task = this.tasks.get(id)
    if (!task) return false
    if (task.status === 'staged' || task.status === 'paused' || task.status === 'error') {
      task.status = 'queued'
      task.error = null
      task.etaFormatted = 'Menunggu antrean...'
      this.saveTasksToDisk()
      this.processQueue()
      return true
    }
    return false
  }

  /**
   * Memulai seluruh part dalam paket game yang berstatus 'staged'
   */
  startPackage(packageName) {
    let started = 0
    for (const task of this.tasks.values()) {
      if (task.packageName === packageName && (task.status === 'staged' || task.status === 'paused')) {
        task.status = 'queued'
        task.error = null
        task.etaFormatted = 'Menunggu antrean...'
        started++
      }
    }
    if (started > 0) {
      this.saveTasksToDisk()
      this.processQueue()
      return true
    }
    return false
  }

  /**
   * Memulai seluruh tugas yang saat ini tertampung di staging
   */
  startAllStaged() {
    let started = 0
    for (const task of this.tasks.values()) {
      if (task.status === 'staged') {
        task.status = 'queued'
        task.error = null
        task.etaFormatted = 'Menunggu antrean...'
        started++
      }
    }
    if (started > 0) {
      this.saveTasksToDisk()
      this.processQueue()
      return true
    }
    return false
  }

  removeStaged(id) {
    const task = this.tasks.get(id)
    if (!task) return false
    if (task.status === 'staged' || task.status === 'paused' || task.status === 'error') {
      if (task.tempPath && fs.existsSync(task.tempPath)) {
        try { fs.unlinkSync(task.tempPath) } catch (_) {}
      }
      this.tasks.delete(id)
      this.saveTasksToDisk()
      return true
    }
    return false
  }

  removePackage(packageName) {
    let removed = 0
    let targetFolder = null
    for (const [id, task] of this.tasks.entries()) {
      if (task.packageName === packageName && (task.status === 'staged' || task.status === 'paused' || task.status === 'error')) {
        if (task.tempPath && fs.existsSync(task.tempPath)) {
          try { fs.unlinkSync(task.tempPath) } catch (_) {}
        }
        if (task.customDir) targetFolder = task.customDir
        this.tasks.delete(id)
        removed++
      }
    }
    if (targetFolder && fs.existsSync(targetFolder)) {
      try {
        const files = fs.readdirSync(targetFolder)
        if (files.length === 0) {
          fs.rmdirSync(targetFolder)
        }
      } catch (_) {}
    }
    if (removed > 0) {
      this.saveTasksToDisk()
    }
    return removed > 0
  }

  /**
   * Memeriksa apakah seluruh part dalam suatu paket telah selesai 100%,
   * lalu otomatis memicu UnRAR ekstraksi.
   */
  async checkPackageCompletion(packageName, packageDir, password = 'mygameon') {
    if (!packageName || !packageDir) return

    const packageTasks = Array.from(this.tasks.values()).filter((t) => t.packageName === packageName)
    if (packageTasks.length === 0) return

    const allFinished = packageTasks.every((t) => t.status === 'completed')
    if (allFinished) {
      console.log(`[StreamDownloader] 📦 Seluruh part untuk paket "${packageName}" selesai (${packageTasks.length} part). Memicu UnRAR ekstraksi otomatis...`)
      try {
        await extractMultiPartArchive({
          folderPath: packageDir,
          packageName,
          password: password || 'mygameon',
          autoCleanRar: false
        })
      } catch (extErr) {
        console.warn(`[StreamDownloader] Auto-ekstraksi untuk "${packageName}" menghasilkan peringatan:`, extErr.message)
      }
    }
  }

  /**
   * Menampung seluruh URL part game dari Click'n'Load / multi-part (Default: STAGED / DITAMPUNG)
   */
  async queuePackage({ packageName, urls, referrer = '', cookies = '', userAgent = '', passwords = 'mygameon', autoStart = false }) {
    if (!urls || urls.length === 0) return []

    const config = getDownloadConfig()
    const baseDownloadDir = config.downloadDir || 'D:\\Game\\Shopee\\GameDownload'
    const packageDir = path.join(baseDownloadDir, packageName)

    if (!fs.existsSync(packageDir)) {
      fs.mkdirSync(packageDir, { recursive: true })
    }

    const queuedTasks = []

    for (let i = 0; i < urls.length; i++) {
      const u = urls[i]
      let filename = extractFilenameFromUrl(u, packageName, i, urls.length)
      filename = filename.replace(/[\\/:*?"<>|]/g, '').trim()
      const filePath = path.join(packageDir, filename)
      const tempPath = path.join(packageDir, `${filename}.downloading`)
      const id = `dl-${crypto.createHash('md5').update(filePath.toLowerCase()).digest('hex').slice(0, 16)}`

      if (this.tasks.has(id)) {
        queuedTasks.push(this.formatTask(this.tasks.get(id)))
        continue
      }

      const abortController = new AbortController()

      const task = {
        id,
        url: u,
        filename,
        cleanTitle: `${packageName} (Part ${i + 1}/${urls.length})`,
        packageName,
        customDir: packageDir,
        filePath,
        tempPath,
        referrer: referrer || '',
        cookies: cookies || '',
        userAgent: userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        password: passwords || 'mygameon',
        status: autoStart ? 'queued' : 'staged', // Ditampung dulu sesuai permintaan pengguna
        downloadedBytes: 0,
        totalBytes: 0,
        progressPercent: 0,
        speed: 0,
        etaFormatted: autoStart ? 'Menunggu antrean...' : 'Ditampung (Siap Mulai)',
        error: null,
        abortController,
        startTime: Date.now(),
        lastSpeedCheck: Date.now(),
        bytesSinceLastCheck: 0,
        completedAt: null
      }

      this.tasks.set(id, task)
      queuedTasks.push(this.formatTask(task))
    }

    this.saveTasksToDisk()

    if (autoStart) {
      this.processQueue()
    }

    return queuedTasks
  }

  async startDownload({ url, filename, referrer = '', cookies = '', userAgent = '', customDir = null, password = 'mygameon', autoStart = false }) {
    if (!url) throw new Error('URL unduhan wajib disertakan')

    const config = getDownloadConfig()
    const downloadDir = customDir || config.downloadDir || 'D:\\Game\\Shopee\\GameDownload'

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true })
    }

    let finalFilename = filename
    if (!finalFilename) {
      finalFilename = extractFilenameFromUrl(url, `download-${Date.now()}`, 0, 1)
    }
    finalFilename = finalFilename.replace(/[\\/:*?"<>|]/g, '').trim() || `download-${Date.now()}.rar`
    if (!path.extname(finalFilename)) {
      finalFilename += '.rar'
    }

    const cleanTitle = cleanReleaseName(finalFilename)
    const filePath = path.join(downloadDir, finalFilename)
    const tempPath = path.join(downloadDir, `${finalFilename}.downloading`)

    const id = `dl-${crypto.createHash('md5').update(filePath.toLowerCase()).digest('hex').slice(0, 16)}`

    const existing = this.tasks.get(id)
    if (existing) {
      return this.formatTask(existing)
    }

    const abortController = new AbortController()

    const task = {
      id,
      url,
      filename: finalFilename,
      cleanTitle,
      packageName: null,
      customDir: downloadDir,
      filePath,
      tempPath,
      referrer,
      cookies,
      userAgent: userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      password,
      status: autoStart ? 'queued' : 'staged', // Ditampung dulu sesuai permintaan pengguna
      downloadedBytes: 0,
      totalBytes: 0,
      progressPercent: 0,
      speed: 0,
      etaFormatted: autoStart ? 'Menghubungkan...' : 'Ditampung (Siap Mulai)',
      error: null,
      abortController,
      startTime: Date.now(),
      lastSpeedCheck: Date.now(),
      bytesSinceLastCheck: 0,
      completedAt: null
    }

    this.tasks.set(id, task)
    this.saveTasksToDisk()
    if (autoStart) {
      this.processQueue()
    }

    return this.formatTask(task)
  }

  async runDownloadStream(task) {
    let existingBytes = 0
    if (fs.existsSync(task.tempPath)) {
      try {
        existingBytes = fs.statSync(task.tempPath).size
      } catch (_) {}
    }

    // 🛡️ Langkah 1: Resolusi direct link jika URL merupakan landing page (misal MediaFire / PixelDrain)
    try {
      const resolved = await resolveDirectUrl(task.url, task.userAgent)
      if (resolved && resolved !== task.url) {
        task.url = resolved
      }
    } catch (_) {}

    const headers = {
      'User-Agent': task.userAgent,
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // Jangan gzip arsip agar hitungan byte akurat
    }

    if (task.referrer) {
      headers['Referer'] = task.referrer
    }

    if (task.cookies) {
      headers['Cookie'] = task.cookies
    }

    if (existingBytes > 0) {
      headers['Range'] = `bytes=${existingBytes}-`
    }

    const response = await fetch(task.url, {
      method: 'GET',
      headers,
      signal: task.abortController.signal,
      redirect: 'follow'
    })

    if (!response.ok && response.status !== 206) {
      if (existingBytes > 0 && response.status === 416) {
        try { fs.unlinkSync(task.tempPath) } catch (_) {}
        existingBytes = 0
        delete headers['Range']
        return this.runDownloadStream(task)
      }
      throw new Error(`Server hosting merespons HTTP ${response.status} (${response.statusText})`)
    }

    // 🛡️ Langkah 2: HTML Guard — Pastikan response adalah binary, bukan halaman HTML
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/html')) {
      throw new Error(`Server mengembalikan halaman web (HTML). Direct link belum teresolusi. Silakan klik download langsung dari browser atau gunakan Click'n'Load.`)
    }

    const contentLength = response.headers.get('content-length')
    const contentRange = response.headers.get('content-range')

    if (response.status === 206 && contentRange) {
      const match = contentRange.match(/\/(\d+)/)
      task.totalBytes = match ? parseInt(match[1], 10) : existingBytes + (parseInt(contentLength, 10) || 0)
    } else if (contentLength) {
      task.totalBytes = parseInt(contentLength, 10)
    }

    // 🛡️ Langkah 3: Perhitungan byte yang presisi
    // Jika server merespons 206 (Partial Content), lanjutkan append dari existingBytes.
    // Jika server merespons 200 (OK), server mengirim dari byte 0 (tidak mendukung Range),
    // maka berkas harus ditimpa ('w') dan downloadedBytes di-reset ke 0 agar persentase tidak rusak.
    const isAppend = response.status === 206 && existingBytes > 0
    task.downloadedBytes = isAppend ? existingBytes : 0
    const fileStream = fs.createWriteStream(task.tempPath, { flags: isAppend ? 'a' : 'w' })

    const reader = response.body.getReader()
    let lastUpdate = Date.now()
    let bytesInWindow = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // 🛡️ Tangani backpressure buffer agar memori RAM tidak leak/OOM pada kecepatan tinggi
        const writeOk = fileStream.write(Buffer.from(value))
        if (!writeOk) {
          await new Promise((resolve) => fileStream.once('drain', resolve))
        }

        task.downloadedBytes += value.length
        bytesInWindow += value.length

        const now = Date.now()
        const elapsed = (now - lastUpdate) / 1000

        // Perbarui kalkulasi kecepatan & progress setiap 500ms
        if (elapsed >= 0.5) {
          const instantSpeed = bytesInWindow / elapsed
          task.speed = task.speed > 0 ? (task.speed * 0.4 + instantSpeed * 0.6) : instantSpeed
          bytesInWindow = 0
          lastUpdate = now

          if (task.totalBytes > 0) {
            task.progressPercent = Math.min(99.9, Math.round((task.downloadedBytes / task.totalBytes) * 1000) / 10)
            const remainingBytes = task.totalBytes - task.downloadedBytes
            if (task.speed > 1024) {
              task.etaFormatted = formatEta(remainingBytes / task.speed)
            }
          }
        }
      }

      await new Promise((resolve, reject) => {
        fileStream.end((err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      // Ganti nama dari .downloading ke nama berkas final
      if (fs.existsSync(task.filePath)) {
        try { fs.unlinkSync(task.filePath) } catch (_) {}
      }
      fs.renameSync(task.tempPath, task.filePath)

      task.status = 'completed'
      task.progressPercent = 100
      task.speed = 0
      task.etaFormatted = 'Selesai'
      task.completedAt = new Date().toISOString()
      this.saveTasksToDisk()

      // Lanjutkan antrean task berikutnya
      this.processQueue()

      // Periksa apakah paket multi-part sudah lengkap semua untuk diekstrak
      if (task.packageName && task.customDir) {
        this.checkPackageCompletion(task.packageName, task.customDir, task.password)
      }

    } catch (streamErr) {
      try { fileStream.close() } catch (_) {}
      if (task.abortController && task.abortController.signal.aborted) {
        if (task.status !== 'paused') {
          task.status = 'cancelled'
        }
        this.saveTasksToDisk()
        return
      }
      this.saveTasksToDisk()
      throw streamErr
    }
  }

  pauseDownload(id) {
    const task = this.tasks.get(id)
    if (!task) return false
    if (task.status === 'downloading' || task.status === 'queued') {
      task.status = 'paused'
      task.speed = 0
      task.etaFormatted = '[Dijeda]'
      task.abortController.abort()
      this.saveTasksToDisk()
      this.processQueue()
      return true
    }
    return false
  }

  resumeDownload(id) {
    const task = this.tasks.get(id)
    if (!task) return false
    if (task.status === 'paused' || task.status === 'error') {
      task.status = 'queued'
      task.error = null
      task.etaFormatted = 'Menunggu antrean...'
      this.saveTasksToDisk()
      this.processQueue()
      return true
    }
    return false
  }

  pauseAll() {
    for (const task of this.tasks.values()) {
      if (task.status === 'downloading' || task.status === 'queued') {
        task.status = 'paused'
        task.speed = 0
        task.etaFormatted = '[Dijeda]'
        task.abortController.abort()
      }
    }
    this.saveTasksToDisk()
    return true
  }

  resumeAll() {
    for (const task of this.tasks.values()) {
      if (task.status === 'paused' || task.status === 'error') {
        task.status = 'queued'
        task.error = null
        task.etaFormatted = 'Menunggu antrean...'
      }
    }
    this.saveTasksToDisk()
    this.processQueue()
    return true
  }

  cancelDownload(id, deleteFile = true) {
    const task = this.tasks.get(id)
    if (!task) return false
    task.status = 'cancelled'
    task.abortController.abort()
    if (deleteFile && fs.existsSync(task.tempPath)) {
      try { fs.unlinkSync(task.tempPath) } catch (_) {}
    }
    this.tasks.delete(id)
    this.saveTasksToDisk()
    this.processQueue()
    return true
  }

  pausePackage(packageName) {
    let count = 0
    const target = (packageName || '').trim().toLowerCase()
    for (const task of this.tasks.values()) {
      const taskPkg = (task.packageName || '').trim().toLowerCase()
      const taskTitle = (task.cleanTitle || '').trim().toLowerCase()
      if (taskPkg === target || (target && (taskPkg.includes(target) || taskTitle.includes(target)))) {
        if (task.status === 'downloading' || task.status === 'queued') {
          task.status = 'paused'
          task.speed = 0
          task.etaFormatted = '[Dijeda]'
          if (task.abortController) {
            try { task.abortController.abort() } catch (_) {}
          }
          count++
        }
      }
    }
    if (count > 0) {
      this.saveTasksToDisk()
      this.processQueue()
      return true
    }
    return false
  }

  resumePackage(packageName) {
    let count = 0
    const target = (packageName || '').trim().toLowerCase()
    for (const task of this.tasks.values()) {
      const taskPkg = (task.packageName || '').trim().toLowerCase()
      const taskTitle = (task.cleanTitle || '').trim().toLowerCase()
      if (taskPkg === target || (target && (taskPkg.includes(target) || taskTitle.includes(target)))) {
        if (task.status === 'paused' || task.status === 'error') {
          task.status = 'queued'
          task.error = null
          task.etaFormatted = 'Menunggu antrean...'
          count++
        }
      }
    }
    if (count > 0) {
      this.saveTasksToDisk()
      this.processQueue()
      return true
    }
    return false
  }

  cancelPackage(packageName, deleteFile = true) {
    let count = 0
    let targetFolder = null
    const target = (packageName || '').trim().toLowerCase()

    for (const [id, task] of this.tasks.entries()) {
      const taskPkg = (task.packageName || '').trim().toLowerCase()
      const taskTitle = (task.cleanTitle || '').trim().toLowerCase()
      if (taskPkg === target || (target && (taskPkg.includes(target) || taskTitle.includes(target)))) {
        task.status = 'cancelled'
        if (task.abortController) {
          try { task.abortController.abort() } catch (_) {}
        }
        if (deleteFile) {
          if (task.tempPath && fs.existsSync(task.tempPath)) {
            try { fs.unlinkSync(task.tempPath) } catch (_) {}
          }
          if (task.filePath && fs.existsSync(task.filePath)) {
            try { fs.unlinkSync(task.filePath) } catch (_) {}
          }
        }
        if (task.customDir) {
          targetFolder = task.customDir
        }
        this.tasks.delete(id)
        count++
      }
    }

    // Bersihkan folder unduhan game jika kosong setelah berkas dibuang
    if (deleteFile && targetFolder && fs.existsSync(targetFolder)) {
      try {
        const remaining = fs.readdirSync(targetFolder)
        if (remaining.length === 0) {
          fs.rmdirSync(targetFolder)
        }
      } catch (_) {}
    }

    if (count > 0) {
      this.saveTasksToDisk()
      this.processQueue()
      return true
    }
    return false
  }
}

// Gunakan singleton pada globalThis agar state downloader tidak hilang saat Next.js hot-reload
if (!globalThis.__mygameonStreamDownloader) {
  globalThis.__mygameonStreamDownloader = new StreamDownloader()
} else {
  // Sinkronkan prototype & seluruh method agar perubahan kode terbaca instan di Next.js dev server / Turbopack
  Object.setPrototypeOf(globalThis.__mygameonStreamDownloader, StreamDownloader.prototype)
}

// Selalu salin/bind seluruh fungsi prototype ke instance singleton untuk menjamin kebal caching prototype
const streamInstance = globalThis.__mygameonStreamDownloader
const proto = StreamDownloader.prototype
for (const name of Object.getOwnPropertyNames(proto)) {
  if (name !== 'constructor' && typeof proto[name] === 'function') {
    streamInstance[name] = proto[name].bind(streamInstance)
  }
}

export { StreamDownloader }
export const streamDownloader = streamInstance
