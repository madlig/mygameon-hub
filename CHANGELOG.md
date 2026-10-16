# Catatan Rilis & Riwayat Pembaruan (Changelog)

Semua perubahan dan peningkatan signifikan pada **MyGameON Studio Hub** didokumentasikan di sini.

---

## [v1.2.5] - 2026-10-16
### Listing Studio Non-Steam Support & Multi-CDN Image Engine

#### ✨ Fitur Baru
- **Dukungan Game Non-Steam & Emulator (RAWG Database)**: Listing Studio kini otomatis mendeteksi game porting konsol / emulator (seperti *God of War 3 Remastered*, *Bloodborne*, dll) dan langsung mengambil 4 screenshot gameplay Full HD resmi.
- **Mode Buat Listing Manual**: Tombol instan pada kotak pencarian untuk membuat 6 slide produk secara manual jika game custom tidak ada di database online mana pun.
- **Upload File & Paste Clipboard (Ctrl+V)**: Cover dan screenshot kini bisa diunggah dari file harddisk (`.png`, `.jpg`, `.webp`) atau ditempel langsung via `Ctrl+V` (Salin Gambar).
- **In-App Release Notes Dialog**: Pengguna dapat melihat riwayat pembaruan dan rincian perbaikan kapan saja dengan mengklik versi aplikasi di sidebar.

#### ⚡ Peningkatan & Perbaikan
- **Multi-CDN Fallback Server**: Menguji ketersediaan poster 600x900 secara paralel di server Akamai, Cloudflare, Fastly, dan Legacy Steamcdn. Jika game baru belum memiliki poster vertikal, sistem secara jujur menampilkan status *"Cover Tidak Ditemukan"* tanpa memaksakan screenshot.
- **Integrasi Browser Native Sistem**: Tombol *"Cari di Google Images"* kini otomatis membuka browser bawaan Windows (Chrome / Edge) agar menu klik kanan *"Salin alamat gambar"* dan *"Salin gambar"* berfungsi penuh.
- **Native Context Menu di Electron**: Menu klik kanan (Cut, Copy, Paste) kini aktif di seluruh form input aplikasi.

---

## [v1.2.4] - 2026-10-15
### Download Hub Chrome Catcher & Pipeline Watcher

#### ✨ Fitur Baru
- Ekstensi browser Chrome / Edge untuk menangkap link download game otomatis (CNL & Direct Link).

#### ⚡ Peningkatan & Perbaikan
- Peningkatan auto-extractor multi-part RAR dengan deteksi multi-password.
- Perbaikan sinkronisasi status Google Drive staging folder di Workbench.

---

## [v1.2.3] - 2026-10-14
### Workbench Archive Status Sync & CRM Improvements

#### ⚡ Peningkatan & Perbaikan
- Sinkronisasi status arsip game otomatis di Workbench.
- Perbaikan validasi lisensi Sims 4 dan integrasi pengiriman email pelanggan.

---

## [v1.2.0] - 2026-10-12
### Major Release: Workbench, Download Hub & Mobile Access

#### 🚀 Fitur Besar
- Peluncuran modul Workbench, Download Hub, Cloudflare Tunnel remote control, dan File Manager multi-workspace.
