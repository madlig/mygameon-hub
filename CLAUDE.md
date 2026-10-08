# CLAUDE.md

Panduan untuk Claude Code saat bekerja di repository **MyGameON Studio Hub**.

## Dokumentasi Wajib Dibaca

Sebelum mengembangkan atau mengubah kode, ikuti dokumen berikut:

- **[CODING_CONVENTIONS.md](CODING_CONVENTIONS.md)** — Aturan & pola penulisan kode (penamaan, arsitektur Next.js App Router, React 19, styling Tailwind CSS v4, konvensi Mongoose, IPC Electron, serta Do & Don't). Kode baru harus konsisten dengan aturan di sini.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Arsitektur sistem: Desktop Electron + Next.js App Router, dual-process model (Main & Renderer), pipeline multi-tahap (download → extract/prep → sanitasi → upload GDrive multi-workspace → listing Shopee), manajemen database MongoDB, dan integrasi pihak ketiga.
- **[ANTIGRAVITY.md](ANTIGRAVITY.md)** — Panduan ekosistem AI Coding Assistant & aturan operasional workspace.

## Gambaran Singkat

MyGameON Studio Hub adalah **aplikasi desktop** (Electron + Next.js App Router + React 19) untuk operator tunggal toko game PC digital, mengelola seluruh pipeline: ingestion/download → workbench staging & sanitasi folder → upload Google Drive multi-workspace → sinkronisasi katalog MongoDB & Firestore → pembuatan listing Shopee bertenaga AI Gemini.

## Aturan Kritis (JANGAN DILANGGAR)

1. **Model Gemini AI**: Selalu gunakan `gemini-3.6-flash` (atau `process.env.GEMINI_MODEL`). **DILARANG KERAS** menggunakan `gemini-2.5-flash` karena tidak kompatibel dan memicu error runtime.
2. **Ground Truth Katalog**: Sumber kebenaran fisik file adalah Google Drive multi-workspace (`GameCatalog` di MongoDB disinkronkan dari Drive). Jangan publikasikan game ke etalase website jika belum terverifikasi ada di Drive.
3. **Database Connection**: Selalu gunakan singleton `connectToDatabase()` dari `lib/db.js` (`global.mongoose` cache).
4. **Electron IPC Safety**: Akses Electron API di frontend wajib menggunakan safe optional chaining (`window.electronAPI?.method`).
