// Konstanta & helper bersama untuk The Sims 4 & template pengiriman pesanan.

export const STORE_WEBSITE = 'mygameon.store'
export const SIMS4_DOWNLOAD_URL = 'https://mygameon.store'
export const SIMS4_EXTRACT_PASSWORD = 'mygameonlauncher'
export const SIMS4_TUTORIAL_URL = 'https://bit.ly/vidtutorekstrakdownload'

/**
 * Cek apakah nama item adalah The Sims 4
 */
export function isSims4Game(name) {
  if (!name || typeof name !== 'string') return false
  const n = name.toLowerCase()
  return n.includes('sims 4') || n.includes('the sims 4')
}

// Pesan pengiriman siap-salin untuk dikirim ke pembeli (chat Shopee/WA) - Khusus Sims 4
// Bersih dari icon/emoji dan tanpa protokol http/www agar lolos filter chat Shopee
export function buildSims4DeliveryMessage(invoice, allowCC, email = '') {
  const paket = allowCC ? 'Premium (Full Mods/CC)' : 'Standard (Game Only)'
  const lines = [
    'Halo kak! Pesanan The Sims 4 kamu sudah aktif.',
    '',
    `License Key: ${invoice || '—'}`,
    `Paket: ${paket}`,
    `Password Extract: ${SIMS4_EXTRACT_PASSWORD}`,
    '',
    'Cara pakai:',
    `1. Download launcher di website: ${STORE_WEBSITE}`,
    '2. Buka launcher, lalu masukkan License Key di atas',
    '3. Video tutorial & panduan instalasi sudah disertakan langsung di folder Google Drive dan di email kamu ya kak.',
  ]

  if (email) {
    lines.push('', `Akses Google Drive juga telah dibagikan ke: ${email}`)
  }

  lines.push('', 'Terima kasih sudah belanja di MyGameON.')
  return lines.join('\n')
}

/**
 * Pesan pengiriman terpadu siap-salin (bisa game PC biasa, Sims 4, atau gabungan)
 * Didesain tanpa icon/emoji dan tanpa http/https/www agar aman dari pemblokiran filter chat Shopee.
 */
export function buildDeliveryChatMessage({ invoice, email, pcGames = [], sims4Items = [] }) {
  // Kasus 1: Hanya The Sims 4
  if (sims4Items.length > 0 && pcGames.length === 0) {
    return buildSims4DeliveryMessage(invoice, sims4Items[0]?.allowCC, email)
  }

  // Kasus 2: Hanya Game PC Biasa
  if (pcGames.length > 0 && sims4Items.length === 0) {
    const lines = [
      'Halo kak! Pesanan game kamu sudah kami proses dan akses sudah aktif.',
      '',
      'Game yang dikirim:',
      ...pcGames.map(g => `- ${g.name}`),
    ]

    if (email) {
      lines.push(
        '',
        'Akses download Google Drive sudah dikirim ke email:',
        email,
        '(Silakan cek folder Inbox atau Spam email kamu ya kak)'
      )
    }

    lines.push(
      '',
      'Petunjuk download & instalasi:',
      '- Video tutorial cara download & ekstrak sudah disertakan langsung di dalam folder Google Drive dan di email kamu ya kak.',
      '- Download file part satu per satu secara bergantian.',
      '- Tambahkan folder game ke daftar pengecualian antivirus sebelum ekstrak file.',
      '',
      'Terima kasih banyak sudah berbelanja di MyGameON.'
    )
    return lines.join('\n')
  }

  // Kasus 3: Gabungan Game PC Biasa + The Sims 4
  const lines = [
    'Halo kak! Pesanan game kamu sudah kami proses dan akses sudah aktif.',
    '',
    'Detail Pesanan:',
    ...pcGames.map(g => `- ${g.name} (Akses Google Drive)`),
    ...sims4Items.map(s => `- ${s.name} [${s.allowCC ? 'Premium Mods/CC' : 'Standard Game Only'}]`),
    '',
    'Kredensial The Sims 4:',
    `- License Key: ${invoice || '—'}`,
    `- Password Extract: ${SIMS4_EXTRACT_PASSWORD}`,
    `- Download launcher di website: ${STORE_WEBSITE}`,
  ]

  if (email) {
    lines.push(
      '',
      'Akses Google Drive juga sudah dikirim ke email:',
      email,
      '(Silakan cek folder Inbox atau Spam email kamu ya kak)'
    )
  }

  lines.push(
    '',
    'Petunjuk instalasi:',
    '- Video tutorial cara download & ekstrak sudah disertakan langsung di folder Google Drive dan di email kamu ya kak.',
    '',
    'Terima kasih banyak sudah berbelanja di MyGameON.'
  )
  return lines.join('\n')
}

