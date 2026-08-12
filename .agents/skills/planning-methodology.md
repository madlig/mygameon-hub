# Skill: Planning Methodology (Sistem 4 Fase)

## Ikhtisar

Setiap task yang non-trivial WAJIB melewati sistem planning 4 fase ini. Jangan pernah langsung menulis kode untuk task yang kompleks tanpa planning terlebih dahulu.

## Kapan WAJIB Planning Mode

Aktifkan Planning Mode (jika tersedia) atau lakukan planning eksplisit ketika task memenuhi **salah satu** kriteria berikut:

- ✅ Perubahan melibatkan **lebih dari 2-3 file**
- ✅ Ada **keputusan arsitektural** yang perlu dipilih
- ✅ Requirements **ambigu** atau tidak lengkap
- ✅ Implementasi **fitur baru** yang signifikan
- ✅ **Bug fix** yang memerlukan investigasi root cause
- ✅ **Refactoring** yang mempengaruhi struktur kode
- ✅ Ada **multiple valid approaches** untuk menyelesaikan masalah

## Kapan TIDAK Perlu Planning Mode

Lewati planning dan langsung kerja untuk:

- ❌ Perbaikan typo atau bug satu baris yang obvious
- ❌ Menambahkan satu function dengan requirement yang sangat jelas dan spesifik
- ❌ Task yang user sudah berikan instruksi detail, step-by-step
- ❌ Question riset murni (tidak ada kode yang ditulis)

---

## Fase 1: Pemahaman Awal (Initial Understanding)

**Tujuan**: Mendapatkan pemahaman komprehensif tentang request user dan codebase terkait.

### Langkah-langkah:

1. **Baca workspace instructions** — Periksa `AGENTS.md`, `README.md`, atau file konfigurasi yang relevan. Ini adalah sumber kebenaran pertama.

2. **Periksa git context** — Lihat branch aktif, recent commits, dan perubahan yang sudah berjalan. Ini memberi konteks tentang apa yang sedang dikerjakan tim.

3. **Eksplorasi codebase** — Gunakan sub-agent atau search tool untuk:
   - Mencari fungsi, utility, atau pattern yang sudah ada dan bisa di-reuse
   - Memahami arsitektur dan struktur kode terkait
   - Mengidentifikasi file-file yang akan terpengaruh
   - Membaca konvensi coding yang dipakai

4. **Ajukan pertanyaan klarifikasi** — Jika ada sesuatu yang tidak jelas, **tanyakan ke user** daripada mengasumsikan. Gunakan format pertanyaan yang spesifik dengan opsi yang jelas.

### Aturan Eksplorasi Paralel

- **Maksimal 3 sub-agent** dalam satu eksplorasi paralel.
- **1 agent** cukup untuk task yang terisolasi di file yang sudah diketahui.
- **Multiple agents** ketika: scope tidak pasti, multiple area codebase terlibat, atau perlu membandingkan pattern di beberapa lokasi.
- Berikan **fokus spesifik** ke setiap agent (misalnya: "cari existing auth implementation" vs "cari testing patterns").
- **Kualitas > kuantitas** — lebih baik 1 agent yang tepat daripada 3 agent yang redundan.

---

## Fase 2: Desain (Design)

**Tujuan**: Merancang approach implementasi yang konkret dan terukur.

### Langkah-langkah:

1. **Gunakan konteks dari Fase 1** — Termasuk file-file yang sudah dibaca dan pattern yang sudah ditemukan.

2. **Pertimbangkan trade-off** — Untuk setiap task type, pikirkan:
   - **Fitur baru**: simplicity vs performance vs maintainability
   - **Bug fix**: root cause fix vs workaround vs prevention
   - **Refactoring**: minimal change vs clean architecture
   - **Multi-file**: backward compatibility, test coverage, migration path

3. **Prioritaskan reuse** — Jika menemukan existing utility atau pattern yang cocok, **gunakan itu** daripada membuat baru. Catat di plan bahwa kamu menemukan existing solution.

4. **Produksi rencana konkret** — Plan harus mencakup:
   - Daftar file yang akan diubah/dibuat
   - Perubahan spesifik per file
   - Urutan eksekusi (dependency order)
   - Risk dan mitigasi
   - Test/verifikasi plan

---

## Fase 3: Review

**Tujuan**: Memastikan plan selaras dengan intent user dan tidak ada yang terlewat.

### Langkah-langkah:

1. **Baca file-file kritis** — Untuk area yang akan diubah, baca file lengkap (bukan hanya excerpt) untuk memastikan pemahaman yang mendalam.

2. **Validasi terhadap original request** — Pastikan plan menjawab apa yang user minta, bukan apa yang kamu asumsikan.

3. **Identifikasi gaps** — Apakah ada edge case yang belum tercakup? Apakah ada dependency yang terlewat?

4. **Klarifikasi akhir** — Gunakan pertanyaan hanya untuk hal yang benar-benar perlu keputusan user. Jangan tanya hal yang bisa kamu putuskan sendiri dari kode.

---

## Fase 4: Eksekusi (Execute)

**Tujuan**: Melaksanakan plan setelah mendapat approval.

### Langkah-langkah:

1. **Minta approval** — Presentasikan plan final ke user dan tunggu persetujuan sebelum mulai coding. Gunakan format yang jelas dan terstruktur.

2. **Update todo list** — Buat task list sebelum memulai. Track satu item `in_progress` pada satu waktu.

3. **Eksekusi berurutan** — Ikuti urutan dari plan. Selesaikan satu perubahan sebelum lanjut ke berikutnya.

4. **Verifikasi** — Setelah setiap step signifikan, verifikasi hasilnya. Jalankan test jika ada.

5. **Walkthrough** — Setelah selesai, berikan ringkasan:
   - Checklist apa saja yang dikerjakan
   - Daftar file yang diubah
   - Screenshot/bukti jika diperlukan
   - Penjelasan strategi implementasi

---

## Anti-Pattern yang HARUS Dihindari

- 🚫 Langsung tulis kode tanpa baca existing codebase
- 🚫 Mengasumsikan requirements tanpa klarifikasi
- 🚫 Membuat utility/function baru padahal sudah ada yang serupa
- 🚫 Planning yang terlalu abstrak (tidak ada file/line spesifik)
- 🚫 Skip review phase karena "sudah paham"
- 🚫 Commit tanpa diminta
- 🚫 Melanjutkan tanpa approval di Fase 4
