/**
 * lib/steamEnrichment.js
 * 
 * Modul untuk mengambil metadata & aset resmi dari Steam Store API / SteamDB
 * berdasarkan nama game atau Steam AppID.
 * 
 * ATURAN KETAT:
 * Modul ini TIDAK PERNAH mengubah totalSize (bytes) inventori fisik Google Drive.
 * Kebutuhan storage dari Steam hanya dicatat sebagai teks spesifikasi PC.
 */

/**
 * Membersihkan nama folder mentah (misal: "Cyberpunk 2077 v2.12 [DODI Repack]")
 * menjadi judul game murni untuk pencarian Steam ("Cyberpunk 2077").
 */
export function cleanRawFolderName(rawName = '') {
  if (!rawName) return '';

  let cleaned = rawName;

  // 1. Buang pola tanda kurung kurawal/siku/bundar yang berisi tag repack/versi
  // Contoh: [DODI Repack], (FitGirl), [v1.6.0], (Build 123456), [MULTI12]
  cleaned = cleaned.replace(/\[[^\]]*repack[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\([^)]*repack[^)]*\)/gi, '');
  cleaned = cleaned.replace(/\[[^\]]*dodi[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[[^\]]*elamigos[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[[^\]]*fitgirl[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[[^\]]*gog[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[[^\]]*portable[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[[^\]]*flt[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[[^\]]*rune[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[[^\]]*tenoke[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[v?\d+(\.\d+)+[^\]]*\]/gi, ''); // [v1.2.3]
  cleaned = cleaned.replace(/\(v?\d+(\.\d+)+[^)]*\)/gi, ''); // (v1.2.3)
  cleaned = cleaned.replace(/v?\d+(\.\d+)+/gi, ''); // v1.2.3 di tengah teks
  cleaned = cleaned.replace(/build\s*\d+/gi, '');

  // 2. Buang akhiran rilis scene/repacker seperti -GOG, -FLT, -RUNE, -DODI
  cleaned = cleaned.replace(/[-–—]\s*(gog|flt|rune|tenoke|codex|repack|skidrow|cpy|cpg|dodi|fitgirl|plaza)\b/gi, '');

  // 3. Ganti underscore / titik yang berfungsi sebagai pemisah spasi
  cleaned = cleaned.replace(/[._]/g, ' ');

  // 4. Buang karakter non-alfanumerik di ujung teks & rapikan spasi ganda
  cleaned = cleaned.replace(/[-–—]+$/, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned || rawName.trim();
}

/**
 * Helper untuk menghapus tag HTML dari teks deskripsi / spek Steam
 */
function stripHtml(html = '') {
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, "'")
    .replace(/&trade;/g, '')
    .replace(/&reg;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parsing teks spesifikasi PC Steam menjadi objek terstruktur (OS, CPU, RAM, GPU, Storage)
 */
function parsePcRequirements(reqHtml = '') {
  if (!reqHtml || typeof reqHtml !== 'string') return null;

  const plain = stripHtml(reqHtml);
  const lines = plain.split('\n').map((l) => l.trim()).filter(Boolean);

  const result = {
    os: '',
    cpu: '',
    ram: '',
    gpu: '',
    storage: '',
    directx: '',
  };

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('os:') || lower.startsWith('sistem operasi:')) {
      result.os = line.replace(/^(os|sistem operasi):\s*/i, '').trim();
    } else if (lower.startsWith('processor:') || lower.startsWith('prosesor:')) {
      result.cpu = line.replace(/^(processor|prosesor):\s*/i, '').trim();
    } else if (lower.startsWith('memory:') || lower.startsWith('memori:') || lower.startsWith('ram:')) {
      result.ram = line.replace(/^(memory|memori|ram):\s*/i, '').trim();
    } else if (lower.startsWith('graphics:') || lower.startsWith('grafik:')) {
      result.gpu = line.replace(/^(graphics|grafik):\s*/i, '').trim();
    } else if (lower.startsWith('storage:') || lower.startsWith('penyimpanan:')) {
      result.storage = line.replace(/^(storage|penyimpanan):\s*/i, '').trim();
    } else if (lower.startsWith('directx:')) {
      result.directx = line.replace(/^directx:\s*/i, '').trim();
    }
  }

  return result;
}

/**
 * Cari game di Steam Store API berdasarkan judul bersih
 * @param {string} cleanTitle
 * @returns {Promise<string|null>} appId
 */
export async function searchSteamAppId(cleanTitle) {
  if (!cleanTitle) return null;

  try {
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanTitle)}&l=indonesian&cc=ID`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (data && Array.isArray(data.items) && data.items.length > 0) {
      return String(data.items[0].id);
    }
    return null;
  } catch (err) {
    console.error(`[SteamEnrichment] Search error for "${cleanTitle}":`, err.message);
    return null;
  }
}

/**
 * Ambil detail lengkap game dari Steam Store API berdasarkan appId
 * @param {string} appId
 */
export async function getSteamAppDetails(appId) {
  if (!appId) return null;

  try {
    const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=indonesian`;
    const res = await fetch(detailsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;
    const json = await res.json();

    if (!json || !json[appId] || !json[appId].success) return null;

    const data = json[appId].data;

    // Poster vertikal 3:4 standar 600x900
    const coverImageUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
    const headerBannerUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;

    // Ambil maksimal 4 screenshot gameplay beresolusi tinggi
    const screenshots = (data.screenshots || [])
      .slice(0, 4)
      .map((s) => s.path_full || s.path_thumbnail)
      .filter(Boolean);

    // Genre resmi
    const genres = (data.genres || []).map((g) => g.description).filter(Boolean);

    // Deskripsi ringkas
    const shortDescription = stripHtml(data.short_description || '');

    // Release Year
    const releaseDateStr = data.release_date?.date || '';
    const yearMatch = releaseDateStr.match(/\b(19\d\d|20\d\d)\b/);
    const releaseYear = yearMatch ? yearMatch[1] : '';

    const developer = Array.isArray(data.developers) && data.developers.length > 0 ? data.developers[0] : '';

    // Spesifikasi PC
    const pcReq = data.pc_requirements || {};
    const minSpecs = parsePcRequirements(pcReq.minimum) || {};
    const recSpecs = parsePcRequirements(pcReq.recommended) || {};

    return {
      steamAppId: String(appId),
      cleanTitle: data.name || '',
      coverImageUrl,
      headerBannerUrl,
      screenshots,
      genres,
      shortDescription,
      releaseYear,
      developer,
      specs: {
        minimum: {
          os: minSpecs.os || 'Windows 10 (64-bit)',
          cpu: minSpecs.cpu || '',
          ram: minSpecs.ram || '',
          gpu: minSpecs.gpu || '',
          storage: minSpecs.storage || '',
          directx: minSpecs.directx || '',
        },
        recommended: {
          os: recSpecs.os || 'Windows 10 / 11 (64-bit)',
          cpu: recSpecs.cpu || '',
          ram: recSpecs.ram || '',
          gpu: recSpecs.gpu || '',
          storage: recSpecs.storage || '',
          directx: recSpecs.directx || '',
        },
      },
    };
  } catch (err) {
    console.error(`[SteamEnrichment] Details error for appId ${appId}:`, err.message);
    return null;
  }
}

/**
 * Fungsi komprehensif: membersihkan nama, mencari Steam, dan mengembalikan metadata lengkap.
 * @param {string} rawFolderName - Nama folder game dari Google Drive
 * @param {string} [manualAppId] - Optional appId jika sudah diketahui
 */
export async function fetchSteamEnrichment(rawFolderName, manualAppId = null) {
  const cleanTitle = cleanRawFolderName(rawFolderName);
  const appId = manualAppId || (await searchSteamAppId(cleanTitle));

  if (!appId) {
    return {
      cleanTitle,
      steamAppId: null,
      coverImageUrl: null,
      headerBannerUrl: null,
      screenshots: [],
      genres: ['PC Game'],
      shortDescription: '',
      specs: null,
    };
  }

  const details = await getSteamAppDetails(appId);
  if (!details) {
    return {
      cleanTitle,
      steamAppId: appId,
      coverImageUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
      headerBannerUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
      screenshots: [],
      genres: ['PC Game'],
      shortDescription: '',
      specs: null,
    };
  }

  return details;
}
