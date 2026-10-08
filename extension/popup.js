const DEFAULT_CONFIG = {
  enabled: true,
  serverUrl: 'http://127.0.0.1:3000',
  secretKey: 'mgo_catcher_sec_99a8b7c6d5e4f3a2b1'
}

document.addEventListener('DOMContentLoaded', async () => {
  const toggleEnabled = document.getElementById('toggleEnabled')
  const inputSecretKey = document.getElementById('inputSecretKey')
  const btnSave = document.getElementById('btnSave')
  const saveAlert = document.getElementById('saveAlert')
  const statusDot = document.getElementById('statusDot')
  const statusText = document.getElementById('statusText')
  const jdStatus = document.getElementById('jdStatus')

  // 1. Muat konfigurasi tersimpan
  let currentConfig = { ...DEFAULT_CONFIG }
  try {
    const stored = await browser.storage.local.get(DEFAULT_CONFIG)
    currentConfig = { ...DEFAULT_CONFIG, ...stored }
  } catch (_) {}

  toggleEnabled.checked = currentConfig.enabled !== false
  inputSecretKey.value = currentConfig.secretKey || DEFAULT_CONFIG.secretKey

  // 2. Cek koneksi ke backend Hub & JDownloader
  async function checkHealth() {
    try {
      const res = await fetch(`${currentConfig.serverUrl}/api/download/catch`, {
        method: 'GET',
        cache: 'no-store'
      })
      if (res.ok) {
        const data = await res.json()
        statusDot.className = 'dot online'
        statusText.innerText = 'Terhubung ke MyGameON Hub'
        statusText.style.color = '#10b981'

        if (data.jdownloaderRunning) {
          jdStatus.innerText = 'JDownloader 2: Aktif (Siap)'
          jdStatus.style.color = '#a1a1aa'
        } else {
          jdStatus.innerText = 'JDownloader 2: Offline (Akan dijalankan otomatis)'
          jdStatus.style.color = '#f59e0b'
        }
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (e) {
      statusDot.className = 'dot offline'
      statusText.innerText = 'MyGameON Hub Offline'
      statusText.style.color = '#ef4444'
      jdStatus.innerText = 'Buka MyGameON Hub di PC Anda'
      jdStatus.style.color = '#a1a1aa'
    }
  }

  checkHealth()

  // 3. Simpan perubahan
  btnSave.addEventListener('click', async () => {
    const updated = {
      enabled: toggleEnabled.checked,
      secretKey: inputSecretKey.value.trim() || DEFAULT_CONFIG.secretKey
    }

    try {
      await browser.storage.local.set(updated)
      saveAlert.style.display = 'block'
      setTimeout(() => {
        saveAlert.style.display = 'none'
      }, 2500)
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message)
    }
  })
})
