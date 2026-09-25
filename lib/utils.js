import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Konversi nilai date dari Google Sheets ke ISO string.
// Sheets menyimpan tanggal sebagai serial number (hari sejak 30 Des 1899)
// ketika ditulis dengan USER_ENTERED. Baca dengan UNFORMATTED_VALUE agar
// dapat angka ini, lalu konversi ke timestamp Unix yang akurat.
export function parseSheetDate(val) {
  if (val === undefined || val === null || val === '') return ''
  if (typeof val === 'number') {
    // 25569 = selisih hari antara epoch Sheets (30 Des 1899) dan Unix (1 Jan 1970)
    return new Date((val - 25569) * 86400 * 1000).toISOString()
  }
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toISOString()
}

// Membersihkan nama game dari tag repacker, scene group, ekstensi, dan kode build
export function cleanReleaseName(name) {
  if (!name || typeof name !== 'string') return ''
  let cleaned = name
    // Hapus ekstensi file arsip
    .replace(/\.(rar|zip|7z|iso|exe|tar|gz)$/i, '')
    // Hapus scene group / repacker tag (misal: -FitGirl, _DODI, .SteamRIP, RUNE, EMPRESS, dll)
    .replace(/[-_.\s]+(FitGirl|DODI|SteamRIP|EMPRESS|Razor1911|CODEX|PLAZA|CPY|SKIDROW|FLT|TiNYiSO|RUNE|TENOKE|ElAmigos|GOG|Repack|MULTi\d+|Build\.\d+|DirectPlay)\b.*/i, '')
    // Hapus indikator versi (misal: v1.0.3, .v1.2, _v2023)
    .replace(/[-_.\s]+v\d+(\.\d+)*[a-z]?\b.*/i, '')
    // Hapus kode awalan publisher internal/repacker (misal: OG19804-)
    .replace(/^[A-Z]{2,}\d+[-_]/i, '')
    // Ganti titik dan underscore dengan spasi
    .replace(/[._]/g, ' ')
    // Bersihkan spasi ganda
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || name
}

