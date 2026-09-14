import { NextResponse } from 'next/server'

// Safe Shopee description header (battle-tested)
const SAFE_HEADER = `HARAP DIBACA SEBELUM MEMESAN:
• Pengiriman file cepat dan aman melalui GDrive (server stabil full speed, bukan akun sharing).
• Format file RAR rapi dan anti-corrupt.
• SUDAH DISERTAKAN VIDEO TUTORIAL cara download dan ekstrak yang mudah diikuti pemula.
• Panduan instalasi langkah-demi-langkah (step-by-step) tersedia jelas di dalam folder.
• Bebas dimainkan offline selamanya tanpa batas waktu.

PERHATIAN PENTING (SPESIFIKASI):
• Pastikan perangkat PC / Laptop Anda memenuhi minimum requirement game ini sebelum order.
• Jika ragu mengenai spesifikasi perangkat Anda, silakan gunakan fitur Chat Shopee untuk konsultasi gratis.
• Jika mengalami kendala saat instalasi, silakan chat toko kami agar dibantu sampai berhasil main.`

const SAFE_FOOTER = `PENGIRIMAN & KETENTUAN BONUS:
• Cantumkan alamat email aktif di Catatan Pesanan saat checkout atau kirimkan di Chat Shopee.
• Akses link dikirim kilat dalam waktu 5–15 menit di jam operasional toko.
• Garansi file dan link aktif sampai game berhasil dimainkan.
• Syarat klaim bonus game: Cukup konfirmasi pesanan selesai dan berikan ulasan positif di toko kami.`

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
}

function sanitizeSpecs(rawText) {
  if (!rawText) return ''
  let text = stripHtml(rawText)

  const forbiddenWords = [
    'anti-piracy', 'anti-cheat', 'vmprotect', 'denuvo', 'battleye',
    'click here', 'klik di sini', 'uses steam', 'valve® corporation',
    'valve corporation', 'internet connection required', 'third-party drm'
  ]

  const lines = text.split('\n')
  const cleanLines = lines.filter(line => {
    const l = line.toLowerCase()
    return !forbiddenWords.some(bad => l.includes(bad))
  })

  let cleaned = cleanLines.join('\n')
    .replace(/\bdigital\s+deluxe\b/gi, 'Deluxe Edition')
    .replace(/\bdigital\b/gi, '')
    .replace(/\bdark\s*horse\b/gi, '')
    .replace(/\bragnarok\b/gi, 'Ragnarook')
    .replace(/\bragnarök\b/gi, 'Ragnarook')
    .replace(/[ \t]+/g, ' ')
    .trim()

  return cleaned
}

function cleanGameTitle(rawTitle) {
  return rawTitle
    .replace(/^(GAME PC|PC GAME)\s*[-–:]\s*/i, '')
    .replace(/(multi\d+)?-?(elamigos|dodi|fitgirl|gog|tenoke|rune|skidrow|codex|emp|plaza|razor1911|reloaded|flt)/gi, '')
    .replace(/deluxe edition|ultimate edition|premium edition|gold edition|complete edition/gi, '')
    .replace(/\s*\((PC|Windows|Game PC|Download Game Murah|Full Version)\)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSeoTitle(cleanTitle, genre) {
  const primaryGenre = genre || 'Action Adventure'
  let title = `${cleanTitle} - Game PC Offline ${primaryGenre} Full Version`
  if (title.length > 120) {
    title = `${cleanTitle} - Game PC Offline Full Version`
  }
  if (title.length > 120) {
    title = `${cleanTitle} - Game PC Offline`
  }
  if (title.length > 120) {
    title = title.substring(0, 120).trim()
  }
  return title
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get('query')

    if (!rawQuery) {
      return NextResponse.json({ success: false, error: 'Query atau Judul game wajib diisi' }, { status: 400 })
    }

    let appId = null
    const cleanQuery = rawQuery.trim()

    // 1. Check if user entered Steam URL e.g. store.steampowered.com/app/1245620/ELDEN_RING
    const urlMatch = cleanQuery.match(/store\.steampowered\.com\/app\/(\d+)/i)
    if (urlMatch) {
      appId = urlMatch[1]
    } else if (/^\d+$/.test(cleanQuery)) {
      appId = cleanQuery
    } else {
      // Search Steam Store API
      const searchTitle = cleanGameTitle(cleanQuery)
      const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(searchTitle)}&l=indonesian&cc=ID`
      
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      })
      const searchData = await searchRes.json()

      if (searchData && searchData.items && searchData.items.length > 0) {
        appId = searchData.items[0].id
      }
    }

    if (!appId) {
      return NextResponse.json({ 
        success: false, 
        error: `Game "${cleanQuery}" tidak ditemukan di database Steam. Silakan coba masukkan Steam AppID atau link toko Steam.` 
      }, { status: 404 })
    }

    // 2. Fetch full App Details
    const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=indonesian`
    const detailsRes = await fetch(detailsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })
    const detailsData = await detailsRes.json()

    if (!detailsData || !detailsData[appId] || !detailsData[appId].success) {
      return NextResponse.json({ 
        success: false, 
        error: `Gagal mengambil detail untuk Steam AppID ${appId}` 
      }, { status: 502 })
    }

    const game = detailsData[appId].data
    const cleanTitle = cleanGameTitle(game.name || '')
    const coverUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`

    // Extract screenshots
    const screenshots = (game.screenshots || [])
      .slice(0, 4)
      .map(s => s.path_full || s.path_thumbnail)

    // Extract genres
    const genres = (game.genres || []).map(g => g.description)
    const primaryGenre = genres[0] || 'Action Adventure'

    // Extract PC specs
    let specsText = ''
    if (game.pc_requirements) {
      if (typeof game.pc_requirements.minimum === 'string') {
        specsText += sanitizeSpecs(game.pc_requirements.minimum)
      }
      if (typeof game.pc_requirements.recommended === 'string') {
        if (specsText) specsText += '\n\n'
        specsText += sanitizeSpecs(game.pc_requirements.recommended)
      }
    }

    const synopsis = stripHtml(game.short_description || '')
    const seoTitle = buildSeoTitle(cleanTitle, primaryGenre)

    // Construct clean, ready-to-use Shopee description
    const fullDescription = [
      SAFE_HEADER,
      '',
      'RINGKASAN GAME:',
      synopsis || `Rasakan pengalaman bermain ${cleanTitle} dengan grafis memukau dan alur cerita yang seru.`,
      '',
      specsText ? specsText : 'SPESIFIKASI MINIMUM:\n• OS: Windows 10 / 11 64-bit\n• RAM: 8 GB\n• Storage: Ruang kosong mencukupi',
      '',
      SAFE_FOOTER
    ].join('\n')

    return NextResponse.json({
      success: true,
      data: {
        appId,
        title: cleanTitle,
        originalName: game.name,
        coverUrl,
        screenshots,
        genres,
        primaryGenre,
        synopsis,
        specsText,
        seoTitle,
        description: fullDescription
      }
    })
  } catch (error) {
    console.error('API /api/listing/search Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
