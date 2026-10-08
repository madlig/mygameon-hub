# Skill: Logic & Data Patterns — Aturan Bisnis MyGameON Hub

## Ikhtisar

Skill ini mendefinisikan **aturan bisnis dan pola data** yang berlaku di seluruh codebase MyGameON Hub. Selalu rujuk ke skill ini sebelum menulis logika yang menyentuh GameCatalog, harga, status pipeline, atau integrasi eksternal.

---

## Aturan Bisnis Kritis (TIDAK BOLEH DILANGGAR)

### 1. Model AI: Hanya `gemini-3.6-flash`

```js
// ✅ Benar
const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// ❌ DILARANG KERAS — akan menyebabkan runtime error
const model = 'gemini-2.5-flash';
const model = 'gemini-2.0-flash';
```

### 2. Ground Truth Katalog = Google Drive

- Sebuah game "tersedia" jika dan hanya jika ada filenya di Google Drive.
- `GameCatalog` di MongoDB adalah mirror dari Drive — disinkronkan secara berkala.
- **Jangan pernah** membuat logika yang mengasumsikan game "tersedia" hanya berdasarkan data MongoDB tanpa cek Drive.

### 3. Pipeline Status: Selalu Update Lewat API

Setiap perubahan `pipelineStatus` game harus dilakukan via:
```
PATCH /api/catalog/[id]/status
Body: { pipelineStatus: '...', ...fieldsLain }
```

**Jangan** update `pipelineStatus` langsung di MongoDB tanpa lewat API — ada validasi dan side-effect yang perlu dijalankan.

**Urutan status yang valid:**
```
none → downloading → downloaded → extracted → uploading → on_drive → listing_ready → listed
```
Transisi mundur diperbolehkan (misal: re-upload → kembali ke `uploading`).

---

## Pola Data: GameCatalog

### Field Penting

```js
{
  // Identitas
  _id,
  title,           // nama game
  
  // Pipeline Status
  pipelineStatus,  // enum di atas
  
  // Google Drive
  folderId,        // GDrive folder ID
  driveWorkspaceEmail, // akun mana yang menyimpan
  lastUploadedAt,
  uploadMode,      // 'new' | 'update'
  
  // Shopee Listing
  shopeeListed,    // boolean
  shopeeListedAt,
  shopeeUrl,
  
  // Aset Listing
  listingAssets: {
    seoTitle,
    description,
    slidesFolderPath,  // path lokal, BUKAN base64
    generatedAt
  }
}
```

### Anti-pattern Umum

```js
// ❌ Salah: Return slide sebagai base64 di response
const slides = await Promise.all(slidePaths.map(p => fs.readFile(p, 'base64')));
return Response.json({ slides }); // bisa 18MB+!

// ✅ Benar: Return path saja, biarkan frontend fetch per-slide
return Response.json({ slidesFolderPath, slideCount: 6 });
// Frontend: <img src={`/api/listing/slide-preview?path=${encodeURIComponent(path)}`} />
```

---

## Pola API

### Konvensi Route

```
GET    /api/catalog              → list semua game
GET    /api/catalog/pipeline     → list dengan pipeline status
GET    /api/catalog/[id]         → satu game
PATCH  /api/catalog/[id]/status  → update pipeline status
POST   /api/catalog/[id]/mark-listed → tandai sudah di-listing Shopee
```

### Error Response yang Konsisten

Semua API harus return error dalam format yang sama:

```js
// ✅ Format standar
return Response.json(
  { success: false, error: 'Pesan error yang bisa dibaca user', code: 'ERROR_CODE' },
  { status: 400 }
);

// ✅ Format sukses
return Response.json({ success: true, data: result });
```

### Next.js Async Params (Penting!)

Di Next.js App Router versi terbaru, `params` di route handler bersifat async:

```js
// ✅ Benar
export async function GET(request, { params }) {
  const { id } = await Promise.resolve(params); // atau: await params
  // ...
}

// ❌ Salah di versi terbaru — akan throw warning/error
export async function GET(request, { params }) {
  const { id } = params; // synchronous access
}
```

---

## Pola Polling

Ketiga halaman utama (Download Hub, Studio, Listing Studio) menggunakan polling untuk status real-time. **Gunakan pola yang sama di semua tempat:**

```js
// ✅ Pola yang benar: recursive setTimeout + circuit breaker
const pollRef = useRef(null);
const errorCountRef = useRef(0);
const MAX_ERRORS = 5;

const scheduleNext = useCallback((delay) => {
  if (pollRef.current) clearTimeout(pollRef.current);
  pollRef.current = setTimeout(fetchStatus, delay);
}, [fetchStatus]);

const fetchStatus = useCallback(async () => {
  try {
    const data = await fetch('/api/...').then(r => r.json());
    errorCountRef.current = 0; // reset on success
    setData(data);
    // Adaptive interval: lebih cepat jika ada proses aktif
    scheduleNext(data.hasActiveItems ? 1500 : 6000);
  } catch (err) {
    errorCountRef.current++;
    if (errorCountRef.current >= MAX_ERRORS) {
      setServerUnreachable(true); // tampilkan badge error
      return; // stop polling
    }
    scheduleNext(3000); // retry lebih cepat saat error
  }
}, [scheduleNext]);

useEffect(() => {
  fetchStatus();
  return () => { if (pollRef.current) clearTimeout(pollRef.current); };
}, []); // hanya mount/unmount

// ❌ Pola yang salah — jangan pakai:
// setInterval (susah di-cleanup, tidak adaptive)
// useEffect dengan dependency yang sering berubah (race condition)
```

---

## Pola External API Calls

### Steam API

Selalu gunakan AbortController dengan timeout 15 detik:

```js
const abortControllerRef = useRef(null);

const searchSteam = async (query) => {
  // Cancel request sebelumnya
  if (abortControllerRef.current) abortControllerRef.current.abort();
  
  const controller = new AbortController();
  abortControllerRef.current = controller;
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const res = await fetch(steamUrl, { signal: controller.signal });
    clearTimeout(timeout);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') return null; // timeout atau cancelled
    throw err;
  }
};
```

### Python Subprocess

Selalu detect binary Python dulu, return error user-friendly jika tidak ada:

```js
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function detectPythonBinary() {
  for (const bin of ['python', 'python3', 'py']) {
    try {
      await execFileAsync(bin, ['--version']);
      return bin;
    } catch {}
  }
  return null;
}

// Di handler:
const pythonBin = await detectPythonBinary();
if (!pythonBin) {
  return Response.json({
    success: false,
    error: 'Python tidak ditemukan. Pastikan Python 3.x ter-install dan ada di PATH sistem.'
  }, { status: 400 });
}
```

---

## Pola State Management UI

### Untuk loading states yang banyak: gunakan `useReducer`

```js
// ❌ Salah — 10+ useState terpisah, mudah lupa cleanup di finally
const [handoffLoading, setHandoffLoading] = useState(false);
const [deleteLoading, setDeleteLoading] = useState(false);
// ... 8 lagi

// ✅ Benar — satu reducer, semua terlacak
const initialActionState = { handoff: false, delete: false, extract: false };

function actionReducer(state, action) {
  switch (action.type) {
    case 'START': return { ...state, [action.key]: true };
    case 'END':   return { ...state, [action.key]: false };
    default: return state;
  }
}

const [actionState, dispatchAction] = useReducer(actionReducer, initialActionState);
// Pakai: dispatchAction({ type: 'START', key: 'handoff' })
// Cleanup di finally: dispatchAction({ type: 'END', key: 'handoff' })
```

---

## Pola File Path & Environment

### Output path harus dari environment, bukan hardcoded

```js
// ❌ Salah — path hardcoded ke drive D
const OUTPUT_BASE = 'D:\\Shopee\\3-listing_output';

// ✅ Benar — dari env variable dengan fallback ke relative path
const OUTPUT_BASE = process.env.LISTING_OUTPUT_DIR 
  || path.join(process.cwd(), 'listing_output');
```

---

## Checklist Sebelum Submit Logic Code

- [ ] Apakah model AI sudah `process.env.GEMINI_MODEL || 'gemini-3.6-flash'`?
- [ ] Apakah update `pipelineStatus` dilakukan via `PATCH /api/catalog/[id]/status`?
- [ ] Apakah API response menggunakan format `{ success, data/error }` yang konsisten?
- [ ] Apakah `params` di route handler sudah di-await?
- [ ] Apakah polling menggunakan pola recursive setTimeout + circuit breaker?
- [ ] Apakah Steam API call sudah pakai AbortController + timeout 15 detik?
- [ ] Apakah Python subprocess sudah pakai `detectPythonBinary()` dengan error message yang jelas?
- [ ] Apakah tidak ada file path yang hardcoded ke drive tertentu (D:\\, C:\\)?
- [ ] Apakah slide/file besar di-return sebagai path, bukan base64?
