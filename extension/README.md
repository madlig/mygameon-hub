# ⚡ MyGameON Download Catcher (Firefox Extension)

Ekstensi eksklusif untuk menangkap unduhan berkas game dari Firefox (seperti SteamRIP, BZZHR, 1Fichier, GoFile) dan langsung meneruskannya ke **JDownloader 2** di PC Anda dengan Cookie & Referrer lengkap (anti-error 403), serta dipantau secara realtime di **MyGameON Hub** (`/download`).

---

## 🚀 Panduan Pasang di Firefox (Hanya 1 Menit)

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
5. **Selesai!** Ekstensi `MyGameON Download Catcher` akan langsung muncul dengan ikon petir di toolbar Firefox Anda.

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
