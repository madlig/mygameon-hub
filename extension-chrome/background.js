// ── MyGameON Download Catcher (Chrome / Edge / Brave Background Service Worker MV3) ──
// Eksklusif untuk MyGameON Hub & JDownloader 2

const browserAPI = globalThis.browser || globalThis.chrome

const DEFAULT_CONFIG = {
  enabled: true,
  serverUrl: 'http://127.0.0.1:3000',
  secretKey: 'mgo_catcher_sec_99a8b7c6d5e4f3a2b1',
  interceptExtensions: ['.rar', '.zip', '.7z', '.iso', '.exe', '.bin', '.tar', '.gz', '.001'],
  interceptDomains: [
    'bzzhr.to',
    'buzzheavier.com',
    'steamrip.com',
    '1fichier.com',
    'gofile.io',
    'megaup.net',
    'qiwi.gg',
    'pixeldrain.com',
    'datanodes.to',
    'uploadhaven.com',
    'rapidgator.net'
  ],
  // Domain dengan token sekali pakai (burned on browser start) yang wajib dilewati agar browser mengunduh langsung
  excludeDomains: [
    'megadb.net',
    'megadb.xyz'
  ]
}

// In-memory cache untuk deduplikasi unduhan ganda dalam rentang 5 detik
const recentCatches = new Map()

// Ambil konfigurasi tersimpan
async function getConfig() {
  try {
    const res = await browserAPI.storage.local.get(DEFAULT_CONFIG)
    return { ...DEFAULT_CONFIG, ...res }
  } catch (_) {
    return DEFAULT_CONFIG
  }
}

// Tampilkan notifikasi desktop
function showNotification(id, title, message) {
  try {
    browserAPI.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: title || 'MyGameON Download Catcher',
      message: message || ''
    })
  } catch (e) {
    console.warn('[Catcher] Notification error:', e)
  }
}

// ── Listener Utama: Tangkap Setiap Unduhan yang Dimulai di Browser ──
browserAPI.downloads.onCreated.addListener(async (downloadItem) => {
  const config = await getConfig()
  if (!config.enabled) return

  const rawUrl = downloadItem.finalUrl || downloadItem.url || ''
  const filename = downloadItem.filename || ''
  const lowerUrl = rawUrl.toLowerCase()
  const lowerFilename = filename.toLowerCase()

  // 0. Cek apakah domain masuk dalam daftar yang dikecualikan (misal MegaDB yang memakai token 1x pakai)
  let isExcludedDomain = false
  try {
    const host = new URL(rawUrl).hostname.toLowerCase()
    const refHost = downloadItem.referrer ? new URL(downloadItem.referrer).hostname.toLowerCase() : ''
    isExcludedDomain = (config.excludeDomains || ['megadb.net', 'megadb.xyz']).some((d) => host.includes(d) || refHost.includes(d))
  } catch (_) {}

  if (isExcludedDomain) {
    return
  }

  // 1. Cek apakah file termasuk ekstensi target game
  const isTargetExt = config.interceptExtensions.some((ext) => {
    return lowerFilename.endsWith(ext) || lowerUrl.includes(ext)
  })

  // 2. Cek apakah berasal dari domain hosting game target
  let isTargetDomain = false
  try {
    const host = new URL(rawUrl).hostname.toLowerCase()
    isTargetDomain = config.interceptDomains.some((d) => host.includes(d))
  } catch (_) {}

  // Jika bukan file game atau hosting game, biarkan download browser biasa berjalan
  if (!isTargetExt && !isTargetDomain) {
    return
  }

  // Deduplikasi: hindari menangkap URL yang sama berulang kali dalam 5 detik
  const now = Date.now()
  if (recentCatches.has(rawUrl) && now - recentCatches.get(rawUrl) < 5000) {
    try {
      await browserAPI.downloads.cancel(downloadItem.id)
      await browserAPI.downloads.erase({ id: downloadItem.id })
    } catch (_) {}
    return
  }
  recentCatches.set(rawUrl, now)

  // ⚡ Langkah 1: Batalkan download bawaan browser secara instan
  try {
    await browserAPI.downloads.cancel(downloadItem.id)
    await browserAPI.downloads.erase({ id: downloadItem.id })
  } catch (cancelErr) {
    console.warn('[Catcher] Gagal membatalkan download browser:', cancelErr)
  }

  // ⚡ Langkah 2: Ambil Cookies & Referrer dari tab aktif
  let cookiesString = ''
  let referrerUrl = downloadItem.referrer || ''
  let pageTitle = ''

  try {
    const cookies = await browserAPI.cookies.getAll({ url: rawUrl })
    if (cookies && cookies.length > 0) {
      cookiesString = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    }
  } catch (cookieErr) {
    console.warn('[Catcher] Gagal membaca cookies:', cookieErr)
  }

  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true })
    if (tabs && tabs.length > 0) {
      if (!referrerUrl) referrerUrl = tabs[0].url || ''
      pageTitle = tabs[0].title || ''
    }
  } catch (_) {}

  const cleanDisplay = filename ? filename.split(/[/\\]/).pop() : (pageTitle || 'Berkas Game')

  showNotification(
    'catch-start',
    '⚡ MyGameON: Menangkap Unduhan',
    `Mengalihkan "${cleanDisplay}" ke MyGameON Download Hub...`
  )

  // ⚡ Langkah 3: Kirim payload ke endpoint lokal MyGameON Hub
  try {
    const response = await fetch(`${config.serverUrl}/api/download/catch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mygameon-key': config.secretKey
      },
      body: JSON.stringify({
        url: rawUrl,
        filename: cleanDisplay,
        fileSize: downloadItem.fileSize || 0,
        referrer: referrerUrl,
        cookies: cookiesString,
        pageTitle
      })
    })

    const result = await response.json().catch(() => ({}))

    if (response.ok && result.success) {
      showNotification(
        'catch-success',
        '✓ Unduhan Berhasil Ditangkap',
        `"${result.task?.filename || result.gameName || cleanDisplay}" sedang diunduh di MyGameON Download Hub.`
      )
    } else {
      showNotification(
        'catch-error',
        '⚠️ Gagal Mengalihkan Unduhan',
        result.error || `HTTP ${response.status}: Periksa apakah MyGameON Hub sedang aktif.`
      )
    }
  } catch (netErr) {
    showNotification(
      'catch-net-error',
      '⚠️ MyGameON Hub Offline',
      'Pastikan aplikasi MyGameON Hub aktif di http://127.0.0.1:3000.'
    )
  }
})
