<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MyGameON Studio Hub — Workspace Context & Memory

## 1. Aturan Model Gemini AI (KRITIS - JANGAN DIUBAH)
- **Model yang Digunakan**: Selalu gunakan `gemini-3.6-flash` (atau `process.env.GEMINI_MODEL`).
- **DILARANG KERAS**: Mengubah model ke `gemini-2.5-flash` atau versi lama lainnya. Versi 2.5 flash sudah tidak kompatibel / tidak berfungsi di environment ini dan akan menyebabkan error runtime.

## 2. Definisi Ground Truth Katalog Game
- **Sumber Ground Truth Utama**: Seluruh file game yang dimiliki secara nyata berada di **Google Drive multi-workspace** (`GameCatalog` di MongoDB yang disinkronkan dari folder Google Drive).
- Jika sebuah game belum ada filenya di Google Drive, game tersebut **bukan** barang siap kirim.
- Integrasi ke etalase Website (`mygameonapp` Firestore) hanya mempublikasikan game yang **sudah pasti ada filenya di Google Drive**, diperkaya dengan metadata display (RAWG/Steam) agar calon pembeli di website bisa melihat detail spesifikasi dan memesan game yang memang tersedia.

