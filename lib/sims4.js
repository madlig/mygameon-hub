// Konstanta & helper bersama untuk The Sims 4 (dipakai halaman Order & Kelola lisensi).

export const SIMS4_DOWNLOAD_URL = 'https://mygameon.store'
export const SIMS4_EXTRACT_PASSWORD = 'mygameonlauncher'
export const SIMS4_TUTORIAL_URL = 'https://bit.ly/vidtutorekstrakdownload'

// Pesan pengiriman siap-salin untuk dikirim ke pembeli (chat Shopee/WA).
export function buildSims4DeliveryMessage(invoice, allowCC) {
  const paket = allowCC ? 'Premium (Full Mods/CC)' : 'Standard (Game Only)'
  return [
    'Halo kak! Pesanan The Sims 4 kamu sudah aktif ✅',
    '',
    `🔑 License Key: ${invoice}`,
    `📦 Paket: ${paket}`,
    `🔒 Password Extract: ${SIMS4_EXTRACT_PASSWORD}`,
    '',
    'Cara pakai:',
    `1. Download launcher di ${SIMS4_DOWNLOAD_URL}`,
    '2. Buka launcher, lalu masukkan License Key di atas',
    `3. Tutorial instalasi: ${SIMS4_TUTORIAL_URL}`,
    '',
    'Terima kasih sudah belanja di MyGameON 🎮',
  ].join('\n')
}
