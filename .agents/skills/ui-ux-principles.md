# Skill: UI/UX Principles — Berpikir Kreatif & Tepat Sasaran

## Ikhtisar

Skill ini mengatur **cara berpikir tentang UI/UX** sebelum dan selama menulis kode frontend. Tujuannya: menghasilkan antarmuka yang terasa natural, tidak friksi, dan langsung mendukung tujuan utama user — bukan UI yang "benar secara teknis" tapi membingungkan.

---

## Langkah 0: Definisikan User Intent SEBELUM Menulis JSX

Untuk **setiap komponen atau halaman**, jawab ini dulu:

```
Siapa user-nya?         → [nama/peran]
Tujuan utama mereka?    → [aksi utama dalam 1 kalimat]
Frequensi pemakaian?    → [setiap hari / sesekali / jarang]
Kondisi pemakaian?      → [terburu-buru / santai / monitoring]
```

Untuk MyGameON Hub, user adalah **satu orang operator yang bekerja cepat** — setiap friction point bermakna karena task diulang puluhan kali sehari.

---

## Hierarki Visual: Satu Fokus Per Area

**Aturan utama**: Setiap area layar harus punya **satu elemen yang paling menonjol** — the primary action atau informasi terpenting.

```
❌ Salah — semua elemen punya bobot sama:
[Button Upload] [Button Refresh] [Button Settings] [Button History]
semua ukuran sama, semua warna sama → user bingung harus ke mana

✅ Benar — ada hierarki jelas:
[Button UPLOAD → besar, prominent]  [Refresh ↺]  [⋯ lainnya]
```

**Cara implementasi di Tailwind:**
- Primary action: `bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold`
- Secondary: `border border-gray-600 text-gray-300 px-4 py-2 rounded-lg`
- Tertiary/destructive: icon button tanpa border, text lebih kecil

---

## Progressive Disclosure: Default Minimal

Tampilkan hanya **apa yang dibutuhkan untuk membuat keputusan saat ini**.

```
❌ Salah — semua informasi dump sekaligus:
Folder: Minecraft Dungeons II
Path: D:\Downloads\staging\Minecraft Dungeons II
Size: 41.7 MB (raw archive) / real size: 12.3 GB (estimated)
Created: 2026-10-06 14:23:17
Modified: 2026-10-06 14:23:17
Files: 12 files, 3 folders
Status: RAW_ARCHIVE → needs extraction
Drive workspace: workspace-1@gmail.com
Upload mode: new game
Archive parts: 12 parts detected

✅ Benar — default minimal, detail on-demand:
[●] Minecraft Dungeons II
    RAW_ARCHIVE · 41.7 MB → ~12 GB estimated
    [▸ Detail]   [Upload ke Drive ↑]
```

**Pattern yang dipakai:**
- `<details>` atau accordion untuk info tambahan
- Tooltip untuk info yang jarang dibutuhkan
- Side panel / modal untuk settings yang tidak sering diubah

---

## Status Visual: Selalu Jelas, Selalu Konsisten

Setiap item yang punya status harus menggunakan **sistem warna + icon yang konsisten** di seluruh aplikasi:

| Status | Warna | Icon | Contoh |
|--------|-------|------|--------|
| Selesai / Tersedia | Hijau `text-green-400` | `✓` atau `●` hijau | "Di Drive", "Sudah Listed" |
| Sedang proses | Biru/kuning `text-blue-400` | `◌` spinner | "Uploading...", "Downloading..." |
| Menunggu / Belum dikerjakan | Abu `text-gray-400` | `○` kosong | "Belum upload", "Belum listing" |
| Error / Gagal | Merah `text-red-400` | `✗` atau `!` | "Upload gagal", "Python not found" |
| Perlu perhatian | Kuning `text-yellow-400` | `△` | "RAW_ARCHIVE, perlu prep" |

**PENTING**: Gunakan sistem yang sama di Download Hub, Studio, dan Listing Studio — jangan 3 sistem berbeda.

---

## Layout Patterns untuk MyGameON Hub

### Pattern A: List + Detail Panel (untuk halaman dengan banyak item)

```
┌─────────────────┬──────────────────────────────────┐
│  LIST           │  DETAIL / ACTION PANEL           │
│  ─────          │  ──────────────────────          │
│  [item 1] ←     │  [Nama item yang dipilih]        │
│  [item 2]       │  [Status badges]                 │
│  [item 3]       │                                  │
│                 │  [PRIMARY ACTION BUTTON]         │
│                 │  [secondary actions]             │
└─────────────────┴──────────────────────────────────┘
```

Dipakai di: Studio Workbench (folder list + upload panel)

**Aturan**: Primary action button di detail panel harus **selalu visible** tanpa scroll, di posisi yang sama untuk semua item.

### Pattern B: Pipeline Card (untuk item dengan tahapan)

```
┌──────────────────────────────────────────────┐
│  Game Title                    [Status Badge]│
│  Sub info (size, date)                       │
│                                              │
│  Pipeline:  ○ Download  →  ● Drive  →  ○ Shopee │
│                                              │
│  [Aksi yang relevan dengan status saat ini]  │
└──────────────────────────────────────────────┘
```

Dipakai di: Dashboard status board, item di list manapun

### Pattern C: Full-width Work Area (untuk task yang butuh fokus)

```
┌──────────────────────────────────────────────────┐
│  [Breadcrumb / konteks]           [Status badge] │
├──────────────────────────────────────────────────┤
│                                                  │
│         [PRIMARY ACTION — besar, tengah]        │
│                                                  │
│  [Info pendukung — lebih kecil, di bawah]       │
│  [Secondary actions — di bawah primary]         │
└──────────────────────────────────────────────────┘
```

Dipakai di: Listing Studio generate slide, konfirmasi upload

---

## Feedback Instan: Setiap Aksi Harus Ada Respons

User tidak boleh bertanya-tanya "apakah tombol ini berhasil ditekan?"

```
❌ Salah:
User klik Upload → tidak ada yang berubah selama 2 detik → user klik lagi → double upload

✅ Benar:
User klik Upload → tombol langsung berubah ke "Uploading..." + disabled → progress bar muncul
```

**Pattern yang wajib:**
- Button state: `loading` (disabled + spinner) selama proses berlangsung
- Success: toast hijau + perubahan visual pada item (badge status berubah)
- Error: toast merah + detail error yang actionable ("Python tidak ditemukan di PATH. Pastikan Python 3.x ter-install.")
- Toast: gunakan `useToast()` hook dari `components/ui/Toast.jsx` — **jangan buat sistem baru**

---

## Copy & Label: Bahasa yang Jelas

Setiap label, button, dan pesan error harus dalam **Bahasa Indonesia** dan langsung menjelaskan aksi/kondisi.

```
❌ Buruk:
"Process" → proses apa?
"Submit" → submit ke mana?
"Error occurred" → error apa?
"Status: on_drive" → enum teknis, user tidak paham

✅ Baik:
"Upload ke Drive" → jelas
"Tandai Sudah Di-Listing" → jelas
"Python tidak ditemukan. Install Python 3.x dan tambahkan ke PATH." → actionable
"✅ Sudah di Drive" → mudah dibaca
```

---

## Responsive & Electron Context

Aplikasi ini berjalan di **Electron desktop** — bukan mobile-first. Namun tetap perhatikan:

- Minimum window width: ~1200px (user bisa resize)
- Jangan hardcode `calc(100vh - 280px)` — gunakan flex layout dengan `overflow-y: auto` pada container
- Scroll area: batasi pada container spesifik, bukan whole-page scroll jika bisa dihindari
- Font size minimal `14px` untuk konten, `12px` untuk metadata sekunder

---

## Checklist Sebelum Submit UI Code

Sebelum dianggap selesai, jawab:

- [ ] Apakah aksi utama halaman ini sudah paling menonjol visually?
- [ ] Apakah semua status menggunakan sistem warna yang konsisten?
- [ ] Apakah ada informasi yang bisa di-collapse karena tidak selalu dibutuhkan?
- [ ] Apakah setiap aksi punya feedback visual (loading/success/error)?
- [ ] Apakah semua label/copy dalam Bahasa Indonesia dan jelas?
- [ ] Apakah `useToast()` dipakai (bukan sistem toast custom baru)?
- [ ] Apakah layout tidak punya magic number hardcoded (seperti `280px`)?
- [ ] Apakah user bisa menyelesaikan task utama tanpa scroll di layar 1080p?
