// Penyimpanan lokal (localStorage) untuk halaman Cari game:
// keranjang, riwayat email, game terakhir dikirim, favorit, dan bundle.
// Semua client-side — tidak menyentuh backend.

export const SK = {
  cart: 'mygameon_cart',
  emails: 'mygameon_recent_emails',
  games: 'mygameon_recent_games',
  favs: 'mygameon_fav_games',
  bundles: 'mygameon_bundles',
}

export function loadJSON(key, fallback = []) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch (e) {
    return fallback
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {}
}

export function uid() {
  return Math.random().toString(36).slice(2, 9)
}

// Bentuk minimal game untuk disimpan (favorit / recent / bundle item)
export function slimGame(item) {
  return { id: item.id, name: item.name, ownerEmail: item.ownerEmail || '', availableIn: item.availableIn || 1 }
}
