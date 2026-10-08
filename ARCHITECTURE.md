# Arsitektur MyGameON Studio Hub

> Dokumen ini menjelaskan arsitektur sistem **MyGameON Studio Hub** — aplikasi desktop terintegrasi berbasis **Electron + Next.js App Router** untuk mengelola seluruh rantai bisnis toko game PC digital: mulai dari akuisisi file, penyiapan & sanitasi arsip, penyimpanan multi-workspace Google Drive, katalogisasi MongoDB, integrasi etalase website (Firestore), hingga pembuatan listing Shopee bertenaga AI.
>
> Dibuat sebagai panduan teknis mendalam bagi pengembang dan AI Coding Assistant sebelum memodifikasi atau memperluas aplikasi ini.

---

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Struktur Repository & Direktori](#2-struktur-repository--direktori)
3. [Framework & Teknologi](#3-framework--teknologi)
4. [Arsitektur Runtime & Dual-Process Model](#4-arsitektur-runtime--dual-process-model)
5. [Pattern Arsitektur](#5-pattern-arsitektur)
6. [Entry Point Aplikasi](#6-entry-point-aplikasi)
7. [Alur Pipeline & Data End-to-End](#7-alur-pipeline--data-end-to-end)
8. [Autentikasi & Multi-Workspace Google Drive](#8-autentikasi--multi-workspace-google-drive)
9. [AI & Integrasi Pihak Ketiga](#9-ai--integrasi-pihak-ketiga)
10. [Dependency Penting](#10-dependency-penting)
11. [Konfigurasi, Environment, & Self-Healing Bootstrap](#11-konfigurasi-environment--self-healing-bootstrap)
12. [Proses Background & Job Controller](#12-proses-background--job-controller)
13. [Panduan & Catatan Kritis untuk Developer](#13-panduan--catatan-kritis-untuk-developer)

---

## 1. Gambaran Umum

**MyGameON Studio Hub** adalah aplikasi desktop internal untuk **satu orang operator** (pemilik toko game PC digital) yang menyatukan alur kerja multi-platform yang sebelumnya terfragmentasi:

- **Tantangan Bisnis**: Mengelola ratusan judul game (berukuran puluhan gigabyte per judul), merotasi akun Google Workspace untuk menghindari batasan kuota storage, menjaga konsistensi metadata resmi Steam, dan membuat ratusan listing produk marketplace dengan deskripsi SEO optimal.
- **Solusi yang Disediakan**:
  1. **Download & Ingestion Manager**: Memantau unduhan multipart/direct stream game dari sumber rilis.
  2. **Workbench Staging**: Mengekstrak arsip, membersihkan file iklan bajakan pihak ketiga, dan menyuntikkan branding serta panduan resmi toko.
  3. **Multi-Workspace Drive Manager**: Mengunggah game ke Google Drive lintas akun dengan pemantauan kuota penyimpanan real-time.
  4. **Ground Truth Catalog**: Menyinkronkan folder Google Drive ke database MongoDB (`GameCatalog`) sebagai basis data utama.
  5. **Website Storefront Sync**: Mempublikasikan game yang sudah siap ke Firestore etalase website publik (`mygameonapp`).
  6. **Shopee Listing Studio**: Mengambil metadata resmi Steam, meracik copywriting AIDA dengan Gemini AI (`gemini-3.6-flash`), dan menyiapkan slide visual siap upload.

Semua modul dirancang untuk berjalan **secara asinkron dan paralel**, sehingga operator dapat mendownload, menyiapkan file, dan mengunggah game secara simultan.

---

## 2. Struktur Repository & Direktori

```
mygameon-hub/
├── main.js                  # Entry point Electron Main Process (Window, IPC, Updater)
├── preload.js               # Script Preload Electron (ContextBridge API)
├── package.json             # Konfigurasi dependensi, scripts, dan metadata aplikasi
├── next.config.mjs          # Konfigurasi Next.js
├── tailwind.config.mjs      # Konfigurasi Tailwind CSS (v4)
├── electron-builder.json    # Konfigurasi packaging desktop Windows (Squirrel / NSIS)
│
├── app/                     # Next.js App Router (UI & API Routes)
│   ├── (auth)/login/        # Halaman autentikasi operator
│   ├── (dashboard)/         # Area dashboard kerja operator
│   │   ├── layout.js        # Global layout (Sidebar, TopBar, Toast notifications)
│   │   ├── page.js          # Ringkasan analitik, kuota drive, dan status pipeline
│   │   ├── workbench/       # Workbench: Staging, ekstraksi, sanitasi, dan prep game
│   │   ├── download/        # Antarmuka monitoring tugas unduhan
│   │   ├── files/           # Google Drive file explorer (pindah, hapus, salin)
│   │   ├── studio/          # Shopee Studio: copywriting AI & generator slide
│   │   ├── scout/           # Game Scout: pemantau rilis game baru
│   │   ├── accounts/        # Manajemen akun Google Workspace OAuth
│   │   ├── drive-status/    # Status kuota dan kesehatan akun Google Drive
│   │   └── sims4/           # Modul khusus lisensi & pesanan DLC The Sims 4
│   └── api/                 # Backend Route Handlers (Server-side Next.js)
│       ├── catalog/         # CRUD katalog, sinkronisasi Drive, & pipeline state
│       ├── drive/           # Upload file ke Drive, auto-copy, kuota storage
│       ├── studio/          # Background worker kontrol, sanitasi folder, & antrean
│       ├── ai/generate/     # Integrasi Gemini 3.6 Flash untuk copywriting listing
│       ├── steam/           # Lookup metadata, spek PC, dan aset visual Steam
│       ├── download/        # Kontrol proses downloader & catch URL
│       ├── accounts/        # Rotasi token OAuth akun Google Workspace
│       └── auth/            # NextAuth autentikasi sesi operator
│
├── models/                  # ODM Mongoose (MongoDB Models)
│   ├── GameCatalog.js       # Model utama katalog game (Ground Truth inventori)
│   ├── WorkspaceAccount.js  # Model akun Google Workspace & token refresh
│   ├── StudioTask.js        # Model tugas background studio (prep/upload)
│   ├── UploadHistory.js     # Riwayat pengunggahan file ke Google Drive
│   ├── Customer.js          # Basis data pembeli dan riwayat pesanan
│   ├── Order.js             # Transaksi penjualan game
│   └── Sims4License.js      # Pengelolaan lisensi updater Sims 4
│
├── lib/                     # Business Logic, Worker, & Service Integrations
│   ├── db.js                # Singleton MongoDB connection dengan cache global
│   ├── catalogSync.js       # Sinkronisasi folder Google Drive fisik ke MongoDB
│   ├── googleClient.js      # OAuth2 client factory untuk multi-workspace
│   ├── aiGenerator.js       # Integrasi SDK Gemini AI (@google/genai)
│   ├── steamEnrichment.js   # Pembersih nama game & parser Steam Store API
│   ├── studioProcessor.js   # Background worker (ekstrak, sanitasi, streaming upload)
│   ├── studioSanitizer.js   # Pembersih adware/link bajakan & branding panduan
│   ├── processControl.js    # Pengendali proses eksternal (suspend, resume, tree-kill)
│   └── firestoreSync.js     # Sinkronisasi game siap kirim ke Firestore website
│
├── components/              # Komponen React (Modular UI)
│   ├── ui/                  # Komponen primitif antarmuka (Button, Badge, Card, Dialog)
│   ├── shared/              # Reusable Design System (AppCard, AppButton, GameItem)
│   ├── layout/              # Komponen struktur shell (Sidebar, TopBar, BottomNav)
│   ├── workbench/           # Komponen antarmuka Workbench (Staging, Inspector, Queue)
│   ├── studio/              # Komponen antarmuka Shopee Studio & Wizard
│   └── files/               # Modal inspeksi, salin, dan hapus file Drive
│
└── scripts/                 # Otomasi build desktop & deployment
    ├── build-publish.js     # Script orkestrasi build Next.js + Electron Builder
    └── resolve-symlinks.js  # Resolusi symbolic link Windows sebelum packaging
```

---

## 3. Framework & Teknologi

| Lapisan Arsitektur | Teknologi yang Digunakan | Peran dalam Sistem |
|---|---|---|
| **Desktop Runtime** | **Electron** (v43+) | Menjalankan aplikasi sebagai desktop Windows native, dialog sistem, single instance lock, dan auto-updater. |
| **Web Framework** | **Next.js** (v16 App Router) | Menyediakan server lokal (port dinamis), route handler backend (`app/api/`), dan client-side rendering. |
| **UI Library** | **React** (v19) + **Tailwind CSS** (v4) | Pembangunan komponen interaktif, reactive state hooks, dan sistem token desain modern. |
| **Database Utama** | **MongoDB** + **Mongoose** (v9) | Menyimpan seluruh katalog game, riwayat tugas, metadata akun, dan riwayat pesanan (Ground Truth). |
| **Cloud Storage** | **Google Drive API v3** (`googleapis`) | Penyimpanan fisik multi-workspace file game terdistribusi melintasi berbagai akun Google. |
| **Generative AI** | **Gemini 3.6 Flash** (`@google/genai`) | Ekstraksi spesifikasi teknis dan pembuatan copywriting judul serta deskripsi Shopee berbasis AIDA. |
| **Metadata Provider** | **Steam Storefront API** & Steam CDN | Pengambilan metadata game resmi, gambar kover (600x900), banner header, dan screenshot. |
| **Storefront Web Publik** | **Firebase Firestore** | Etalase website publik pembeli (`mygameonapp`), disinkronkan satu arah dari katalog internal. |
| **Packaging & Installer** | **Electron Builder** + Squirrel Windows | Pembuatan installer `.exe` native Windows dan manajemen pembaruan otomatis (auto-update). |

---

## 4. Arsitektur Runtime & Dual-Process Model

MyGameON Studio Hub menggabungkan proses native Electron dengan server web internal Next.js:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        APLIKASI DESKTOP ELECTRON                       │
│                                                                        │
│  ┌─────────────────────────┐           ┌────────────────────────────┐  │
│  │   MAIN PROCESS          │           │   RENDERER PROCESS         │  │
│  │   (Node.js Runtime)     │           │   (Chromium Browser Window)│  │
│  │                         │           │                            │  │
│  │   • Single Instance Lock│           │   • React 19 UI Components │  │
│  │   • Bootstrap .env.local│           │   • Tailwind CSS Styling   │  │
│  │   • Dialog Native OS    │           │   • Client-side State      │  │
│  │   • Spawns Next.js Dev/ │           │   • Lucide Icons           │  │
│  │     Production Server   │           │                            │  │
│  └───────────┬─────────────┘           └─────────────▲──────────────┘  │
│              │                                       │                 │
│              │ IPC (Invoke / Handle)                 │ HTTP Fetch      │
│              ▼                                       │ (Localhost)     │
│  ┌─────────────────────────┐           ┌─────────────┴──────────────┐  │
│  │   PRELOAD SCRIPT        │           │   NEXT.JS APP SERVER       │  │
│  │   (Isolated Context)    │           │   (Local Node Server)      │  │
│  │                         │           │                            │  │
│  │   • contextBridge       │           │   • Route Handlers (/api)  │  │
│  │   • window.electronAPI  ├──────────►│   • Mongoose (MongoDB)     │  │
│  │   • Native Dialog Proxy │           │   • Google Drive API v3    │  │
│  │   • Auto-Updater Events │           │   • Gemini AI (3.6 Flash)  │  │
│  └─────────────────────────┘           │   • Background Processor   │  │
│                                        └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Karakteristik Dual-Process:
1. **Isolasi Keamanan**: Renderer process tidak memiliki akses Node.js langsung (`nodeIntegration: false`, `contextIsolation: true`). Semua interaksi OS dilakukan melalui `window.electronAPI` di `preload.js`.
2. **Localhost Server Bridge**: Halaman antarmuka me-load URL server Next.js lokal (`http://localhost:3000` atau port yang dialokasikan saat produksi).
3. **Dual Compatibility**: Kode UI dirancang agar tetap bisa berjalan jika dibuka lewat browser biasa (dengan safe fallback jika `window.electronAPI` tidak terdefinisi).

---

## 5. Pattern Arsitektur

### 1. Multi-Workspace Cloud Storage Pattern
- Karena satu akun Google Drive memiliki batasan kuota (misal: 100 GB atau 2 TB), sistem mendistribusikan game ke beberapa akun Google Workspace (`WorkspaceAccount`).
- Setiap akun memiliki token refresh OAuth sendiri yang dikelola di `lib/googleClient.js` (`getClientForEmail`).
- Saat mengunggah, sistem dapat memilih akun target secara dinamis berdasarkan sisa kapasitas penyimpanan bebas.

### 2. Pipeline State Machine
Status setiap judul game pada model `GameCatalog` dikendalikan oleh mesin state yang ketat:

```
none ──► downloading ──► downloaded ──► extracted ──► uploading ──► on_drive ──► listing_ready ──► listed
```

- `none`: Game baru dicatat / di-scout.
- `downloading`: File game sedang diunduh dari link eksternal.
- `downloaded`: Arsip game selesai diunduh di disk lokal operator.
- `extracted`: Arsip diekstrak, adware dibersihkan, dan branding toko diinjeksikan.
- `uploading`: Folder game sedang diunggah ke Google Drive akun terpilih.
- `on_drive`: Folder game telah terverifikasi berada di Google Drive (Ground Truth aktif).
- `listing_ready`: Copywriting SEO & slide visual Shopee telah digenerate.
- `listed`: Produk telah tayang di marketplace Shopee.

### 3. Background Job Controller & Child Process Supervision
- Operasi dekompresi arsip dan streaming upload Google Drive dijalankan oleh `StudioJobController` di `lib/studioProcessor.js`.
- Status disimpan di file lokal `studio-state.json` dan model `StudioTask`, memungkinkan UI memantau progress secara asinkron tanpa memblokir request HTTP.
- Modul `lib/processControl.js` mengimplementasikan kontrol proses Windows (`taskkill /T /F` dan suspend/resume) agar operator dapat menjeda atau membatalkan operasi tanpa meninggalkan proses zombie.

### 4. Enrichment & Caching Pattern
- Modul `lib/steamEnrichment.js` membersihkan nama folder mentah (contoh: `"Cyberpunk.2077.v2.12-DODI"`) menjadi judul bersih (`"Cyberpunk 2077"`).
- Sistem memanggil Steam Store API untuk memperoleh `steamAppId`, kover vertikal (600x900), banner header, screenshot, dan spesifikasi PC minimum/recommended.
- Data ini disimpan di dokumen `GameCatalog` untuk menghindari pemanggilan berulang ke API luar.

---

## 6. Entry Point Aplikasi

| Bagian | Entry Point | Deskripsi & Tanggung Jawab |
|---|---|---|
| **Electron Main** | `main.js` | Memeriksa lock single-instance, membaca `.env.local` dengan self-healing path, meluncurkan server Next.js, membuka BrowserWindow, dan meregistrasikan IPC handlers. |
| **Electron Preload** | `preload.js` | Menjembatani IPC antara Main Process dan Chromium via `contextBridge.exposeInMainWorld('electronAPI', ...)`. |
| **Dashboard UI** | `app/(dashboard)/layout.js` & `page.js` | Layout utama aplikasi (Sidebar, TopBar, Toast Provider, dan halaman overview). |
| **Workbench** | `app/(dashboard)/workbench/page.jsx` | Modul staging lokal, ekstraksi file, sanitasi, dan inisiasi upload Drive. |
| **Shopee Studio** | `app/(dashboard)/studio/page.js` | Modul peracik listing Shopee (Gemini AI + slide generator). |
| **Build & Deploy** | `scripts/build-publish.js` | Skrip kompilasi Next.js, pembersihan symlink Windows, dan packaging installer Electron. |

---

## 7. Alur Pipeline & Data End-to-End

Berikut adalah alur lengkap perjalanan sebuah judul game dari akuisisi hingga listing:

```
[1. Akuisisi / Download]
   Operator memasukkan tautan unduhan ──► StreamDownloader / Watcher menyimpan part ke folder staging
                                      │
[2. Staging & Ekstraksi]              ▼
   Arsip RAR/ZIP diekstrak ─────────► lib/extractor.js menghasilkan folder game mentah
                                      │
[3. Sanitasi & Branding]              ▼
   lib/studioSanitizer.js ──────────► Hapus file .url, .website, teks iklan bajakan luar
                                      Injeksi file panduan resmi & shortcut MyGameON
                                      │
[4. Upload ke Google Drive]           ▼
   lib/studioProcessor.js ──────────► Unggah folder terstruktur ke akun Workspace target
                                      Pantau progres byte per byte via chunked upload stream
                                      │
[5. Sinkronisasi Katalog]             ▼
   lib/catalogSync.js ──────────────► Scan Google Drive ──► Simpan ke MongoDB (GameCatalog)
                                      Set pipelineStatus = 'on_drive' (Ground Truth aktif)
                                      │
[6. Publikasi Website]                ▼
   lib/firestoreSync.js ────────────► Sinkronkan game berstatus 'on_drive' ke Firestore (mygameonapp)
                                      │
[7. Shopee Listing Studio]            ▼
   lib/steamEnrichment.js ──────────► Tarik cover art 600x900 & spek PC dari Steam API
   lib/aiGenerator.js ──────────────► Gemini 3.6 Flash racik judul SEO & deskripsi format AIDA
   Operator Review ─────────────────► Simpan teks listing & generate slide visual
                                      Set pipelineStatus = 'listed'
```

---

## 8. Autentikasi & Multi-Workspace Google Drive

### Alur OAuth 2.0 Multi-Akun
1. Operator mendaftarkan akun Google Workspace baru di menu `Kelola Akun` (`app/(dashboard)/accounts`).
2. Aplikasi mengarahkan ke alur Google OAuth consent dengan scope:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/spreadsheets`
3. Setelah persetujuan, kode otorisasi ditukar menjadi `refreshToken` jangka panjang dan disimpan di MongoDB (`WorkspaceAccount`).
4. Saat melakukan operasi Drive (scan, upload, copy, delete), `lib/googleClient.js` membuat instance `google.drive({ version: 'v3', auth: oauth2Client })` khusus untuk email tersebut dan menyegarkan access token secara otomatis.

---

## 9. AI & Integrasi Pihak Ketiga

### 1. Gemini AI (`@google/genai`)
- **Model Wajib**: `gemini-3.6-flash` (atau fallback via `process.env.GEMINI_MODEL`).
- **Tujuan**: Menghasilkan copy listing Shopee yang persuasif dan mematuhi batasan karakter marketplace.
- **Formula Copywriting**: Menggunakan metode **AIDA** (Attention, Interest, Desire, Action) dipadukan dengan format spesifikasi PC terstruktur dan tagar SEO relevan.
- **Format Output**: Memanfaatkan fitur `responseMimeType: 'application/json'` untuk memastikan output selalu berformat JSON valid tanpa perlu regex parsing yang rapuh.

### 2. Steam Store API & CDN
- **API Endpoint**: `https://store.steampowered.com/api/appdetails?appids=<id>&l=indonesian`.
- **CDN Visual**: Mengunduh aset beresolusi tinggi langsung dari Steam CDN:
  - Vertical Library Capsule: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/<id>/library_600x900.jpg`
  - Header Banner: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/<id>/header.jpg`

### 3. Firestore Website Storefront
- Digunakan untuk sinkronisasi katalog ke website pembeli `mygameonapp`.
- Menjaga prinsip bahwa pembeli di website hanya bisa melihat game yang filenya **sudah terverifikasi ada di Google Drive**.

---

## 10. Dependency Penting

### Runtime Dependencies (`dependencies`)

| Package | Versi | Peran Teknis |
|---|---|---|
| `@google/genai` | `^2.18.0` | SDK resmi Gemini AI untuk generasi copywriting SEO Shopee. |
| `mongoose` | `^9.9.3` | ODM untuk interaksi dengan database MongoDB Atlas (Ground Truth). |
| `googleapis` | `^171.4.0` | Klien resmi Google untuk operasi Drive API v3, Gmail API, dan Sheets API. |
| `electron-updater` | `^6.8.9` | Manajemen auto-update aplikasi desktop Windows. |
| `electron-squirrel-startup` | `^1.0.1` | Penanganan startup event Squirrel Windows installer. |

### Development & UI Dependencies (`devDependencies`)

| Package | Versi | Peran Teknis |
|---|---|---|
| `next` | `16.2.6` | Framework React App Router & server backend lokal. |
| `react` / `react-dom` | `19.2.4` | Library rendering antarmuka reaktif modern. |
| `tailwindcss` | `^4` | Utility-first CSS framework (versi 4 modern). |
| `electron` | `^43.4.0` | Desktop wrapper Chromium & Node.js. |
| `electron-builder` | `^26.15.3` | Packaging executable desktop Windows. |
| `lucide-react` | `^1.14.0` | Koleksi ikon antarmuka standar. |
| `next-auth` | `^5.0.0-beta.31` | Autentikasi sesi dashboard operator. |
| `concurrently` | `^10.0.5` | Menjalankan server Next.js dan Electron secara bersamaan di mode dev. |

---

## 11. Konfigurasi, Environment, & Self-Healing Bootstrap

Konfigurasi aplikasi disimpan dalam file `.env.local`. Mengingat aplikasi ini didistribusikan dalam bentuk installer desktop Windows, path direktori kerja dapat bervariasi antara mode development dan produksi.

### Jalur Resolusi Self-Healing (`main.js` & `lib/db.js`):
Aplikasi mencari `.env.local` dengan urutan prioritas:
1. `%APPDATA%\MyGameON Studio\.env.local` (persistent data direktori OS)
2. `%APPDATA%\mygameon-hub\.env.local`
3. `process.resourcesPath\.env.local` (direktori resource bawaan Electron)
4. Direktori tepat di sebelah executable `.exe`
5. `process.cwd()\.env.local` (root folder proyek)

### Sanitasi UTF-8 BOM:
Fungsi `parseEnvFile` di `main.js` secara otomatis membuang karakter UTF-8 Byte Order Mark (`\uFEFF`) yang kerap ditambahkan oleh editor teks Windows (Notepad) untuk mencegah variabel environment corrupt.

---

## 12. Proses Background & Job Controller

Operasi berat pada desktop dikelola secara terstruktur agar tidak menyebabkan freezing pada antarmuka maupun timeout pada request Next.js:

1. **Manajemen Arsip (Ekstraksi)**:
   - Mendukung format RAR multi-part dan 7-Zip.
   - Menggunakan streaming unbuffered dan logging berkala.
2. **Pembersihan Adware & Sanitasi**:
   - Memindai seluruh tree direktori secara rekursif.
   - Menghapus tautan web (`.url`), shortcut iklan, serta file teks berbahasa asing yang mempromosikan situs cracker.
   - Menyuntikkan template panduan resmi MyGameON.
3. **Pengunggahan Google Drive**:
   - Memakai teknik resumable media upload untuk file besar guna memitigasi kegagalan koneksi internet di tengah jalan.
   - Menghitung checksum dan verifikasi ukuran file pasca upload.
4. **Penghentian Proses yang Aman (Safe Process Termination)**:
   - `killProcessTree(pid)` di `lib/processControl.js` memastikan bahwa jika proses ekstraksi/upload dibatalkan oleh operator, seluruh sub-proses yang dipicu di Windows akan dimatikan secara tuntas tanpa menyisakan thread yang mengunci file disk.

---

## 13. Panduan & Catatan Kritis untuk Developer

1. **Aturan Model Gemini AI**:
   - Selalu gunakan `gemini-3.6-flash`.
   - **Dilarang keras menurunkan ke `gemini-2.5-flash`** — model versi 2.5 sudah tidak berfungsi di environment ini dan akan langsung memicu runtime exception.
2. **Prinsip Ground Truth Katalog**:
   - Sumber kebenaran fisik stok adalah Google Drive.
   - Jangan pernah menandai game sebagai siap kirim (`pipelineStatus: 'on_drive'`) jika belum lolos verifikasi scan Drive riil.
   - Jangan pernah menimpa kolom `totalSize` dengan estimasi ukuran dari Steam API.
3. **Pola Pemanggilan IPC di Frontend**:
   - Selalu gunakan optional chaining `window.electronAPI?.<fungsi>` agar antarmuka tetap berjalan mulus saat dites lewat web browser.
4. **Koneksi Database Singleton**:
   - Selalu panggil `await connectToDatabase()` dari `@/lib/db` sebelum mengakses model Mongoose. Jangan menginstansiasi koneksi Mongoose baru secara manual.
5. **Checklist Rilis Aplikasi Desktop**:
   - Jalankan `npm run lint` untuk memastikan tidak ada syntax/import error.
   - Lakukan deployment menggunakan skrip otomatis (`npm run deploy:patch` / `deploy:minor`) agar penomoran versi, tagging Git, dan build installer Windows tersinkronisasi sempurna.
