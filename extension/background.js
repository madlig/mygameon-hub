// ── MyGameON Download Catcher (Firefox Background Service) ──
// Eksklusif untuk MyGameON Hub & JDownloader 2

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
  ]
}

// In-memory cache untuk deduplikasi unduhan ganda dalam rentang 5 detik
const recentCatches = new Map()

// Ambil konfigurasi tersimpan
async function getConfig() {
  try {
    const res = await browser.storage.local.get(DEFAULT_CONFIG)
    return { ...DEFAULT_CONFIG, ...res }
  } catch (_) {
    return DEFAULT_CONFIG
  }
}

// Tampilkan notifikasi desktop
function showNotification(id, title, message) {
  try {
    browser.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: title || 'MyGameON Download Catcher',
      message: message || ''
    })
  } catch (e) {
    console.warn('[Catcher] Notification error:', e)
  }
}

// ── Listener Utama: Tangkap Setiap Unduhan yang Dimulai di Firefox ──
browser.downloads.onCreated.addListener(async (downloadItem) => {
  const config = await getConfig()
  if (!config.enabled) return

  const rawUrl = downloadItem.url || ''
  const filename = downloadItem.filename || ''
  const lowerUrl = rawUrl.toLowerCase()
  const lowerFilename = filename.toLowerCase()

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
      await browser.downloads.cancel(downloadItem.id)
      await browser.downloads.erase({ id: downloadItem.id })
    } catch (_) {}
    return
  }
  recentCatches.set(rawUrl, now)

  // ⚡ Langkah 1: Batalkan download bawaan Firefox secara instan
  try {
    await browser.downloads.cancel(downloadItem.id)
    await browser.downloads.erase({ id: downloadItem.id })
  } catch (cancelErr) {
    console.warn('[Catcher] Gagal membatalkan download browser:', cancelErr)
  }

  // ⚡ Langkah 2: Ambil Cookies & Referrer dari tab aktif
  let cookiesString = ''
  let referrerUrl = downloadItem.referrer || ''
  let pageTitle = ''

  try {
    // Ambil cookies untuk domain URL unduhan
    const cookies = await browser.cookies.getAll({ url: rawUrl })
    if (cookies && cookies.length > 0) {
      cookiesString = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    }
  } catch (cookieErr) {
    console.warn('[Catcher] Gagal membaca cookies:', cookieErr)
  }

  try {
    // Ambil info tab aktif jika referrer kosong
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
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
