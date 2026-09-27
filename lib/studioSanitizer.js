import fs from 'fs'
import path from 'path'

// ── Pola File Sampah / Promosi Pihak Ketiga yang Wajib Dihapus ──
const JUNK_EXTENSIONS = ['.url', '.website']
const JUNK_FILENAMES = [
  'desktop.ini',
  'thumbs.db',
  '.ds_store',
  'readme.txt',
  'read_me.txt',
  'read me.txt',
  'readme.nfo',
  'instructions.txt',
  'how to run game.txt',
  'how to run.txt',
  'how_to_run.txt',
  'how-to-run.txt',
  'install note.txt',
  'install notes.txt',
  'install_notes.txt',
  'torrent-downloaded-from.txt',
  'torrent_downloaded_from.txt'
]

// Pola kata kunci situs bajakan/scene luar pada nama file
const JUNK_NAME_KEYWORDS = [
  'ovagames',
  'steamrip',
  'fitgirl',
  'dodi-repack',
  'dodi',
  'skidrow',
  'codex',
  'elamigos',
  'tenoke',
  'rune',
  'flt',
  'goldberg',
  'repack',
  'downloaded_from',
  'www.'
]

/**
 * Memeriksa apakah suatu file merupakan file sampah/iklan pihak ketiga
 */
function isJunkFile(fileName, filePath) {
  const lowerName = fileName.toLowerCase()

  // 1. Ekstensi .url dan .website selalu merupakan sampah iklan luar
  if (JUNK_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return true
  }

  // 2. File sistem Windows / OS
  if (JUNK_FILENAMES.includes(lowerName)) {
    return true
  }

  // 3. File text / nfo yang mengandung nama situs luar
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.nfo')) {
    const hasJunkKeyword = JUNK_NAME_KEYWORDS.some((kw) => lowerName.includes(kw))
    if (hasJunkKeyword) {
      // Pastikan bukan file konfigurasi penting game (misal steam_emu.ini, language.txt)
      if (lowerName !== 'language.txt' && lowerName !== 'languages.txt') {
        return true
      }
    }

    // Periksa isi file jika ukuran kecil (< 50 KB) apakah ada link ke domain luar
    try {
      const stats = fs.statSync(filePath)
      if (stats.size < 50 * 1024) {
        const content = fs.readFileSync(filePath, 'utf-8').toLowerCase()
        const externalPromoDomains = [
          'ovagames.com',
          'steamrip.com',
          'fitgirl-repacks.site',
          'dodi-repacks.site',
          '1337x.to',
          'torrentgalaxy',
          'rutracker',
          'gload.to',
          'cs.rin.ru',
          'igg-games',
          'skidrowcodex'
        ]
        if (externalPromoDomains.some((dom) => content.includes(dom))) {
          // Jika isinya promo domain luar, bersihkan
          return true
        }
      }
    } catch (_) {}
  }

  return false
}

/**
 * Deteksi format instalasi game berdasarkan isi folder
 */
export function detectPackageType(folderPath) {
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return { packageType: 'UNKNOWN', isoFiles: [], exeFiles: [], mainExecutable: null }
  }

  const items = fs.readdirSync(folderPath)
  const isoFiles = []
  const exeFiles = []
  let hasBinInstaller = false
  let hasSetupExe = false

  for (const item of items) {
    const lower = item.toLowerCase()
    const full = path.join(folderPath, item)
    try {
      const stat = fs.statSync(full)
      if (stat.isFile()) {
        if (lower.endsWith('.iso')) {
          isoFiles.push(item)
        } else if (lower.endsWith('.exe')) {
          exeFiles.push(item)
          if (lower === 'setup.exe' || lower.startsWith('install') || lower.startsWith('setup')) {
            hasSetupExe = true
          }
        } else if (lower.match(/\.(bin|arc|dat|cab)$/)) {
          hasBinInstaller = true
        }
      } else if (stat.isDirectory()) {
        // Cek subfolder 1 level (misal di folder game ada setup atau iso)
        try {
          const subItems = fs.readdirSync(full)
          for (const sub of subItems) {
            const subLower = sub.toLowerCase()
            if (subLower.endsWith('.iso')) isoFiles.push(path.join(item, sub))
            if (subLower.endsWith('.exe')) exeFiles.push(path.join(item, sub))
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  // 1. Tipe DISC_IMAGE (ISO)
  if (isoFiles.length > 0) {
    return {
      packageType: 'ISO',
      isoFiles,
      exeFiles,
      mainExecutable: isoFiles[0],
      displayBadge: 'DISC IMAGE (.ISO)'
    }
  }

  // 2. Tipe REPACK INSTALLER (setup.exe + file arsip .bin)
  if (hasSetupExe && hasBinInstaller) {
    return {
      packageType: 'REPACK',
      isoFiles,
      exeFiles,
      mainExecutable: 'setup.exe',
      displayBadge: 'REPACK INSTALLER'
    }
  }

  // 3. Tipe PRE-INSTALLED (Portable)
  // Cari executable game utama (hindari unins000.exe, crash reporter, redist)
  let candidateExe = exeFiles.find((e) => {
    const l = e.toLowerCase()
    return (
      !l.includes('unins') &&
      !l.includes('setup') &&
      !l.includes('redist') &&
      !l.includes('vcredist') &&
      !l.includes('directx') &&
      !l.includes('dxsetup') &&
      !l.includes('crash') &&
      !l.includes('unitycrashhandler')
    )
  })

  if (!candidateExe && exeFiles.length > 0) {
    candidateExe = exeFiles[0]
  }

  return {
    packageType: 'PRE-INSTALLED',
    isoFiles,
    exeFiles,
    mainExecutable: candidateExe || (exeFiles[0] ? path.basename(exeFiles[0]) : 'Game.exe'),
    displayBadge: 'PRE-INSTALLED'
  }
}

/**
 * Generate isi teks Panduan Resmi Instalasi MyGameON
 */
function generateGuideContent(gameTitle, formatInfo) {
  const dateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
  const border = '========================================================================'
  const divider = '------------------------------------------------------------------------'

  let stepsText = ''

  if (formatInfo.packageType === 'ISO') {
    const isoName = formatInfo.mainExecutable ? path.basename(formatInfo.mainExecutable) : `${gameTitle}.iso`
    stepsText = `[PETUNJUK INSTALASI - FORMAT DISC IMAGE / ISO]

1. EKSTRAK FILE
   - Ekstrak seluruh part RAR menggunakan aplikasi WinRAR versi terbaru.
   - Pastikan seluruh part (Part 1, Part 2, dst.) berada di folder yang sama.
   - Password RAR: mygameon (jika diminta).

2. MOUNT FILE ISO
   - Di Windows 10 atau Windows 11, Anda TIDAK MEMERLUKAN aplikasi tambahan.
   - Cukup KLIK DUA KALI (Double-Click) pada file:
     👉 "${isoName}"
   - Windows akan otomatis membuka file tersebut sebagai Virtual DVD Drive.

3. JALANKAN SETUP
   - Masuk ke drive DVD virtual tersebut, klik kanan pada file "setup.exe"
     lalu pilih "Run as administrator".
   - Tentukan folder instalasi dan ikuti instruksi di layar sampai 100% selesai.

4. SELESAI & MAINKAN
   - Setelah instalasi selesai, Anda bisa me-remount/eject drive ISO.
   - Buka game langsung dari shortcut Desktop PC Anda!`
  } else if (formatInfo.packageType === 'REPACK') {
    stepsText = `[PETUNJUK INSTALASI - FORMAT REPACK INSTALLER]

1. EKSTRAK FILE
   - Ekstrak seluruh part RAR menggunakan aplikasi WinRAR versi terbaru.
   - Pastikan seluruh part berada di folder yang sama.
   - Password RAR: mygameon (jika diminta).

2. JALANKAN SETUP INSTALLER
   - Klik kanan pada file "setup.exe" lalu pilih "Run as administrator".
   - Jika RAM PC Anda 8 GB atau kurang, centang opsi "Limit RAM usage to 2GB/3GB"
     saat awal installer agar proses instalasi stabil dan lancar.
   - Tunggu hingga proses dekompresi selesai 100%.

3. SELESAI & MAINKAN
   - Game siap dimainkan langsung melalui shortcut Desktop!`
  } else {
    // PRE-INSTALLED (PLUG & PLAY)
    const exeName = formatInfo.mainExecutable ? path.basename(formatInfo.mainExecutable) : 'Game.exe'
    stepsText = `[PETUNJUK BERMAIN - FORMAT PRE-INSTALLED / PLUG & PLAY]

1. EKSTRAK FILE
   - Ekstrak seluruh part RAR menggunakan WinRAR versi terbaru.
   - Password RAR: mygameon (jika diminta).

2. LANGSUNG MAINKAN (TANPA INSTALL)
   - Buka folder game hasil ekstraksi.
   - Cari file utama game:
     👉 "${exeName}"
   - Klik kanan pada file tersebut lalu pilih "Run as administrator".
   - Game akan langsung terbuka dan siap dimainkan!

3. TROUBLESHOOTING FILE PENDUKUNG (JIKA DIPERLUKAN)
   - Jika saat dibuka muncul error berkas hilang (DirectX / MSVCP / VCRUNTIME),
     buka folder "_Redist" di dalam folder game dan install "vcredist_x64.exe"
     serta jalankan "dxsetup.exe".`
  }

  return `${border}
              MYGAMEON OFFICIAL STORE - PANDUAN INSTALASI GAME
${border}
Nama Game        : ${gameTitle}
Tipe Format      : ${formatInfo.displayBadge}
Diperbarui Pada  : ${dateStr}
Official Store   : https://mygameon.store
Official Shopee  : MyGameON Official Store
${divider}

${stepsText}

${divider}
[GARANSI & BANTUAN TEKNIS MYGAMEON]
- Seluruh game di MyGameON telah diuji coba dan dijamin 100% Work & Bersih.
- Mengalami kendala saat ekstrak atau instalasi?
  Hubungi kami langsung via Chat Shopee / WhatsApp Support.
  Tim teknisi kami siap membantu hingga game berjalan lancar di PC Anda!

Terima kasih telah mempercayakan kebutuhan gaming Anda kepada MyGameON!
${border}`
}

/**
 * Generate isi teks Garansi dan Layanan Pelanggan MyGameON
 */
function generateWarrantyContent(gameTitle) {
  const border = '========================================================================'
  const divider = '------------------------------------------------------------------------'

  return `${border}
                 MYGAMEON STORE - GARANSI & LAYANAN KONSUMEN
${border}
Produk : ${gameTitle}
Domain : https://mygameon.store

KAMI BERKOMITMEN MEMBERIKAN PENGALAMAN GAMING TERBAIK UNTUK ANDA:

1. 100% WORK GUARANTEE
   Seluruh berkas game diunggah langsung ke server Google Drive berkecepatan
   tinggi dan dilengkapi dengan 5% Recovery Record pada arsip WinRAR untuk
   mencegah kerusakan data (corrupt) saat download.

2. PANDUAN REMOTE ASSISTANCE (BANTUAN JARAK JAUH)
   Jika Anda mengalami kendala spesifikasi, file hilang, atau bingung saat
   menginstal, admin teknisi kami menyediakan layanan panduan gratis melalui
   AnyDesk atau UltraViewer hingga game sukses dimainkan.

3. KETENTUAN PENGGUNAAN
   - Pastikan PC Anda memenuhi spesifikasi minimum game yang tertera pada toko.
   - Selalu matikan sementara Antivirus / Windows Defender jika terjadi false
     positive pada file emulator game.

Hubungi admin kami melalui fitur chat toko Shopee untuk layanan cepat!
${border}`
}

/**
 * Shortcut Web URL Windows (.url)
 */
function generateStoreUrlContent() {
  return `[InternetShortcut]
URL=https://mygameon.store
IconIndex=0
`
}

/**
 * Fungsi Utama: Bersihkan file sampah pihak ketiga dan sisipkan branding MyGameON
 * @param {string} targetFolderPath - Path absolut direktori game di lokal
 * @param {string} [customTitle] - Judul bersih game untuk personalisasi dokumen
 * @returns {object} Ringkasan hasil sanitasi dan injeksi branding
 */
export function sanitizeAndBrandGameFolder(targetFolderPath, customTitle = null) {
  if (!fs.existsSync(targetFolderPath)) {
    throw new Error(`Target folder tidak ditemukan: ${targetFolderPath}`)
  }

  const folderName = path.basename(targetFolderPath)
  const gameTitle =
    customTitle ||
    folderName
      .replace(/[-_.](MULTi\d+|ElAmigos|CODEX|RUNE|TENOKE|FitGirl|DODI|Repack|SKIDROW|FLT|GoldBerg)/gi, '')
      .replace(/[._]/g, ' ')
      .trim()

  const deletedFiles = []
  const addedFiles = []

  // 1. Pindai dan Hapus File Sampah di Root Folder Game
  try {
    const rootItems = fs.readdirSync(targetFolderPath)
    for (const item of rootItems) {
      const fullPath = path.join(targetFolderPath, item)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isFile() && isJunkFile(item, fullPath)) {
          fs.unlinkSync(fullPath)
          deletedFiles.push(item)
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn(`[Sanitizer] Gagal memindai root folder ${targetFolderPath}:`, err.message)
  }

  // 2. Deteksi Format Game Setelah Dibersihkan
  const formatInfo = detectPackageType(targetFolderPath)

  // 3. Sisipkan File Branding Resmi MyGameON
  try {
    // A. File Shortcut Toko Resmi MyGameON
    const storeUrlPath = path.join(targetFolderPath, '🌐 MYGAMEON STORE.url')
    fs.writeFileSync(storeUrlPath, generateStoreUrlContent(), 'utf-8')
    addedFiles.push('🌐 MYGAMEON STORE.url')

    // B. File Panduan Resmi Instalasi MyGameON
    const guideTxtPath = path.join(targetFolderPath, '📖 PANDUAN_INSTALASI_MYGAMEON.txt')
    fs.writeFileSync(guideTxtPath, generateGuideContent(gameTitle, formatInfo), 'utf-8')
    addedFiles.push('📖 PANDUAN_INSTALASI_MYGAMEON.txt')

    // C. File Garansi & Layanan Konsumen
    const warrantyTxtPath = path.join(targetFolderPath, '🛡️ GARANSI_DAN_BANTUAN_MYGAMEON.txt')
    fs.writeFileSync(warrantyTxtPath, generateWarrantyContent(gameTitle), 'utf-8')
    addedFiles.push('🛡️ GARANSI_DAN_BANTUAN_MYGAMEON.txt')
  } catch (err) {
    console.error(`[Branding] Gagal menulis file branding ke ${targetFolderPath}:`, err.message)
  }

  return {
    folderName,
    gameTitle,
    targetFolderPath,
    packageType: formatInfo.packageType,
    displayBadge: formatInfo.displayBadge,
    mainExecutable: formatInfo.mainExecutable,
    deletedFiles,
    addedFiles
  }
}
