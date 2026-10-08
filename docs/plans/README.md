# MyGameON Hub — Rencana Rombakan Sistem

Dokumen ini adalah indeks dari 4 fase pengerjaan rombakan sistem MyGameON Hub.
Dibuat berdasarkan review menyeluruh kode tanggal 2026-10-06.

---

## Tujuan Akhir

Menjadikan 3 modul utama (Download Hub, Upload Studio, Listing Studio) saling terhubung
melalui **GameCatalog** sebagai pusat status, sehingga:

- Setiap game punya status yang bisa dilacak di seluruh pipeline
- Tidak ada double-listing karena status sudah terpusat
- Bisa melihat game mana yang sudah di GDrive tapi belum di-listing Shopee
- Semua modul bisa dijalankan secara paralel, bukan sequential

---

## Urutan Pengerjaan

| Fase | File | Deskripsi | Bergantung Pada |
|------|------|-----------|----------------|
| **Phase 1** | `plan-phase-1-foundation.md` | Schema extension, API baru, shared utils, Toast component | — |
| **Phase 2** | `plan-phase-2-bugfix.md` | Fix bug kritis: polling race condition, Steam timeout, Python detection, base64 | Phase 1 |
| **Phase 3** | `plan-phase-3-integration.md` | Integrasi pipeline: auto-update catalog, filter belum listed, mark listed | Phase 1 + 2 |
| **Phase 4** | `plan-phase-4-refactor.md` | Refactor: loading states, custom hooks, navigation guard, toast migration | Phase 1 + 2 + 3 |

---

## Yang Tidak Diubah (Sudah Bagus)

- Arsitektur `CleanWorkbench` sebagai komponen terpisah — hanya props-nya yang dirapikan
- `folderStatus` 4 kondisi (RAW_ARCHIVE, PRE_INSTALLED, EXTRACTED_WITH_RAR, EMPTY_OR_JUNK)
- Auto-detect existing game saat folder dipilih di Studio
- CNL receiver + staging area di Download Hub
- WorkspaceDrivePicker + 2 mode upload (new/update)
- `sanitizeAndBrandGameFolder` di studioSanitizer
- Gemini AI generate copy — integrasi sudah ada, di Phase 3 disambungkan ke Catalog
- Progress bar live polling Studio (pattern sudah benar, hanya ditambahi circuit breaker)

---

## Summary Perubahan Per File

### Baru Dibuat
- `app/api/catalog/[id]/status/route.js`
- `app/api/catalog/pipeline/route.js`
- `app/api/listing/slide-preview/route.js`
- `components/ui/Toast.jsx`
- `hooks/useUploadQueue.js`
- `hooks/useNavigationGuard.js`

### Dimodifikasi
- `models/GameCatalog.js` — tambah pipeline/listing fields
- `lib/utils.js` — tambah formatBytes, formatSpeed
- `lib/downloadWatcher.js` — gunakan formatBytes dari utils
- `app/(dashboard)/layout.js` — wrap ToastProvider
- `app/(dashboard)/page.js` — panel game belum listing
- `app/(dashboard)/download/page.jsx` — polling fix, circuit breaker, useReducer, toast, nav guard
- `app/(dashboard)/studio/page.js` — catalog update post-upload, dedup, nav guard, toast
- `app/(dashboard)/scout/page.js` — catalog panel, mark listed, timeout fix, nav guard, toast
- `components/studio/CleanWorkbench.jsx` — queueState prop, useToast
- `app/api/listing/generate/route.js` — Python detection, remove base64, env fallback path
- `app/api/preferences/route.js` — listingOutputDir field
