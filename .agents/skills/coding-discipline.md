# Skill: Coding Discipline (Disiplin Coding)

## Ikhtisar

Disiplin coding adalah tentang bagaimana kamu menulis, mereferensi, dan memodifikasi kode. Tujuannya: menghasilkan kode yang **konsisten dengan codebase existing**, mudah di-review, dan tidak memperkenalkan masalah baru.

---

## Referensi Kode

### Format Wajib

Selalu referensi kode menggunakan format:

```
file_path:line_number
```

Contoh:
- `src/components/Button.tsx:42` — merujuk ke baris 42 di file Button.tsx
- `src/utils/format.ts:15-20` — merujuk ke rentang baris 15-20

### Mengapa Penting:
- User bisa klik referensi dan langsung melihat kode yang dimaksud
- Memudahkan review dan diskusi
- Menghindari ambiguity ("itu file mana?" vs "src/auth/login.tsx:33")

---

## Edit vs Write

### Prefer `Edit` (partial change)

Gunakan **Edit** untuk:
- Mengubah bagian kecil dari file yang sudah ada
- Menambahkan function/component baru ke file existing
- Memperbaiki bug di baris tertentu
- Update import statement

**Aturan Edit:**
- `old_string` harus **exact match** termasuk indentasi
- `old_string` harus **unique** dalam file — jika tidak unique, edit akan gagal
- Baca file dulu sebelum edit — edit tanpa baca akan gagal

### Gunakan `Write` (full replacement) Hanya Untuk:

- Membuat **file baru** yang belum ada
- Melakukan **replacement total** dari file yang sudah dibaca
- File yang benar-benar perlu di-rewrite dari nol

### DILARANG:

- ❌ `Write` untuk file yang belum pernah kamu `Read`
- ❌ `Write` untuk perubahan parsial — gunakan `Edit`
- ❌ Re-read file yang baru saja di-edit untuk "verifikasi" — percaya tool, jika edit gagal akan error

---

## Match Existing Style

### Prinsip: Kode kamu harus terasa seperti ditulis oleh developer senior di project ini.

### Yang Harus Di-match:

| Aspek | Contoh | Cara Mendeteksi |
|---|---|---|
| **Naming** | `camelCase` vs `snake_case` vs `PascalCase` | Baca 3-5 file di area yang sama |
| **Comment density** | Minimal vs moderate vs heavy | Bandingkan dengan file sejenis |
| **Comment style** | `// inline` vs `/* block */` vs JSDoc `/** */` | Lihat pattern komentar existing |
| **Indentation** | 2 spaces vs 4 spaces vs tabs | Perhatikan file yang akan diubah |
| **Quotes** | Single `'` vs double `"` vs backtick `` ` `` | Cek linter config atau file existing |
| **Semicolons** | Pakai vs tidak | Cek file existing dan linter config |
| **Trailing commas** | Pakai vs tidak | Cek file existing dan linter config |
| **Component style** | Arrow function vs function declaration | Lihat component lain di project |
| **Import order** | External → Internal → Relative | Lihat import di file existing |
| **Export style** | Default vs named | Lihat pattern di project |
| **Type annotations** | Explicit vs inferred | Lihat seberapa strict TypeScript di project |

### Proses Matching:

1. **Identifikasi area** — Tentukan di folder/file mana kamu akan menulis kode
2. **Baca 3-5 file serupa** — Pahami pattern yang dominan
3. **Ikuti pattern dominan** — Jangan mix style dari file yang berbeda
4. **Konsisten dalam satu perubahan** — Jangan ganti style di tengah jalan

---

## Urusan Import

### Aturan:

1. **Hanya import yang dibutuhkan** — Jangan import semuanya "biar gampang"
2. **Ikuti order existing** — Biasanya: external packages → internal modules → relative paths → types
3. **Perhatikan barrel exports** — Cek apakah ada `index.ts` yang re-exports
4. **Avoid circular imports** — Perhatikan dependency graph

### Alias / Path Mapping:

- Cek `tsconfig.json` atau framework config untuk path aliases (e.g., `@/components`, `@lib/utils`)
- **Gunakan alias** jika sudah dikonfigurasi, jangan hardcode relative paths yang panjang

---

## Type Safety

### Aturan:

1. **Ikuti strictness level project** — Jika project pakai strict TypeScript, jangan tambahkan `any` tanpa alasan kuat.
2. **Prefer existing types** — Cek apakah sudah ada type definition yang bisa digunakan.
3. **Jangan over-type** — Jika project menggunakan inference, jangan tambahkan type yang redundant.
4. **Export types yang penting** — Jika membuat type baru yang bisa dipakai elsewhere, export itu.

---

## Error Handling

### Pola yang Harus Diikuti:

1. **Baca error handling pattern existing** — Bagaimana project menangani error?
2. **Consistent** — Jangan mix pattern (try/catch di sini, Result type di sana) tanpa alasan
3. **User-facing vs system error** — Pisahkan error yang ditampilkan ke user vs error yang di-log

---

## Anti-Pattern yang HARUS Dihindari

- 🚫 Menulis kode tanpa membaca file yang akan diubah
- 🚫 Mengimpose coding style sendiri tanpa ikuti konvensi existing
- 🚫 Menggunakan `Write` untuk perubahan parsial
- 🚫 Menambahkan `any` di project yang strict
- 🚫 Import library baru tanpa cek apakah sudah ada alternative di project
- 🚫 Membuat type baru yang redundant dengan existing type
- 🚫 Tidak match comment density (file lain minimal komentar, kamu tambahkan JSDoc lengkap di setiap function)
- 🚫 Mix quote style atau semicolon style dalam satu file
- 🚫 Hardcode relative path panjang ketika ada alias
- 🚫 Re-read file yang baru diedit (percaya tool)
