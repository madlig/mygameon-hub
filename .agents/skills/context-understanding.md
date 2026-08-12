# Skill: Context Understanding (Pemahaman Konteks)

## Ikhtisar

Kemampuan memahami konteks adalah fondasi dari semua pekerjaan engineering yang berkualitas. Sebelum menulis satu baris kode pun, kamu WAJIB memahami:

1. **Apa instruksi workspace** (AGENTS.md, config, conventions)
2. **Apa state codebase saat ini** (git status, branch, recent changes)
3. **Apa pattern yang sudah ada** (existing implementations, naming, architecture)
4. **Apa tech stack yang dipakai** (framework, libraries, versions)

---

## Langkah 1: Baca Workspace Instructions

### File yang WAJIB dibaca (jika ada):

| File | Kapan Relevan | Mengapa Penting |
|---|---|---|
| `AGENTS.md` | Selalu | Berisi workspace rules, conventions, dan constraints khusus project |
| `README.md` | Awal project / task setup | Tech stack overview, setup instructions, architecture description |
| `.env.example` / `.env.local` | Task yang melibatkan environment/config | Variable yang dibutuhkan, naming convention env vars |
| `package.json` / `tsconfig.json` | Task yang melibatkan dependencies atau types | Dependencies, scripts, project configuration |
| Framework config (e.g., `next.config.js`, `tailwind.config.ts`) | Task yang terkait framework | Framework-specific behavior, plugins, custom config |
| `.gitignore` | Commit / file creation | Apa yang di-exclude dari version control |

### Aturan Membaca:

- **Baca dulu, baru kerja** — Jangan pernah skip langkah ini.
- **Perhatikan deprecation notices** — Jika workspace instructions menyebut framework versi tertentu, cek apakah ada breaking changes.
- **Ikuti aturan workspace** — Jika AGENTS.md bilang "jangan gunakan approach X", maka jangan gunakan approach X. Instructions workspace **OVERRIDE** default behavior kamu.
- **Catat konvensi** — Perhatikan naming conventions (camelCase vs snake_case vs kebab-case), comment style, dan file organization.

---

## Langkah 2: Periksa Git Context

Sebelum setiap task, periksa:

### Git Status
- **Branch aktif** — Apakah kamu di `main` atau feature branch? Jika di `main`, pertimbangkan untuk membuat branch baru sebelum membuat perubahan.
- **Uncommitted changes** — Apakah ada perubahan yang belum di-commit? Ini bisa mempengaruhi apa yang kamu kerjakan.
- **Staged files** — Apa yang sudah di-stage?

### Recent Commits
- Baca 5-10 commit terakhir untuk memahami:
  - Apa yang sedang dikerjakan tim
  - Pattern commit message yang digunakan
  - Fitur atau fix terbaru yang relevan dengan task kamu

### Aturan Git:
- **Jangan commit tanpa diminta** — Hanya commit ketika user secara eksplisit meminta.
- **Jangan push tanpa diminta** — Terutama ke `main`.
- **Branch dulu di main** — Jika di main branch dan akan membuat perubahan signifikan, buat feature branch terlebih dahulu.
- **Jangan gunakan interactive flags** — Tidak pakai `git rebase -i`, `git add -i`, atau flag interaktif lainnya.
- **Gunakan `gh` CLI** — Untuk GitHub operations (PRs, issues, API) gunakan `gh` bukan manual API calls.

---

## Langkah 3: Pattern Matching

Ini adalah skill paling penting untuk menghasilkan kode yang menyatu dengan codebase.

### Apa yang Harus Dicari:

1. **Existing functions/utilities** — Sebelum membuat function baru, cari apakah sudah ada:
   - Helper functions yang serupa
   - Utility libraries yang sudah di-import
   - Shared hooks, components, atau services

2. **Naming conventions** — Perhatikan:
   - Variable naming: `camelCase`, `PascalCase`, `snake_case`?
   - File naming: `kebab-case.ts`, `PascalCase.tsx`, `snake_case.py`?
   - Component naming vs utility naming
   - Test file naming pattern

3. **Code structure** — Perhatikan:
   - Bagaimana file diorganisir (by feature vs by type)?
   - Apakah ada index barrel files?
   - Import style (relative vs absolute paths)?
   - Export default vs named exports?

4. **Comment density** — Perhatikan:
   - Seberapa banyak komentar di codebase?
   - Style komentar: JSDoc, inline, block?
   - Bahasa komentar: Inggris atau Indonesia?

5. **Error handling pattern** — Perhatikan:
   - Bagaimana error ditangani (try/catch, Result type, error boundary)?
   - Apakah ada global error handler?
   - Toast/notification pattern untuk user-facing errors?

### Teknik Pencarian:

- **Search by keyword** — Cari nama fungsi atau konsep yang relevan
- **Search by file type** — Cari file dengan extension atau naming pattern tertentu
- **Search by directory** — Eksplorasi struktur folder untuk memahami organization
- **Read similar files** — Baca file yang melakukan hal serupa untuk memahami pattern
- **Check imports** — Lihat apa yang di-import di file terkait untuk menemukan shared code

---

## Langkah 4: Tech Stack Detection

Pahami tech stack dari:

### Dari Dependencies (`package.json`, `requirements.txt`, dll):
- Framework utama (Next.js, Express, Django, dll)
- State management (Redux, Zustand, Pinia, dll)
- Styling solution (Tailwind, CSS Modules, Styled Components, dll)
- Testing framework (Jest, Vitest, Cypress, dll)
- ORM / Database (Prisma, Drizzle, SQLAlchemy, dll)

### Dari File Structure:
- Routing pattern (file-based vs config-based)
- API pattern (REST, GraphQL, tRPC)
- Component pattern (compound components, render props, hooks)
- Data fetching pattern (SWR, React Query, server actions)

### Dari Configuration:
- TypeScript strictness level
- Linter rules (ESLint, Prettier)
- Build tool (Webpack, Vite, Turbopack)
- Environment configuration pattern

---

## Checklist Context Understanding

Sebelum memulai task, pastikan kamu sudah:

- [ ] Membaca AGENTS.md / workspace instructions
- [ ] Memeriksa git status dan branch aktif
- [ ] Membaca 5-10 recent commits
- [ ] Mencari existing implementations yang bisa di-reuse
- [ ] Memahami naming conventions di codebase
- [ ] Memahami code structure dan organization
- [ ] Mengidentifikasi comment style dan density
- [ ] Memahami error handling pattern
- [ ] Mengidentifikasi tech stack dan versi
- [ ] Menyadari ada/tidaknya breaking changes dari framework

---

## Anti-Pattern yang HARUS Dihindari

- 🚫 Skip membaca AGENTS.md karena "sudah tahu"
- 🚫 Langsung buat function baru tanpa cek apakah sudah ada yang serupa
- 🚫 Impose coding style sendiri tanpa ikuti konvensi existing
- 🚫 Tidak cek git status sebelum mulai (bisa kacau kalau ada uncommitted changes)
- 🚫 Menggunakan API/framework versi lama padahal project sudah upgrade
- 🚫 Tidak membaca file yang akan diubah sebelum mengubahnya
