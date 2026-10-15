# ⚡ MyGameON Download Catcher (Browser Extension)

Ekstensi eksklusif untuk menangkap unduhan berkas game dari browser (seperti SteamRIP, BZZHR, 1Fichier, GoFile) dan langsung meneruskannya ke **MyGameON Hub** / **JDownloader 2** di PC Anda dengan Cookie & Referrer lengkap (anti-error 403 / anti-expired link), serta dipantau secara realtime di **MyGameON Hub** (`/download`).

---

## 🌐 Pilihan 1: Panduan Pasang di Chrome / Edge / Brave (Permanen)

1. Buka browser **Google Chrome**, **Microsoft Edge**, atau **Brave**.
2. Buka halaman ekstensi:
   - Di Chrome: ketik `chrome://extensions` di address bar lalu Enter.
   - Di Edge: ketik `edge://extensions` di address bar lalu Enter.
   - Di Brave: ketik `brave://extensions` di address bar lalu Enter.
3. Di pojok kanan atas, aktifkan toggle **"Developer mode"** (Mode pengembang).
4. Klik tombol **"Load unpacked"** (Muat yang belum dibongkar) di pojok kiri atas.
5. Pilih folder:
   ```text
   c:\mad\proyek\mygameon-hub\extension-chrome
   ```
6. **Selesai!** Ekstensi akan terpasang permanen (tidak akan hilang saat browser ditutup).

---

## 🦊 Pilihan 2: Panduan Pasang di Firefox

1. Buka browser **Firefox**.
2. Pada address bar Firefox, ketik:
   ```text
   about:debugging#/runtime/this-firefox
   ```
   lalu tekan **Enter**.
3. Di halaman tersebut, klik tombol **"Load Temporary Add-on..."** (Muat Pengaya Sementara...).
4. Arahkan dan pilih file:
   ```text
   c:\mad\proyek\mygameon-hub\extension\manifest.json
   ```
5. **Selesai!** Ekstensi `MyGameON Download Catcher` akan langsung aktif di Firefox.

---

## 🛡️ Keamanan & Eksklusivitas

- **Khusus Localhost**: Ekstensi hanya menembak server `127.0.0.1:3000` di komputer Anda.
- **Kunci Rahasia (Secret Key)**: Terkunci dengan token `mgo_catcher_sec_99a8b7c6d5e4f3a2b1`. Siapa pun yang mencoba menembak API tanpa kunci ini akan ditolak (401 Unauthorized).
- **Target Folder**: Seluruh file game otomatis masuk ke:
  ```text
  D:\Game\Shopee\GameDownload
  ```
- **Realtime Dashboard**: Pantau progres unduhan, kecepatan (MB/s), dan estimasi waktu selesai di:
  [http://localhost:3000/download](http://localhost:3000/download)
