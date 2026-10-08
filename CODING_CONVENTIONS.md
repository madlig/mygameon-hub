# Konvensi Coding — MyGameON Studio Hub

> Dokumen ini merangkum **aturan & pola penulisan kode** yang berlaku di project **MyGameON Studio Hub** (Desktop Electron + Next.js App Router + React 19 + Tailwind CSS v4 + MongoDB Mongoose).
> Tujuannya adalah memastikan setiap kode baru **konsisten**, **aman**, dan **mudah dirawat**.

---

## Daftar Isi

1. [Bahasa & Penamaan](#1-bahasa--penamaan)
2. [Struktur File & Modul](#2-struktur-file--modul)
3. [Konvensi Backend (Next.js Route Handlers)](#3-konvensi-backend-nextjs-route-handlers)
4. [Konvensi Frontend (React 19 & Tailwind CSS)](#4-konvensi-frontend-react-19--tailwind-css)
5. [Format Response API & Error Handling](#5-format-response-api--error-handling)
6. [Konvensi Database (MongoDB & Mongoose)](#6-konvensi-database-mongodb--mongoose)
7. [Konvensi Electron IPC & Native Shell](#7-konvensi-electron-ipc--native-shell)
8. [Pipeline & Background Processing](#8-pipeline--background-processing)
9. [Dokumentasi Kode & Logging](#9-dokumentasi-kode--logging)
10. [Git: Branch & Deploy](#10-git-branch--deploy)
11. [Do & Don't](#11-do--dont)

---

## 1. Bahasa & Penamaan

- **Domain Bisnis & UI memakai Bahasa Indonesia.** Teks antarmuka, notifikasi toast, dialog konfirmasi, status log, dan pesan error ke operator ditulis dalam Bahasa Indonesia (contoh: `"Folder game berhasil disanitasi"`, `"Game siap kirim"`, `"Katalog berhasil disinkronkan"`).
- **Identifier Teknis memakai Bahasa Inggris.** Nama variabel, nama fungsi, atribut database, properti JSON, dan API request parameter ditulis dalam Bahasa Inggris dengan gaya casing baku.

### Konvensi Casing

| Elemen | Gaya | Contoh di Codebase |
|---|---|---|
| **React Components & Pages** | `PascalCase` | `WorkbenchView`, `FolderInspector`, `AppCard`, `TopBar` |
| **Custom Hooks** | `camelCase` (prefix `use`) | `useWorkbenchState`, `useCatalogSearch`, `useToast` |
| **Fungsi & Utility** | `camelCase` | `syncWorkspaceCatalog()`, `cleanRawFolderName()`, `generateShopeeListing()` |
| **Mongoose Models** | `PascalCase` | `GameCatalog`, `WorkspaceAccount`, `StudioTask`, `UploadHistory` |
| **Field/Properti Database** | `camelCase` | `folderId`, `ownerEmail`, `pipelineStatus`, `shopeeListed`, `totalSize` |
| **Konstanta & Enum Kunci** | `UPPER_SNAKE_CASE` | `FOLDER_MIME`, `DEFAULT_TIMEOUT_MS`, `JUNK_EXTENSIONS` |
| **Route Handler Folders** | `kebab-case` | `app/api/catalog/enrich-sync/`, `app/api/studio/check-drive-folder/` |
| **File Konfigurasi / State JSON** | `kebab-case` | `studio-state.json`, `studio-config.json`, `download-tasks.json` |
| **CSS Tokens & Variables** | `kebab-case` | `var(--surface)`, `var(--primary)`, `var(--border-soft)`, `card-hover` |

---

## 2. Struktur File & Modul

Aplikasi memisahkan tugas runtime desktop, server-side Next.js, model data, dan antarmuka React secara modular:

```
mygameon-hub/
├── main.js                  # Electron Main Process (lifecycle, window, IPC handler)
├── preload.js               # Electron Preload script (contextBridge expose)
├── app/                     # Next.js App Router
│   ├── (auth)/              # Halaman autentikasi (login)
│   ├── (dashboard)/         # Halaman antarmuka operator
│   │   ├── layout.js        # Global dashboard shell (Sidebar, TopBar, Toast provider)
│   │   ├── page.js          # Ringkasan dashboard utama
│   │   ├── download/        # Antarmuka monitoring unduhan
│   │   ├── workbench/       # Staging area, ekstraksi, sanitasi & prep
│   │   ├── files/           # Penjelajah file Google Drive multi-workspace
│   │   ├── studio/          # Shopee listing studio (SEO & slide preview)
│   │   ├── scout/           # Game scout & crawler rilis game baru
│   │   └── accounts/        # Manajemen akun Google Workspace OAuth
│   └── api/                 # Next.js Server Route Handlers
│       ├── catalog/         # API sinkronisasi & manajemen GameCatalog
│       ├── drive/           # API operasi Google Drive (upload, quota, auto-copy)
│       ├── studio/          # API background job controller & sanitasi
│       ├── ai/              # API generasi SEO via Gemini AI
│       └── auth/            # NextAuth handler & OAuth callbacks
├── models/                  # Mongoose Schema & Models (GameCatalog, WorkspaceAccount, dll.)
├── lib/                     # Core Business Logic & Shared Utilities
│   ├── db.js                # Singleton Mongoose connection & URI resolver
│   ├── catalogSync.js       # Engine sinkronisasi Google Drive ↔ MongoDB
│   ├── googleClient.js      # OAuth2 token manager per email akun
│   ├── aiGenerator.js       # Gemini 3.6 Flash client & AIDA copywriter
│   ├── steamEnrichment.js   # Steam Store API parser & title cleaner
│   ├── studioProcessor.js   # Background worker untuk sanitasi, arsip, & upload
│   ├── studioSanitizer.js   # Scanner & pembersih iklan/adware folder game
│   └── processControl.js    # Pengendali child process (suspend, resume, tree-kill)
├── components/              # Komponen React
│   ├── ui/                  # Primitif dasar (Button, Input, Badge, Dialog)
│   ├── shared/              # Reusable Design System (AppCard, AppButton, GameItem)
│   ├── layout/              # Navigasi shell (Sidebar, TopBar, BottomNav)
│   └── workbench/           # Komponen spesifik modul Workbench
└── scripts/                 # Build & deployment scripts (build-publish, symlink)
```

- **Aturan Lokasi Kode**:
  - Logika bisnis yang berinteraksi dengan API eksternal atau database diletakkan di `lib/`, bukan langsung di dalam file komponen UI.
  - Komponen antarmuka yang dipakai lebih dari 1 modul diletakkan di `components/shared/`.
  - Komponen primitif umum diletakkan di `components/ui/`.

---

## 3. Konvensi Backend (Next.js Route Handlers)

### Pola Standar Route Handler

Setiap endpoint API di `app/api/.../route.js` wajib mengikuti pola Web Standard:

```javascript
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req) {
  try {
    // 1. Verifikasi Autentikasi / Sesi
    const session = await auth();
    const isDev = process.env.NODE_ENV !== 'production';
    const isLocalhost = req.headers.get('host')?.includes('localhost') || req.headers.get('host')?.includes('127.0.0.1');

    if (!session?.user?.email && !isDev && !isLocalhost) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Hubungkan ke Database (Singleton Safe)
    await connectToDatabase();

    // 3. Baca dan Validasi Payload
    const body = await req.json();
    const { folderId, email } = body;

    if (!folderId || !email) {
      return NextResponse.json(
        { success: false, error: 'Parameter folderId dan email wajib diisi' },
        { status: 400 }
      );
    }

    // 4. Eksekusi Logika Bisnis
    const result = await processSpecificTask(folderId, email);

    // 5. Kembalikan Response Sukses Ber-envelope
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Operasi berhasil dieksekusi'
    });
  } catch (error) {
    console.error('[API Error /api/example]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}
```

### Aturan Eksekusi Backend

1. **Selalu panggil `await connectToDatabase()`**: Jangan berasumsi koneksi MongoDB sudah terbuka. Panggil selalu di awal handler sebelum query model.
2. **Jangan biarkan proses lama memblokir HTTP Response**: Untuk proses yang memakan waktu > 10 detik (misal: ekstraksi RAR 50 GB, sanitasi ratusan subfolder, atau upload Drive bergiga-byte), jangan tahan koneksi HTTP. Buat background task via `StudioJobController` atau `StudioTask`, kembalikan ID proses (`jobId`), dan biarkan frontend melakukan polling status via `/api/studio/status`.
3. **Validasi Input Ketat**: Cek keberadaan parameter wajib sebelum masuk ke business logic untuk mencegah runtime exception yang tidak perlu.

---

## 4. Konvensi Frontend (React 19 & Tailwind CSS)

### Pola Client Component vs Server Component

- Secara default, halaman yang membutuhkan hooks (`useState`, `useEffect`, `useCallback`), interaksi formulir, atau event listener **wajib diawali dengan directive `'use client'`**.
- Halaman pembungkus layout yang hanya menyusun tata letak statis dapat tetap menjadi Server Component.

### Menggunakan Design System Bersama (`@/components/shared/design-system`)

Jangan membuat style tombol atau kartu baru secara acak. Selalu gunakan komponen dari `components/shared/design-system.jsx`:

```jsx
'use client';

import { AppCard, AppButton, AppBadge } from '@/components/shared/design-system';
import { Play, CheckCircle2, AlertTriangle } from 'lucide-react';

export function ExampleCard({ game, onAction }) {
  return (
    <AppCard hover className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-[var(--text)] truncate">{game.name}</h3>
        <AppBadge tone={game.pipelineStatus === 'on_drive' ? 'success' : 'warning'}>
          {game.pipelineStatus}
        </AppBadge>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <AppButton kind="primary" size="sm" onClick={() => onAction(game)}>
          <Play className="w-3.5 h-3.5 mr-1" />
          Proses Sekarang
        </AppButton>
        <AppButton kind="ghost" size="sm" onClick={() => {}}>
          Detail
        </AppButton>
      </div>
    </AppCard>
  );
}
```

### Prinsip Visual & UI/UX

1. **Hirarki Jelas**: Tepat satu aksi dominan (`kind="primary"`) per kartu atau baris tindakan. Tombol sekunder harus menggunakan `kind="ghost"` atau `kind="soft"`.
2. **Status Visual Konsisten**:
   - Hijau (`tone="success"`): Selesai, aktif, siap kirim, online.
   - Kuning/Amber (`tone="warning"`): Sedang diproses, antrean, kuota menipis.
   - Merah (`tone="danger"`): Gagal, error, dibatalkan.
   - Netral/Abu-abu (`tone="neutral"`): Belum diproses, idle.
3. **Icons**: Selalu gunakan `lucide-react` dengan ukuran proporsional (`w-4 h-4` untuk teks kecil, `w-5 h-5` untuk header).

---

## 5. Format Response API & Error Handling

Semua endpoint API internal harus mengembalikan payload JSON berstruktur amplop (**envelope**) standar agar antarmuka dapat memproses status secara seragam:

### Sukses:
```json
{
  "success": true,
  "data": {
    "totalProcessed": 12,
    "added": 3
  },
  "message": "Sinkronisasi katalog berhasil"
}
```

### Gagal / Error:
```json
{
  "success": false,
  "error": "Token akun workspace kedaluwarsa. Silakan login ulang."
}
```

### Standar Status Code HTTP

| Status Code | Kondisi |
|---|---|
| `200 OK` | Operasi berhasil dijalankan. |
| `400 Bad Request` | Parameter input tidak lengkap, format payload salah, atau ID tidak valid. |
| `401 Unauthorized` | Pengguna tidak memiliki sesi aktif dan bukan request dev/local. |
| `404 Not Found` | Folder Google Drive, akun workspace, atau entri game tidak ditemukan. |
| `409 Conflict` | Terjadi konflik state (misal: proses job lain sedang berjalan di background). |
| `500 Server Error` | Terjadi unhandled exception atau kegagalan API pihak ketiga. |

---

## 6. Konvensi Database (MongoDB & Mongoose)

### Pola Koneksi Singleton (`lib/db.js`)

Mongoose connection di-cache di level `global.mongoose` untuk mencegah pembentukan ratusan koneksi baru saat Next.js melakukan hot-reload di mode development atau saat API route dipanggil bersamaan:

```javascript
// ✅ Benar: Panggil helper singleton
import connectToDatabase from '@/lib/db';
await connectToDatabase();
```

### Aturan Skema & Model

1. **Explicit Timestamps**: Semua skema wajib menggunakan `{ timestamps: true }` untuk memelihara `createdAt` dan `updatedAt`.
2. **Index yang Tepat**:
   - Field yang sering dijadikan filter (`ownerEmail`, `pipelineStatus`, `steamAppId`) wajib diberi `index: true`.
   - Field identitas unik wajib diberi `unique: true` (contoh: `folderId` pada `GameCatalog`, `email` pada `WorkspaceAccount`).
   - Pencarian teks memakai compound text index:
     ```javascript
     GameCatalogSchema.index({ name: 'text', cleanTitle: 'text' });
     ```
3. **Lifecycle `pipelineStatus`**:
   Enum status pada `GameCatalog` mengikuti tahapan tegas:
   ```
   none → downloading → downloaded → extracted → uploading → on_drive → listing_ready → listed
   ```
   **Dilarang** memindahkan status ke `on_drive` jika folder game belum terverifikasi secara fisik di Google Drive melalui scan.

---

## 7. Konvensi Electron IPC & Native Shell

Aplikasi berjalan di atas Electron dengan arsitektur isolasi konteks (`contextIsolation: true`, `nodeIntegration: false`).

### Pola Preload Bridge (`preload.js`)

Semua fungsi native Electron yang dibutuhkan antarmuka dipaparkan melalui `contextBridge`:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: (defaultPath) => ipcRenderer.invoke('dialog:select-directory', defaultPath),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openGameBrowser: (url, title) => ipcRenderer.invoke('open-game-browser', { url, title }),
});
```

### Pola Pemanggilan di Sisi React (Safe Fallback)

Komponen React dapat diakses via desktop Electron maupun browser developer. Oleh karena itu, pemanggilan API Electron **wajib menggunakan optional chaining**:

```javascript
// ✅ Benar: Aman dari crash di lingkungan browser web
const handleSelectFolder = async () => {
  if (typeof window !== 'undefined' && window.electronAPI?.selectDirectory) {
    const selectedPath = await window.electronAPI.selectDirectory();
    if (selectedPath) setLocalPath(selectedPath);
  } else {
    alert('Fitur pemilihan folder lokal hanya tersedia di aplikasi desktop.');
  }
};
```

---

## 8. Pipeline & Background Processing

Operasi berat seperti dekompresi arsip, penataan struktur direktori, dan sanitasi malware/iklan dikelola oleh modul khusus di `lib/studioProcessor.js` dan `lib/studioSanitizer.js`.

### Aturan Sanitasi Folder Game (`lib/studioSanitizer.js`)

Sebelum sebuah game diunggah ke Google Drive:
1. **Hapus File Sampah**: File dengan ekstensi `.url`, `.website`, `.nfo`, serta file sistem (`thumbs.db`, `desktop.ini`, `.DS_Store`) wajib dibersihkan.
2. **Hapus File Iklan Pihak Ketiga**: Teks panduan yang memuat tautan situs repack/bajakan luar (`ovagames`, `steamrip`, `dodi-repack`, `fitgirl`, dll.) wajib disingkirkan.
3. **Injeksi Branding MyGameON**:
   - Sertakan panduan resmi berupa shortcut / file teks resmi MyGameON.
   - Buat struktur direktori bersih yang siap dimainkan operator / pembeli (`PRE-INSTALLED` plug & play).

### Pengendalian Child Process (`lib/processControl.js`)

Jika operator menekan tombol **Pause** atau **Cancel**:
- Jangan membunuh proses secara tiba-tiba tanpa membersihkan lock file.
- Gunakan `suspendProcess()` / `resumeProcess()` untuk menjeda pekerjaan sementara.
- Gunakan `killProcessTree()` untuk menghentikan proses induk beserta seluruh anak prosesnya di Windows secara bersih (`taskkill /pid ... /T /F`).

---

## 9. Dokumentasi Kode & Logging

### JSDoc pada Helper & Service

Setiap fungsi inti di direktori `lib/` wajib memiliki deskripsi JSDoc singkat mengenai input dan output:

```javascript
/**
 * Scan Google Drive dari 1 workspace, lalu sync katalog game ke MongoDB.
 * @param {string} email - Email workspace yang akan di-sync
 * @returns {Promise<{ added: number, updated: number, removed: number, error?: string }>}
 */
export async function syncWorkspaceCatalog(email) { ... }
```

### Standar Prefix Logging

Gunakan prefix modul saat mencetak pesan ke konsol untuk memudahkan diagnosa via terminal maupun file log:

- `[MongoDB]` — Status koneksi dan transaksi database.
- `[DriveSync]` — Sinkronisasi inventori Google Drive multi-workspace.
- `[Studio]` — Status background worker (ekstrak, sanitasi, upload).
- `[GeminiAI]` — Generasi copywriting listing Shopee.
- `[SteamAPI]` — Pengambilan metadata & cover art game.
- `[Electron]` — Peristiwa native window, updater, dan lifecycle.

---

## 10. Git: Branch & Deploy

### Pola Branch

- `master`: Branch utama produksi yang menjadi basis rilis aplikasi desktop.
- `feat/<fitur>`: Pengembangan fitur baru (contoh: `feat/batch-upload-drive`).
- `fix/<masalah>`: Perbaikan bug (contoh: `fix/rar-extractor-hang`).

### Pola Commit Message

Gunakan format **Conventional Commits**:

```
feat: tambah opsi retry otomatis pada upload Google Drive
fix: cegah error saat folder game tidak memiliki cover art di Steam
refactor: pisahkan logika sanitasi folder ke modul studioSanitizer
chore: update dependensi electron-builder ke versi 26.15
```

### Skrip Deployment Otomatis

Proses rilis aplikasi desktop menggunakan skrip bawaan di `package.json`:
- `npm run deploy:patch` — Commit perubahan, menaikkan versi patch (`1.1.x`), tag Git, push, dan trigger build Electron installer.
- `npm run deploy:minor` — Rilis fitur baru tingkat minor (`1.x.0`).
- `npm run deploy:major` — Rilis perubahan arsitektural besar (`x.0.0`).

---

## 11. Do & Don't

### ✅ Do
- **Gunakan model AI `gemini-3.6-flash`**: Selalu rujuk ke model ini atau `process.env.GEMINI_MODEL`.
- **Pertahankan Mongoose Singleton**: Selalu panggil `connectToDatabase()` dari `@/lib/db`.
- **Gunakan Komponen Design System**: Selalu pakai `AppCard`, `AppButton`, dan `AppBadge` dari `@/components/shared/design-system`.
- **Optional Chaining pada Electron API**: Selalu bungkus akses `window.electronAPI` dengan pemeriksaan keberadaan objek.
- **Normalisasi Nama Game**: Selalu jalankan `cleanRawFolderName()` sebelum mencari metadata di Steam API.

### ❌ Don't
- **DILARANG KERAS mengubah model Gemini ke `gemini-2.5-flash`**: Versi tersebut sudah tidak didukung dan merusak runtime aplikasi.
- **Dilarang mempublikasikan game ke Firestore jika belum ada di Drive**: Ground truth stok adalah ketersediaan fisik file di Drive.
- **Dilarang meng-overwrite `totalSize` dengan data Steam**: Ukuran riil byte berasal dari Google Drive, data Steam hanya untuk teks spesifikasi PC.
- **Dilarang hardcode path absolut lokal**: Jangan tulis `C:\Users\madli\...` di dalam kode bersama; gunakan parameter dinamis atau dialog picker.
- **Dilarang memblokir thread Next.js utama**: Operasi ekstraksi atau upload besar wajib didelegasikan ke background worker.
- **Dilarang bypass validasi skema**: Jangan gunakan query mentah tanpa memperhatikan struktur enum dan index yang sudah ditetapkan.
