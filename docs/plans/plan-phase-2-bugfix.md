# Phase 2 — Bug Fixes: Stabilisasi Modul Kritis

## Prerequisites

Phase 1 must be completed before this phase (Toast component and utils must exist).

## Context

Project: MyGameON Hub — Electron desktop app (Next.js 14+ App Router).
Working directory: `C:\mad\proyek\mygameon-hub`

This phase fixes critical bugs across 3 modules without changing feature scope.
All fixes are self-contained per task.

---

## Task 2.1 — Fix Polling Race Condition (Download Hub)

**File:** `app/(dashboard)/download/page.jsx`

**Problem:** The `useEffect` that sets up polling captures `data` from the render cycle when the effect runs. When `hasActive` condition changes (downloads start/finish), the interval keeps the old `pollInterval` value until `useEffect` re-runs on the next render. This means the adaptive speed switch (1500ms ↔ 6000ms) is delayed by one render cycle and can be missed entirely.

**Fix:** Use `useRef` to hold the interval, recalculate `pollInterval` inside the interval callback itself based on latest state via a ref.

Replace the current `useEffect` that sets up polling (the one containing `setInterval(fetchStatus...)`) with:

```js
// Ref to hold latest data for use inside interval without re-creating it
const dataRef = useRef(data)
useEffect(() => {
  dataRef.current = data
}, [data])

// Initial fetch on mount
useEffect(() => {
  fetchStatus()
}, [fetchStatus])

// Adaptive polling — separate effect, stable interval that self-adjusts cadence
useEffect(() => {
  const intervalRef = { id: null }

  function scheduleNext() {
    const d = dataRef.current
    const hasActive =
      (d.activeItems && d.activeItems.length > 0) ||
      (d.activeExtractions && d.activeExtractions.length > 0) ||
      (d.stagedPackages && d.stagedPackages.length > 0)
    const delay = hasActive ? 1500 : 6000

    intervalRef.id = setTimeout(async () => {
      await fetchStatus(true)
      scheduleNext() // reschedule after fetch completes
    }, delay)
  }

  scheduleNext()

  return () => {
    if (intervalRef.id) clearTimeout(intervalRef.id)
  }
}, [fetchStatus]) // fetchStatus is stable (useCallback with [])
```

**Note:** This replaces `setInterval` with a recursive `setTimeout` pattern — this is intentional. It means the next poll starts AFTER the previous fetch completes, preventing overlapping requests.

---

## Task 2.2 — Error Circuit Breaker for Polling (Download Hub + Studio)

**File:** `app/(dashboard)/download/page.jsx`

**Problem:** If the local server is unreachable, polling runs forever silently.

In the `fetchStatus` callback, add a consecutive error counter:

```js
// Add this ref near the top of the component (with other refs/state):
const pollErrorCount = useRef(0)
const [serverUnreachable, setServerUnreachable] = useState(false)

// In fetchStatus useCallback, modify the catch block:
} catch (err) {
  console.error('Gagal mengambil status download:', err)
  pollErrorCount.current += 1
  if (pollErrorCount.current >= 5) {
    setServerUnreachable(true)
  }
} finally {
  // reset error counter on success:
  // (add this in the try block after successful data set)
  // pollErrorCount.current = 0
  // setServerUnreachable(false)
}
```

Inside the `try` block, after `setData(json.data)`, add:
```js
pollErrorCount.current = 0
setServerUnreachable(false)
```

**Add UI banner** — insert this just after the `{notification && ...}` floating toast block:

```jsx
{serverUnreachable && (
  <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-xs font-bold text-amber-400 flex items-center gap-3">
    <AlertTriangle size={16} className="shrink-0" />
    <span>Server tidak merespons. Pastikan aplikasi MyGameON berjalan, lalu klik</span>
    <button
      onClick={() => {
        pollErrorCount.current = 0
        setServerUnreachable(false)
        fetchStatus()
      }}
      className="underline hover:no-underline cursor-pointer"
    >
      Coba Lagi
    </button>
  </div>
)}
```

**Apply the same pattern** to `app/(dashboard)/studio/page.js` — find its `checkStatus()` function and apply the same error counter + banner pattern. The banner placement should be after the TopBar component.

---

## Task 2.3 — Steam API Timeout & AbortController (Listing Studio)

**File:** `app/(dashboard)/scout/page.js`

**Problem:** `handleSearch` calls Steam API with no timeout. If Steam is slow or down, the spinner runs indefinitely with no way to cancel.

Replace the `handleSearch` function body with this version:

```js
async function handleSearch(e) {
  if (e) e.preventDefault()
  if (!query.trim()) return

  setSearchState({ status: 'searching', data: null, error: null })
  setGenerateState({ status: 'idle', result: null, error: null })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

  try {
    const res = await fetch(
      `/api/listing/search?query=${encodeURIComponent(query.trim())}`,
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const json = await res.json()

    if (json.success && json.data) {
      setSearchState({ status: 'success', data: json.data, error: null })
      setTitle(json.data.title || '')
      setSeoTitle(json.data.seoTitle || '')
      setDescription(json.data.description || '')
      setCoverUrl(json.data.coverUrl || '')
      setScreenshots(json.data.screenshots || [])
    } else {
      setSearchState({ status: 'error', data: null, error: json.error || 'Game tidak ditemukan' })
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      setSearchState({
        status: 'error',
        data: null,
        error: 'Pencarian timeout (>15 detik). Steam API mungkin sedang lambat. Coba lagi atau gunakan Steam AppID langsung.'
      })
    } else {
      setSearchState({ status: 'error', data: null, error: err.message || 'Gagal menghubungi server' })
    }
  }
}
```

Also add a **Cancel button** to the search bar — visible only when `status === 'searching'`. Add it alongside the existing search submit button:

```jsx
{searchState.status === 'searching' && (
  <button
    type="button"
    onClick={() => { /* We need to store controller in a ref to cancel */ }}
    className="absolute right-28 top-2 bottom-2 px-3 rounded-xl text-xs font-bold text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-all"
  >
    Batalkan
  </button>
)}
```

To make the cancel button work, store the AbortController in a `useRef`:

```js
const searchAbortRef = useRef(null)
```

In `handleSearch`, before creating the controller:
```js
if (searchAbortRef.current) searchAbortRef.current.abort() // cancel any previous
const controller = new AbortController()
searchAbortRef.current = controller
```

Update the cancel button's onClick:
```jsx
onClick={() => {
  if (searchAbortRef.current) searchAbortRef.current.abort()
  setSearchState({ status: 'idle', data: null, error: null })
}}
```

---

## Task 2.4 — Python Detection & User-Friendly Error (Listing Generate API)

**File:** `app/api/listing/generate/route.js`

**Problem:** If Python is not installed or not in PATH, the API crashes with a raw system error. User sees an incomprehensible message.

**Step A:** Add Python detection helper before the `POST` handler:

```js
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

// Try both 'python' and 'python3' binary names (Windows vs Unix)
async function detectPythonBinary() {
  for (const bin of ['python', 'python3']) {
    try {
      const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 5000 })
      if (stdout.toLowerCase().includes('python 3') || stdout.toLowerCase().includes('python 3')) {
        return bin
      }
    } catch (_) {
      // try next
    }
  }
  return null
}
```

**Step B:** At the start of the `POST` handler, before any file operations, add:

```js
// Detect Python before doing anything
const pythonBin = await detectPythonBinary()
if (!pythonBin) {
  return NextResponse.json({
    success: false,
    error: 'Python 3 tidak ditemukan di sistem ini. Pastikan Python 3 sudah terinstall dan terdaftar di PATH. Download: https://www.python.org/downloads/'
  }, { status: 503 })
}
```

**Step C:** Replace the hardcoded `'python'` in `execFileAsync` call with `pythonBin`:

```js
// Change:
const { stdout, stderr } = await execFileAsync('python', [scriptPath, configPath])
// To:
const { stdout, stderr } = await execFileAsync(pythonBin, [scriptPath, configPath])
```

---

## Task 2.5 — Fix Slide Response: Replace Base64 with File Paths

**Problem:** `app/api/listing/generate/route.js` reads all 6 generated slides as base64 and returns them in a single JSON response. Each slide can be 1-3 MB → response can be 18MB+ loaded into memory at once.

**Step A:** In `app/api/listing/generate/route.js`, replace the slide reading loop:

```js
// REMOVE this block that reads base64:
const fileBuffer = fs.readFileSync(filePath)
const base64 = fileBuffer.toString('base64')
slides.push({
  ...
  dataUrl: `data:image/jpeg;base64,${base64}`
})

// REPLACE with path-only response:
slides.push({
  id: def.id,
  title: def.title,
  fileName: def.fileName,
  filePath,           // absolute local path
  // NO dataUrl — frontend will load via dedicated endpoint
})
```

**Step B:** Create a slide preview API endpoint:

**Create file:** `app/api/listing/slide-preview/route.js`

```js
import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/listing/slide-preview?path=/absolute/path/to/SLIDE_1_THUMBNAIL.jpg
 * Returns the image file directly. Auth required.
 * Security: only allows reads from configured output base directory.
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return new Response('Missing path parameter', { status: 400 })
    }

    // Security: normalize and validate the path stays within allowed dirs
    const normalizedPath = path.normalize(filePath)
    const allowedBases = [
      'D:\\Shopee',
      path.join(process.cwd(), 'listing_output')
    ]
    const isAllowed = allowedBases.some(base => normalizedPath.startsWith(base))

    if (!isAllowed) {
      return new Response('Path not allowed', { status: 403 })
    }

    if (!fs.existsSync(normalizedPath)) {
      return new Response('File not found', { status: 404 })
    }

    const fileBuffer = fs.readFileSync(normalizedPath)
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=3600'
      }
    })
  } catch (err) {
    return new Response('Server error: ' + err.message, { status: 500 })
  }
}
```

**Step C:** Update `app/(dashboard)/scout/page.js` to display slides using the new endpoint.

In the slide gallery section, replace:
```jsx
// REMOVE:
<img src={slide.dataUrl} alt={slide.title} ... />

// REPLACE WITH:
<img
  src={`/api/listing/slide-preview?path=${encodeURIComponent(slide.filePath)}`}
  alt={slide.title}
  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
  loading="lazy"
/>
```

Also remove `dataUrl` from any state that holds slide data.

---

## Verification Checklist

After completing all tasks in this phase:

- [ ] Download Hub: polling switches between 1500ms and 6000ms correctly when downloads start/finish
- [ ] Download Hub: after 5 failed fetches, "Server tidak merespons" banner appears
- [ ] Download Hub: banner disappears and polling resumes after clicking "Coba Lagi"
- [ ] Listing Studio: searching with a valid game title works and shows results
- [ ] Listing Studio: if Steam API takes >15s, shows timeout error message (test by temporarily adding `await new Promise(r => setTimeout(r, 20000))` in the API handler)
- [ ] Listing Studio: cancel button stops the search
- [ ] Listing Studio: if Python is not in PATH, generate returns a clear error message (test by temporarily renaming the python binary)
- [ ] Listing Studio: after generate, slides display correctly via `/api/listing/slide-preview`
- [ ] JSON response from generate is now small (< 5KB, no base64)
- [ ] Studio page: error banner appears after 5 failed status checks
- [ ] `npm run build` passes

---

## Files Changed in This Phase

| File | Action |
|------|--------|
| `app/(dashboard)/download/page.jsx` | Modified — adaptive polling via setTimeout recursion, error circuit breaker |
| `app/(dashboard)/studio/page.js` | Modified — error circuit breaker for status polling |
| `app/(dashboard)/scout/page.js` | Modified — AbortController + timeout for search, load slides via endpoint |
| `app/api/listing/generate/route.js` | Modified — Python detection, remove base64 from response |
| `app/api/listing/slide-preview/route.js` | Created |
