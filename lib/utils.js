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
