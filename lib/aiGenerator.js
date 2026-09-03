import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

function resolveGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY

  const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config')
  const possiblePaths = [
    path.join(appData, 'MyGameON Studio', '.env.local'),
    path.join(appData, 'mygameon-hub', '.env.local'),
    path.join(process.resourcesPath || '', '.env.local'),
    path.join(process.cwd(), '.env.local'),
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf-8')
        for (const line of content.split(/\r?\n/)) {
          const match = line.trim().match(/^GEMINI_API_KEY\s*=\s*(.*)$/)
          if (match) {
            let val = match[1].trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1)
            }
            if (val) {
              process.env.GEMINI_API_KEY = val
              return val
            }
          }
        }
      } catch (_) {}
    }
  }
  return null
}

export async function generateShopeeListing(gameTitle, gameSynopsis) {
  const apiKey = resolveGeminiApiKey()
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY tidak ditemukan di .env.local')
  }

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `
  Saya menjual Game PC Digital (Offline) di Shopee bernama "${gameTitle}".
  Tugas Anda adalah meracik metadata Shopee HANYA berdasarkan teks mentah di bawah ini.

  Teks Mentah dari Website (Sinopsis):
  "${gameSynopsis}"

  Model Bisnis Saya:
  - Game PC Offline (Bukan Steam).
  - File dikirim lewat Google Drive (ber-part) via Email/Chat.
  - Jaminan akses pribadi 100% lancar.
  - Langsung bisa dimainkan setelah di-extract (Sangat mudah diinstal).
  - Promo Bundle (Ulasan Bintang 5 = Game Gratis).

  Tugas Spesifik:
  1. JUDUL: Maksimalkan hingga 120 karakter. Hapus kata "termurah". Buat clickbait (Contoh: GAME PC - [Nama] Ultimate Edition - FULL VERSION Download Extract).
  2. DESKRIPSI (Gunakan metode AIDA untuk Paragraf Pembuka):
     - [ATTENTION]: Pancing perhatian pembeli (Contoh: "Ingin memainkan [Nama Game] tanpa ribet instalasi rumit?").
     - [INTEREST]: Berikan 1-2 kalimat sinopsis paling menarik dari game ini berdasarkan teks mentah.
     - [DESIRE]: Jelaskan mengapa beli di toko kami menguntungkan (100% Aman, GDrive Akses Pribadi, Bisa langsung main).
     - [ACTION]: Ajakan bertindak (Contoh: "Checkout sekarang dan rasakan petualangannya hari ini juga!").
  3. SPESIFIKASI: Cari dan susun spesifikasi minimum (OS, Processor, Memory, Graphics, Storage) yang 100% akurat untuk game ini berdasarkan pengetahuan Anda tentang data resmi Steam/SteamDB. Format sekonsisten dan serapi mungkin.

  PENTING: Output HARUS berupa JSON murni dengan dua keys: "title" dan "description".
  Gunakan format persis seperti template di bawah ini untuk bagian PERATURAN & SPESIFIKASI.

  {
    "title": "GAME PC - [Nama Game] - FULL VERSION Download Extract Langsung Main",
    "description": "[AIDA PARAGRAF PEMBUKA DISINI]\\n\\nHarap Dibaca Sebelum Membeli:\\n• Setelah melakukan pemesanan, file game dikirimkan ke gdrive lewat email.\\n• Proses lancar dan stabil, jaminan akses pribadi 100% (bukan publik/gabungan).\\n• File sudah tersusun rapi agar mudah diakses. Petunjuk pemasangan lengkap sudah kami siapkan agar praktis.\\n• Diperlukan koneksi internet untuk proses download dan instalasi.\\n\\nPerhatian Penting:\\n• Pastikan perangkat PC/Laptop Anda memenuhi spesifikasi (minimum requirements) yang tertulis di bawah.\\n• Jika ragu, silakan chat admin untuk konsultasi spesifikasi.\\n• Jika mengalami kendala saat instalasi, langsung chat admin agar dibantu sampai bisa play.\\n\\nPengiriman & Link Download:\\n• File dikirim via Chat/Email dalam waktu 5–15 menit di jam operasional.\\n• Proses cepat, admin selalu standby jika ada kendala.\\n• File dapat diunduh kapan saja dan disimpan untuk backup di kemudian hari.\\n\\nCARA KLAIM BONUS GAME GRATIS(PROMO BUNDLE):\\nCukup follow toko kami dan berikan ulasan bintang 5 di produk ini. Bonus akan dikirim setelah Anda konfirmasi ke admin via chat!\\n\\nSPESIFIKASI MINIMUM (PC/Laptop):\\n[Tulis Spesifikasi yang Diekstrak Disini]\\n\\n#GamePC #[NamaGameTanpaSpasi] #GameLaptop #DownloadGamePC"
  }
  `

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    })
    
    // The model is forced to return JSON because of responseMimeType
    const resultText = response.text
    return JSON.parse(resultText)
  } catch (error) {
    console.error('Gemini AI Error:', error)
    throw new Error('Gagal meracik SEO dengan AI: ' + error.message)
  }
}
