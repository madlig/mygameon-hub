const { ipcRenderer } = require('electron')

// ── 1. NETRALISASI WINDOW.OPEN (POP-UNDER & POP-UP AD DEFUSER) ──
try {
  const originalOpen = window.open
  window.open = function (url, target, features) {
    if (!url || typeof url !== 'string') {
      console.log('[MyGameON Shield] Memblokir window.open tanpa URL')
      return null
    }

    const lower = url.toLowerCase()
    const adKeywords = [
      'adsterra',
      'propeller',
      'popads',
      'popcash',
      'exoclick',
      'juicyads',
      'onclick',
      'adcash',
      'casino',
      'slot',
      'judi',
      'betting',
      'effectivecpmgate',
      'highcpmgate',
      'alwingulla',
      'greatdexchange',
      'syndication',
      'clickadu',
      'hilltopads'
    ]

    const isAd = adKeywords.some((kw) => lower.includes(kw))
    if (isAd) {
      console.log('[MyGameON Shield] Memblokir pop-under iklan:', url)
      return null
    }

    // Jika URL adalah link download yang sah (misal filecrypt, gdrive, mega, qiwi, ovagames, dll)
    // Alihkan di tab/window yang sama agar tidak membuka jendela baru yang mengganggu
    ipcRenderer.send('game-browser-nav', { action: 'navigate', url })
    return null
  }
} catch (_) {}

// ── 2. BYPASS COUNTDOWN TIMER & SHORTENER AUTO-SKIP ──
function accelerateTimers() {
  try {
    // Percepat timer interval jika ada countdown di halaman shortener
    const origSetInterval = window.setInterval
    window.setInterval = function (fn, delay, ...args) {
      // Jika delay 1000ms (1 detik) di halaman link shortener, percepat 10x lipat
      const hostname = window.location.hostname.toLowerCase()
      if (
        hostname.includes('ouo') ||
        hostname.includes('filecrypt') ||
        hostname.includes('link') ||
        hostname.includes('short') ||
        hostname.includes('paste')
      ) {
        if (delay >= 1000) {
          delay = 100
        }
      }
      return origSetInterval(fn, delay, ...args)
    }
  } catch (_) {}
}
accelerateTimers()

// ── 3. PEMBERSIH OVERLAY & ELEMEN IKLAN DOM SECARA BERKALA ──
function cleanAdElements() {
  try {
    // Hapus overlay transparan yang menjebak klik mouse (z-index tinggi atau fixed cover)
    const allDivs = document.querySelectorAll('div, a, iframe')
    for (const el of allDivs) {
      const style = window.getComputedStyle(el)
      if (style.position === 'fixed' || style.position === 'absolute') {
        const zIndex = parseInt(style.zIndex, 10)
        if (zIndex >= 99999) {
          // Cek apakah elemen ini transparan (iklan jebakan pop-under)
          const rect = el.getBoundingClientRect()
          const isFullScreen =
            rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8
          if (isFullScreen && (style.opacity === '0' || style.backgroundColor.includes('rgba(0, 0, 0, 0)'))) {
            el.remove()
            console.log('[MyGameON Shield] Menghapus overlay jebakan popunder transparan')
          }
        }
      }

      // Hapus iframe iklan umum
      if (el.tagName === 'IFRAME') {
        const src = (el.src || '').toLowerCase()
        if (
          src.includes('banner') ||
          src.includes('ad') ||
          src.includes('pop') ||
          src.includes('cpm') ||
          src.includes('syndication')
        ) {
          el.remove()
        }
      }
    }
  } catch (_) {}
}

// ── 4. FLOATING GLASSMORPhIC TOOLBAR MYGAMEON ──
function injectToolbar() {
  if (document.getElementById('mygameon-browser-bar')) return

  const bar = document.createElement('div')
  bar.id = 'mygameon-browser-bar'
  bar.style.cssText = `
    position: fixed !important;
    top: 12px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    background: rgba(10, 11, 15, 0.92) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 9999px !important;
    padding: 6px 14px !important;
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(16, 185, 129, 0.15) !important;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    user-select: none !important;
    color: #ffffff !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  `

  bar.innerHTML = `
    <!-- Logo & Brand Badge -->
    <div style="display: flex; align-items: center; gap: 6px; padding-right: 6px; border-right: 1px solid rgba(255, 255, 255, 0.12);">
      <span style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 6px; background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 10px;">
        🛡️
      </span>
      <span style="font-weight: 900; letter-spacing: 0.5px; background: linear-gradient(135deg, #10b981, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        MyGameON Shield
      </span>
    </div>

    <!-- Navigation Arrows -->
    <div style="display: flex; align-items: center; gap: 4px;">
      <button id="mg-btn-back" title="Kembali (Alt+Left)" style="cursor: pointer; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: background 0.15s;">
        ‹
      </button>
      <button id="mg-btn-forward" title="Maju (Alt+Right)" style="cursor: pointer; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: background 0.15s;">
        ›
      </button>
      <button id="mg-btn-reload" title="Muat Ulang (F5)" style="cursor: pointer; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; transition: background 0.15s;">
        ⟳
      </button>
    </div>

    <!-- Quick Switcher Sumber Game -->
    <div style="display: flex; align-items: center; gap: 4px; padding-left: 6px; border-left: 1px solid rgba(255, 255, 255, 0.12);">
      <button id="mg-quick-ova" title="Buka OvaGames" style="cursor: pointer; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; border-radius: 9999px; padding: 3px 9px; font-size: 10px; font-weight: 800;">
        🎮 OvaGames
      </button>
      <button id="mg-quick-steamrip" title="Buka SteamRIP" style="cursor: pointer; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; border-radius: 9999px; padding: 3px 9px; font-size: 10px; font-weight: 800;">
        ⚡ SteamRIP
      </button>
      <button id="mg-quick-fitgirl" title="Buka FitGirl Repacks" style="cursor: pointer; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); color: #c084fc; border-radius: 9999px; padding: 3px 9px; font-size: 10px; font-weight: 800;">
        📦 FitGirl
      </button>
      <button id="mg-quick-dodi" title="Buka DODI Repacks" style="cursor: pointer; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); color: #f472b6; border-radius: 9999px; padding: 3px 9px; font-size: 10px; font-weight: 800;">
        🚀 DODI
      </button>
    </div>

    <!-- Live Status Protection Badge -->
    <div style="display: flex; align-items: center; gap: 4px; padding-left: 6px; border-left: 1px solid rgba(255, 255, 255, 0.12); color: #34d399; font-size: 9px; font-mono; font-weight: 800;">
      <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
      <span>BEBAS IKLAN & AUTO-BYPASS</span>
    </div>

    <!-- Minimize Toggle -->
    <button id="mg-btn-toggle" title="Sembunyikan Bilah" style="cursor: pointer; background: transparent; border: none; color: rgba(255,255,255,0.4); margin-left: 2px; font-size: 11px; padding: 2px 4px;">
      ✕
    </button>
  `

  document.body.appendChild(bar)

  // Pasang Listener Navigasi
  document.getElementById('mg-btn-back')?.addEventListener('click', () => {
    ipcRenderer.send('game-browser-nav', { action: 'back' })
  })
  document.getElementById('mg-btn-forward')?.addEventListener('click', () => {
    ipcRenderer.send('game-browser-nav', { action: 'forward' })
  })
  document.getElementById('mg-btn-reload')?.addEventListener('click', () => {
    ipcRenderer.send('game-browser-nav', { action: 'reload' })
  })

  // Quick Switchers
  document.getElementById('mg-quick-ova')?.addEventListener('click', () => {
    window.location.href = 'https://www.ovagames.com'
  })
  document.getElementById('mg-quick-steamrip')?.addEventListener('click', () => {
    window.location.href = 'https://steamrip.com'
  })
  document.getElementById('mg-quick-fitgirl')?.addEventListener('click', () => {
    window.location.href = 'https://fitgirl-repacks.site'
  })
  document.getElementById('mg-quick-dodi')?.addEventListener('click', () => {
    window.location.href = 'https://dodi-repacks.site'
  })

  // Toggle Collapse
  let isCollapsed = false
  const toggleBtn = document.getElementById('mg-btn-toggle')
  toggleBtn?.addEventListener('click', () => {
    isCollapsed = !isCollapsed
    if (isCollapsed) {
      bar.style.transform = 'translateX(-50%) translateY(-38px)'
      bar.style.opacity = '0.4'
    } else {
      bar.style.transform = 'translateX(-50%) translateY(0)'
      bar.style.opacity = '1'
    }
  })

  // Expand on hover jika collapsed
  bar.addEventListener('mouseenter', () => {
    if (isCollapsed) {
      bar.style.transform = 'translateX(-50%) translateY(0)'
      bar.style.opacity = '1'
    }
  })
  bar.addEventListener('mouseleave', () => {
    if (isCollapsed) {
      bar.style.transform = 'translateX(-50%) translateY(-38px)'
      bar.style.opacity = '0.4'
    }
  })
}

// ── 5. HIGHLIGHT CLICK'N'LOAD PADA FILECRYPT ──
function highlightClickAndLoad() {
  try {
    const hostname = window.location.hostname.toLowerCase()
    if (hostname.includes('filecrypt')) {
      const cnlButtons = document.querySelectorAll(
        'button.cnl, input[value*="Click\'n\'Load"], input[value*="ClicknLoad"], .cnl_button, a.cnl'
      )
      for (const btn of cnlButtons) {
        btn.style.outline = '3px solid #10b981'
        btn.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.6)'
        btn.style.transition = 'all 0.3s ease'
      }
    }
  } catch (_) {}
}

// Inisialisasi saat DOM siap
window.addEventListener('DOMContentLoaded', () => {
  cleanAdElements()
  injectToolbar()
  highlightClickAndLoad()

  // Pantau perubahan dinamis halaman (ad scripts inject on scroll/click)
  setInterval(() => {
    cleanAdElements()
    highlightClickAndLoad()
  }, 1500)
})
