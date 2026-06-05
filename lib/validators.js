// Validasi & normalisasi input yang dipakai sebelum aksi tak-bisa-dibatalkan
// (share akses Drive, kirim email, revoke). Tujuannya cegah salah kirim.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(value) {
  if (typeof value !== 'string') return false
  return EMAIL_RE.test(value.trim())
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}
