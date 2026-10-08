# ANTIGRAVITY.md

Panduan utama untuk Google Antigravity & AI Coding Assistant saat bekerja di repository **MyGameON Studio Hub**.

---

## 1. Dokumentasi Wajib Dibaca

Sebelum mengembangkan fitur, mengubah kode, atau mendiagnosis masalah, baca dokumen-dokumen berikut secara berurutan:

- **[CODING_CONVENTIONS.md](CODING_CONVENTIONS.md)** — Aturan & pola penulisan kode (penamaan variabel/komponen, arsitektur Next.js App Router, React 19, styling Tailwind CSS v4, konvensi Mongoose, IPC Electron, serta Do & Don't). Kode baru **wajib konsisten** dengan aturan di sini.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Arsitektur menyeluruh sistem: Desktop Electron + Next.js App Router, dual-process model (Main & Renderer), pipeline multi-tahap (download → extract/prep → sanitasi → upload GDrive multi-workspace → listing Shopee), manajemen database MongoDB, dan integrasi pihak ketiga.
- **[.agents/skills/](.agents/skills/)** — Skill operasional khusus:
  - `ui-ux-principles.md`: Prinsip desain antarmuka, hirarki visual, dan feedback status.
  - `logic-data-patterns.md`: Pola transaksi data, lifecycle pipeline status, dan state controller.
  - `coding-discipline.md`: Disiplin verifikasi, refactor, dan penanganan dependensi.

---

## 2. Gambaran Singkat Sistem

**MyGameON Studio Hub** adalah aplikasi desktop internal untuk **satu orang operator** (pemilik toko game digital MyGameON) yang mengelola siklus hidup produk game PC:
1. **Scouting & Ingestion**: Memeriksa ketersediaan game di sumber rilis, mengunduh file game (RAR multipart / direct stream).
2. **Workbench & Pre-Prep**: Ekstraksi arsip, instalasi/uji coba, sanitasi file sampah (adware/link luar), dan injeksi branding panduan resmi MyGameON.
3. **Multi-Workspace Cloud Storage**: Mengunggah folder game ke Google Drive melintasi berbagai akun Google Workspace aktif sesuai kuota storage.
4. **Katalog & Storefront Website**: Sinkronisasi folder Drive fisik ke MongoDB (`GameCatalog`) sebagai sumber kebenaran (ground truth), dan mempublikasikan game siap kirim ke Firestore etalase website (`mygameonapp`).
5. **Shopee Listing Studio**: Mengambil metadata & aset visual resmi dari Steam API / SteamDB, meracik copywriting SEO berbasis formula AIDA menggunakan Gemini AI, meng-generate slide preview, dan mengelola order fulfillment.

Semua modul dirancang untuk berjalan **secara paralel** (misal: operator dapat mengunduh 3 game sambil memproses sanitasi folder dan mengunggah 2 game ke Drive).

---

## 3. Aturan Model Gemini AI (KRITIS — JANGAN DIUBAH)

- **Model yang Digunakan**: Selalu gunakan `gemini-3.6-flash` (atau `process.env.GEMINI_MODEL`).
- **DILARANG KERAS**: Mengubah model ke `gemini-2.5-flash` atau versi lama lainnya. Versi 2.5 flash sudah tidak kompatibel / tidak berfungsi di environment ini dan akan menyebabkan error runtime instan.
- **SDK**: Menggunakan `@google/genai` resmi (bukan legacy `@google/generative-ai`).

---

## 4. Definisi Ground Truth Katalog Game

- **Sumber Ground Truth Utama**: Seluruh file game yang dimiliki secara nyata berada di **Google Drive multi-workspace** (`GameCatalog` di MongoDB disinkronkan langsung dari folder Google Drive fisik).
- **Integritas Stok**: Jika sebuah game belum ada filenya di Google Drive, game tersebut **bukan** barang siap kirim.
- **Aturan Publikasi Website**: Integrasi ke etalase Website (`mygameonapp` Firestore) hanya mempublikasikan game yang **sudah pasti ada filenya di Google Drive**, diperkaya dengan metadata display resmi (RAWG/Steam) agar calon pembeli di website hanya melihat dan memesan game yang benar-benar tersedia.
- **Integritas Ukuran File**: Kolom `totalSize` di database adalah representasi ukuran byte fisik hasil scan Google Drive, **dilarang dioverwrite** oleh perkiraan ukuran dari Steam/SteamDB.

---

## 5. Konfigurasi Environment & Self-Healing Path

Aplikasi desktop membaca variabel konfigurasi dari `.env.local`. Karena didistribusikan dalam format installer Electron, fungsi bootstrap di `main.js` dan resolver di `lib/db.js` / `lib/aiGenerator.js` menerapkan mekanisme **self-healing** dengan memeriksa lokasi-lokasi berikut secara berurutan:
1. `%APPDATA%\MyGameON Studio\.env.local` (persistent user data)
2. `%APPDATA%\mygameon-hub\.env.local`
3. `process.resourcesPath\.env.local` (portable / production packaging)
4. `process.cwd()\.env.local` (development root)

Variabel kritis yang wajib tersedia:
- `MONGODB_URI`: Koneksi ke cluster MongoDB Atlas.
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Kredensial OAuth 2.0 untuk multi-workspace Google Drive.
- `GEMINI_API_KEY`: API key untuk generasi copywriting Shopee (`gemini-3.6-flash`).
- `AUTH_SECRET`: Enkripsi sesi NextAuth.

---

## 6. Prinsip Operasional Pasangan AI (Antigravity)

Saat memodifikasi atau memperluas aplikasi ini, Antigravity wajib memegang teguh:
1. **Evidence over Assumption**: Baca kode sebelum mendiagnosis. Selalu sertakan kutipan `file_path:line_number` untuk setiap klaim perilaku kode.
2. **Reuse before Create**: Utamakan penggunaan komponen dari `@/components/shared/design-system` (`AppCard`, `AppButton`, `AppBadge`) dan helper di `lib/` sebelum membuat komponen atau utility baru.
3. **Contracts Move in Lockstep**: Perubahan skema MongoDB (`models/`) harus selaras dengan API route (`app/api/`) dan tampilan antarmuka (`components/` & `app/(dashboard)/`).
4. **Desktop & Web Dual Compatibility**: Setiap pemanggilan Electron API di frontend wajib menggunakan optional chaining aman (`window.electronAPI?.method`) agar antarmuka tidak crash jika dibuka di browser standar.
5. **Non-Blocking Execution**: Operasi berat (ekstraksi file, upload Google Drive, sanitasi) wajib ditangani melalui `StudioJobController` atau child process terpisah, jangan pernah menahan request HTTP Next.js hingga timeout.
