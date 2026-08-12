# Panduan Setup & Optimasi Antigravity IDE

> Panduan konfigurasi prompt ZCode-style untuk Gemini 3 Pro di Google Antigravity IDE.

## 📁 Struktur File

```
.agents/
  agents.md                              ← Persona utama: ZCode-style Engineer
  skills/
    planning-methodology.md              ← Sistem 4 Fase Planning
    context-understanding.md             ← Pemahaman Konteks & Workspace
    coding-discipline.md                 ← Disiplin Coding & Referensi
    tool-usage-patterns.md               ← Pola Penggunaan Tool
    working-principles.md               ← Prinsip Kerja & Edge Cases
docs/
  gemini-zcode-prompt/
    README.md                            ← File ini (panduan)
    combined-prompt.md                   ← Versi gabungan (fallback/manual paste)
```

## 🚀 Cara Setup di Antigravity IDE

### Langkah 1: Pastikan File di Tempat yang Benar

File `.agents/` dan `agents.md` sudah ada di root project. Antigravity IDE akan membaca konfigurasi ini secara otomatis ketika kamu membuka project di IDE.

### Langkah 2: Buka Project di Antigravity IDE

1. Buka Antigravity IDE
2. Open folder project ini (`mygameon-hub`)
3. Antigravity akan mendeteksi folder `.agents/` dan memuat konfigurasi

### Langkah 3: Verifikasi Agent Ter-load

Di Agent Manager surface, kamu harus melihat agent `@engineer` dengan persona yang sudah didefinisikan. Skills juga akan ter-load otomatis dari folder `skills/`.

## ⚙️ Rekomendasi Settings Antigravity IDE

### Terminal Mode

- **Default**: `Request Review` — Agent akan minta persetujuan sebelum menjalankan terminal command
- **Untuk development aktif**: `Always Proceed` — Agent auto-eksekusi tanpa minta approval (lebih cepat tapi less safe)
- **Rekomendasi**: Mulai dengan `Request Review`, pindah ke `Always Proceed` setelah trust terbangun

### Strict Mode

- **Aktifkan** untuk project production / sensitive
- Ini akan:
  - Force terminal ke `Request Review`
  - Restrict external resource access
  - Enforce `.gitignore` rules
  - Disable non-workspace file access

### Review Policy

| Level | Kapan Digunakan | Dampak |
|---|---|---|
| **Always Approve** | Code review ketat | Setiap perubahan perlu approval manual |
| **Ask for Approval** | Balance (recommended) | Agent minta approval untuk task kompleks |
| **Auto-detect** | Fast iteration | Agent evaluate sendiri apakah perlu approval |

### Model Selection

| Task | Model Rekomendasi | Alasan |
|---|---|---|
| Complex logic, architecture, refactoring | **Gemini 3 Pro** | Reasoning depth tinggi |
| Bug fix yang perlu investigasi | **Gemini 3 Pro** | Pattern recognition kuat |
| Boilerplate generation | **Model ringan** (jika tersedia) | Cukup untuk task mekanis |
| Code review / audit | **Gemini 3 Pro** | Analisis mendalam |

### Thinking Budget

- Gemini 3 Pro mendukung `thinkingConfig` / `thinkingBudget`
- **Default biasanya cukup** untuk kebanyakan task
- **Tingkatkan** untuk task yang sangat kompleks (large refactoring, architecture design)

### Browser Agent

- **Aktifkan** untuk project yang memiliki frontend
- Gunakan untuk verifikasi visual setelah perubahan UI
- Set URL Allowlist jika perlu membatasi akses

### Knowledge Base

- Gunakan untuk menyimpan context yang sering dipakai
- Contoh: konvensi naming, architecture decisions, common utilities
- Agent bisa membaca ini untuk task selanjutnya tanpa re-discover

## 🎯 Tips Optimasi

### 1. Manfaatkan Planning Mode

- Agent akan generate Implementation Plan sebelum coding
- **Review plan-nya** — tambahkan inline comments untuk architectural constraints
- Ini mencegah agent dari membuat keputusan yang tidak diinginkan

### 2. Parallel Tasks via Agent Manager

- Untuk task yang bisa diparalelkan, spawn multiple agents:
  - Agent 1: Frontend UI changes
  - Agent 2: Backend API changes
  - Agent 3: Test writing
- Gunakan **per-task model assignment** — model berat untuk logic, ringan untuk boilerplate

### 3. Inline Feedback di Artifacts

- Jika agent menghasilkan artifact (plan, diff, screenshot), kamu bisa beri **inline feedback**
- Agent akan incorporate feedback tanpa henti eksekusi
- Mirip Google Docs comments

### 4. Workflow Automation

Untuk task berulang, buat custom workflow di `.agents/workflows/`:
- `/review` — Review kode terbaru
- `/refactor <file>` — Refactor dengan pattern tertentu
- `/test <feature>` — Tulis test untuk feature tertentu

Contoh workflow `.agents/workflows/review.md`:
```markdown
---
name: review
description: Review kode terbaru menggunakan ZCode methodology
---

1. Baca git diff dari commit terakhir
2. Identifikasi pola yang melanggar konvensi
3. Cek apakah ada potensi bug atau edge case
4. Berikan feedback konkret dengan referensi file:line
```

## 🔄 Kustomisasi

### Menyesuaikan dengan Project Spesifik

Edit `agents.md` untuk menambahkan constraint spesifik project:

```yaml
## Project-Specific Constraints
- Framework: Next.js 15 (App Router)
- Styling: Tailwind CSS
- State: Zustand
- Database: Drizzle ORM + PostgreSQL
- Testing: Vitest + Playwright
```

### Menambah Skill Baru

Buat file baru di `.agents/skills/` dengan nama yang deskriptif. Agent akan otomatis memuatnya.

### Menyesuaikan Bahasa

Semua prompt saat ini dalam Bahasa Indonesia. Untuk mengubah ke Bahasa Inggris:
1. Edit `agents.md` — ganti deskripsi persona
2. Edit setiap skill file — translate instruksi

## 📚 Referensi

- [Antigravity IDE - Official Site](https://antigravity.google/)
- [Antigravity IDE Settings](https://antigravity.google/docs/ide/settings)
- [Autonomous Developer Pipelines Codelab](https://codelabs.developers.google.com/autonomous-ai-developer-pipelines-antigravity)
- [Antigravity CLI Prompting Guide](https://antigravity.google/docs/cli/prompting)
- [Antigravity System Prompts Deep Dive](https://liduos.com/posts/google-antigravity-system-prompts/)

---

> **Note**: Prompt ini dirancang untuk mereplikasi pola pikir dan cara kerja ZCode (Claude Code) dalam lingkungan Antigravity IDE. Sesuaikan dengan kebutuhan project spesifik kamu.
