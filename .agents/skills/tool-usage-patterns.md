# Skill: Tool Usage Patterns (Pola Penggunaan Tool)

## Ikhtisar

Penggunaan tool yang tepat adalah kunci efisiensi. Gunakan tool yang **paling spesifik** untuk setiap tugas. Parallel-kan independent calls. Delegate ke sub-agent untuk task kompleks.

---

## Peta Tool & Kapan Digunakan

### File Operations

| Tool | Kapan Digunakan | Jangan Gunakan Untuk |
|---|---|---|
| **Read** | Membaca file, memahami kode, melihat konfigurasi | Mengambil satu baris dari file kecil (baca saja seluruhnya) |
| **Edit** | Perubahan parsial pada file yang sudah dibaca | File baru, replacement total |
| **Write** | File baru, replacement total file yang sudah dibaca | Perubahan parsial, file yang belum dibaca |

### Aturan Read:
- **Default: baca seluruh file** — Jangan berikan offset/limit kecuali file benar-benar besar (>2000 baris)
- **Baca gambar** — Tool Read bisa menampilkan visual untuk PNG, JPG, dll
- **Jangan re-read** file yang baru saja di-edit — percaya tool
- **Selalu baca sebelum edit** — Edit tanpa Read akan gagal

### Aturan Edit:
- `old_string` harus **exact match** termasuk indentasi dan whitespace
- `old_string` harus **unique** dalam file
- Gunakan `replace_all: true` hanya jika benar-benar ingin replace semua occurrence

### Aturan Write:
- **Hanya untuk file baru** atau **full replacement**
- WAJIB Read file dulu sebelum Write (kecuali file baru)
- Jangan gunakan Write untuk perubahan parsial

---

### Search & Exploration

| Tool | Kapan Digunakan | Catatan |
|---|---|---|
| **Search (grep/glob)** | Mencari keyword, file pattern, symbol names | Lebih cepat dari baca seluruh directory |
| **Sub-agent (Explore)** | Eksplorasi luas, multiple lokasi, fan-out search | Untuk research, bukan implementasi |
| **Sub-agent (General)** | Task multi-step kompleks yang memerlukan coding | Agent bisa baca, edit, write file |

### Aturan Sub-Agent:
- **Explore agent** — Read-only, untuk pencarian broad. Tidak mengubah file. Good untuk: mencari pattern, memahami arsitektur, research.
- **General agent** — Bisa baca, edit, write. Good untuk: task kompleks yang butuh multiple file changes.
- **Max 3 agents paralel** — Jangan spawn lebih dari 3 agents sekaligus.
- **Prompt harus self-contained** — Setiap agent call dimulai fresh, tidak inherit context dari parent.
- **Delegate, jangan duplicate** — Jika kamu sudah delegate pencarian ke agent, jangan lakukan pencarian yang sama sendiri.

---

### Terminal / CLI

| Kapan Menggunakan Bash | Jangan Menggunakan Bash Untuk |
|---|---|
| `git` operations (status, log, diff, branch, add, commit) | `cat`, `head`, `tail` — gunakan tool Read |
| `npm`, `yarn`, `pnpm` (install, run, build) | `sed`, `awk`, `echo` — gunakan tool Edit |
| `ls`, `find`, `tree` untuk navigasi direktori | `grep` — gunakan tool Search |
| Running tests | Mengedit file — gunakan tool Edit |
| `gh` CLI untuk GitHub operations | Membaca file — gunakan tool Read |

### Aturan Bash:
- **Jangan gunakan interactive flags** — Tidak pakai `-i` (e.g., `git rebase -i`, `git add -i`)
- **Commit hanya jika diminta** — Jangan auto-commit
- **Branch dulu di main** — Jika di main branch dan akan membuat perubahan, buat branch dulu
- **Prefer dedicated tools** — Jika ada tool khusus, gunakan itu daripada pipe bash commands
- **Jalankan di background** untuk command yang lama — supaya tidak blocking

---

### Browser Agent (jika tersedia)

| Kapan Menggunakan | Contoh |
|---|---|
| Testing UI secara visual | Screenshot halaman, cek layout |
| Verifikasi fitur setelah perubahan | Navigate, click, input, cek result |
| Debug CSS/rendering | Inspect element, cek responsive |
| End-to-end testing | Fill form, submit, verify output |

### Aturan Browser Agent:
- Gunakan untuk **verifikasi visual** — lebih reliable dari sekadar membaca kode
- **Screenshot** untuk evidence — Simpan screenshot sebagai artifact/bukti
- **Capture console logs** — Untuk debug JavaScript errors
- **Record video** untuk flow testing yang kompleks

---

### User Interaction

| Tool | Kapan Digunakan | Jangan Gunakan Untuk |
|---|---|---|
| **AskUserQuestion** | Keputusan yang benar-benar user's to make | Hal yang bisa kamu putuskan dari kode |
| **TodoWrite** | Tracking progress task | Menyimpan info permanen |

### Aturan AskUserQuestion:
- **Hanya untuk keputusan user** — Bukan untuk konfirmasi plan approval (gunakan mekanisme plan approval yang tersedia)
- **Berikan opsi konkret** — 2-4 opsi yang jelas dengan penjelasan
- **Jangan tanya hal yang bisa kamu putuskan** — Jika ada default yang obvious, gunakan itu dan beri tahu user
- **Specific dan fokus** — Satu pertanyaan per topic, bukan 5 pertanyaan sekaligus

### Aturan TodoWrite:
- **Satu item in_progress** pada satu waktu
- **Mark completed** sebelum pindah ke item berikutnya
- **Update seluruh list** setiap kali ada perubahan status
- **Prioritas**: high, medium, low

---

## Parallel Execution

### Kapan Bisa Parallel:

Independent tool calls dalam **satu pesan**:
- ✅ Membaca 3 file yang berbeda sekaligus
- ✅ Searching di 2 lokasi berbeda
- ✅ Spawn 2-3 explore agents dengan fokus berbeda
- ✅ Edit + Bash jika keduanya independent

### Kapan TIDAK Boleh Parallel:

- ❌ Edit file yang depend on hasil Read yang belum selesai
- ❌ Write setelah Edit (harus sequential)
- ❌ Commit setelah Edit (harus sequential)

---

## Anti-Pattern yang HARUS Dihindari

- 🚫 Menggunakan `cat`/`head`/`tail` di Bash ketika ada tool Read
- 🚫 Menggunakan `sed`/`awk` di Bash ketika ada tool Edit
- 🚫 Menggunakan `echo "..." > file` ketika ada tool Write
- 🚫 Spawn terlalu banyak sub-agent (max 3 paralel)
- 🚫 Sub-agent prompt yang tidak self-contained
- 🚫 Tidak parallel-kan independent tool calls (waste of turns)
- 🚫 Git interactive flags (`-i`)
- 🚫 Auto-commit tanpa diminta
- 🚫 Menggunakan AskUserQuestion untuk hal yang bisa diputuskan sendiri
