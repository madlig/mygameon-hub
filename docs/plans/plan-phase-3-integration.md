# Phase 3 — Integration: Sambungkan Pipeline Antar Modul

## Prerequisites

Phase 1 AND Phase 2 must be completed before this phase.
Specifically requires:
- `PATCH /api/catalog/[id]/status` endpoint (from Phase 1.2)
- `GET /api/catalog/pipeline` endpoint (from Phase 1.3)
- `GameCatalog` schema with pipeline fields (from Phase 1.1)
- Toast component `useToast()` available (from Phase 1.5)

## Context

Project: MyGameON Hub — Electron desktop app (Next.js 14+ App Router).
Working directory: `C:\mad\proyek\mygameon-hub`

This phase wires the three modules together so that:
1. After Studio finishes uploading → GameCatalog is auto-updated
2. Listing Studio can see which games still need to be listed
3. After marking a game as listed → GameCatalog is updated with shopeeUrl
4. Dashboard shows a quick-access panel for unlisted games

All changes are additive — existing functionality is not removed.

---

## Task 3.1 — Studio: Auto-Update Catalog After Upload Completes

**File:** `app/(dashboard)/studio/page.js`

**What to do:** After a successful upload, call `PATCH /api/catalog/[id]/status` to update the game's pipeline status to `on_drive`.

**Where:** Find the section in `StudioPage` that handles upload completion. Look for where `processState.status === 'done'` is detected or where the "Upload selesai" state is set after polling `checkStatus()`. This is typically in the `checkStatus` polling function or in a `useEffect` that watches `processState.status`.

**Add this function near the other API call functions:**

```js
async function updateCatalogAfterUpload(catalogId, workspaceEmail, mode) {
  if (!catalogId) return // no catalog ID = not yet synced, skip silently
  try {
    await fetch(`/api/catalog/${catalogId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipelineStatus: 'on_drive',
        lastUploadedAt: new Date().toISOString(),
        uploadMode: mode || 'new',
        driveWorkspaceEmail: workspaceEmail || ''
      })
    })
  } catch (err) {
    console.warn('[Studio] Gagal update catalog status setelah upload:', err.message)
    // Non-fatal: upload already succeeded, catalog update is best-effort
  }
}
```

**Call it** in the place where upload is confirmed done. The `processState` object likely has a `catalogId` or `gameId` — check what's available. If not, look at what `startProcess()` sends to the API and what comes back. The upload result from `/api/studio/process` likely returns the catalog entry.

**Pattern to follow:** In the `checkStatus` polling function, when `data.status === 'done'`:

```js
if (data.status === 'done' && processState.status !== 'done') {
  setProcessState({ ...data })
  // NEW: update catalog
  await updateCatalogAfterUpload(
    processState.catalogId || data.catalogId,
    targetWorkspace?.email,
    uploadMode
  )
}
```

**Also update:** The `startProcess` API call payload. When sending to `/api/studio/process`, ensure the catalog `_id` is included in the response so it can be used in `updateCatalogAfterUpload`. Check `app/api/studio/process/route.js` — if it creates or finds a `GameCatalog` entry, return its `_id` in the response and store it in component state.

---

## Task 3.2 — Listing Studio: Filter Panel "Game Belum Di-Listing"

**File:** `app/(dashboard)/scout/page.js`

**What to add:** A panel on the left side (or top, if mobile) showing games from Catalog that are on Google Drive but haven't been listed yet. Clicking one pre-fills the search.

**Add state:**

```js
const [catalogGames, setCatalogGames] = useState([])
const [catalogLoading, setCatalogLoading] = useState(false)
const [showCatalogPanel, setShowCatalogPanel] = useState(true)
```

**Add fetch function:**

```js
async function fetchUnlistedGames() {
  setCatalogLoading(true)
  try {
    const res = await fetch('/api/catalog/pipeline?shopeeListed=false&status=on_drive,listing_ready&limit=50')
    const json = await res.json()
    if (json.success) {
      setCatalogGames(json.data)
    }
  } catch (err) {
    console.error('Gagal memuat daftar game dari catalog:', err)
  } finally {
    setCatalogLoading(false)
  }
}

// Fetch on mount
useEffect(() => {
  fetchUnlistedGames()
}, [])
```

**UI: Add a collapsible left panel** before the search bar. Insert this block after `<TopBar>` and before the header hero section:

```jsx
{/* Panel Game Belum Di-Listing */}
<div className="mb-6 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden">
  <button
    onClick={() => setShowCatalogPanel(p => !p)}
    className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-[var(--text-2)] hover:bg-white/5 transition-colors cursor-pointer"
  >
    <div className="flex items-center gap-2">
      <HardDrive size={14} className="text-[var(--primary)]" />
      <span>Game di GDrive — Belum Di-Listing</span>
      {catalogGames.length > 0 && (
        <span className="rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
          {catalogGames.length} game
        </span>
      )}
    </div>
    <ChevronDown size={14} className={`transition-transform ${showCatalogPanel ? 'rotate-180' : ''}`} />
  </button>

  {showCatalogPanel && (
    <div className="border-t border-[var(--border-soft)] p-4">
      {catalogLoading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--text-4)]">
          <Loader2 size={14} className="animate-spin" />
          <span>Memuat dari catalog...</span>
        </div>
      ) : catalogGames.length === 0 ? (
        <p className="text-xs text-[var(--text-4)] text-center py-2">
          Semua game di GDrive sudah di-listing 🎉
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {catalogGames.map(game => (
            <button
              key={game._id}
              onClick={() => {
                setQuery(game.cleanTitle || game.name)
                // Auto-trigger search
                handleSearch(null, game.cleanTitle || game.name)
                // Store catalog ID for later use when marking as listed
                setActiveCatalogGame(game)
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-2 text-xs font-medium text-[var(--text-2)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all cursor-pointer text-left"
            >
              {game.coverImageUrl && (
                <img src={game.coverImageUrl} alt="" className="w-6 h-8 object-cover rounded shrink-0" />
              )}
              <span className="truncate max-w-[160px]">{game.cleanTitle || game.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )}
</div>
```

**Add state for active catalog game** (needed for Task 3.3):

```js
const [activeCatalogGame, setActiveCatalogGame] = useState(null) // the catalog entry being worked on
```

**Update `handleSearch`** to accept an optional `overrideQuery` parameter (so the panel buttons can trigger it):

```js
async function handleSearch(e, overrideQuery = null) {
  if (e) e.preventDefault()
  const searchQuery = overrideQuery || query
  if (!searchQuery.trim()) return
  // ... rest of function uses `searchQuery` instead of `query.trim()`
}
```

**Add required imports** at top of file (if not already present):
```js
import { HardDrive, ChevronDown } from 'lucide-react' // add to existing import
import { useEffect } from 'react' // already there
```

---

## Task 3.3 — Listing Studio: "Tandai Sudah Di-Listing" Button

**File:** `app/(dashboard)/scout/page.js`

**What to add:** After slides are generated successfully, show a button that lets the user confirm the game is live on Shopee and optionally enter the Shopee product URL. This updates `GameCatalog`.

**Add state:**

```js
const [markListedState, setMarkListedState] = useState({ status: 'idle', shopeeUrl: '' })
```

**Add function:**

```js
async function handleMarkListed() {
  if (!activeCatalogGame?._id) {
    // No catalog game selected — show message
    // (user may have searched manually without selecting from panel)
    alert('Pilih game dari panel "Belum Di-Listing" terlebih dahulu, atau cari game yang sudah ada di katalog.')
    return
  }

  setMarkListedState(prev => ({ ...prev, status: 'saving' }))
  try {
    const res = await fetch(`/api/catalog/${activeCatalogGame._id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopeeListed: true,
        shopeeListedAt: new Date().toISOString(),
        shopeeUrl: markListedState.shopeeUrl || '',
        pipelineStatus: 'listed',
        listingAssets: {
          seoTitle,
          description,
          slidesFolderPath: generateState.result?.targetDir || '',
          generatedAt: new Date().toISOString()
        }
      })
    })
    const json = await res.json()
    if (json.success) {
      setMarkListedState({ status: 'done', shopeeUrl: markListedState.shopeeUrl })
      // Refresh unlisted games panel
      fetchUnlistedGames()
    } else {
      setMarkListedState(prev => ({ ...prev, status: 'error' }))
      alert('Gagal menyimpan status: ' + (json.error || 'Unknown error'))
    }
  } catch (err) {
    setMarkListedState(prev => ({ ...prev, status: 'error' }))
    alert('Gagal menghubungi server: ' + err.message)
  }
}
```

**Add UI** inside the `generateState.status === 'success'` success section, after the "6 Slides Visual Gallery" block:

```jsx
{/* Mark as Listed Section */}
<div className="mt-6 pt-5 border-t border-white/10">
  {markListedState.status === 'done' ? (
    <div className="flex items-center gap-3 rounded-2xl bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400 font-bold">
      <CheckCircle2 size={18} />
      <span>✅ Game berhasil ditandai sebagai Live di Shopee!</span>
    </div>
  ) : (
    <div className="space-y-3">
      <p className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">
        Setelah upload ke Shopee selesai:
      </p>
      <div className="flex gap-3">
        <input
          type="url"
          value={markListedState.shopeeUrl}
          onChange={(e) => setMarkListedState(prev => ({ ...prev, shopeeUrl: e.target.value }))}
          placeholder="https://shopee.co.id/produk... (opsional)"
          className="flex-1 bg-[var(--background)] border border-[var(--border-soft)] rounded-xl py-2.5 px-3.5 text-xs text-[var(--text)] outline-none focus:border-[var(--primary)]"
        />
        <button
          onClick={handleMarkListed}
          disabled={markListedState.status === 'saving' || !activeCatalogGame}
          className="flex items-center gap-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 font-bold px-4 py-2.5 text-xs transition-all disabled:opacity-50 cursor-pointer"
          title={!activeCatalogGame ? 'Pilih game dari panel catalog terlebih dahulu' : ''}
        >
          {markListedState.status === 'saving' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          <span>Tandai Sudah Live di Shopee</span>
        </button>
      </div>
      {!activeCatalogGame && (
        <p className="text-[10px] text-amber-400">
          ⚠️ Pilih game dari panel di atas agar status bisa disimpan ke katalog
        </p>
      )}
    </div>
  )}
</div>
```

**Reset `markListedState`** in `handleReset`:
```js
setMarkListedState({ status: 'idle', shopeeUrl: '' })
setActiveCatalogGame(null)
```

---

## Task 3.4 — Dashboard: Panel "Game Siap Di-Listing"

**File:** `app/(dashboard)/page.js`

**What to add:** A small section on the dashboard showing games that are on GDrive but not yet listed, with a direct link to Listing Studio pre-filled.

**Note:** This is a Server Component. Fetch the data server-side inside `getDashboardStats()`.

**Add to `getDashboardStats()`** function, after the existing insights/queries:

```js
// 5. Games on Drive but not yet listed (for listing reminder)
const gamesNeedingListing = await GameCatalog.find({
  pipelineStatus: { $in: ['on_drive', 'listing_ready'] },
  shopeeListed: false
})
  .select('name cleanTitle coverImageUrl steamAppId folderId')
  .sort({ updatedAt: -1 })
  .limit(5)
  .lean()
```

**Add to return object:**
```js
return {
  // ... existing fields ...
  gamesNeedingListing
}
```

**Add import** at top of file:
```js
import GameCatalog from '@/models/GameCatalog'
```

**Add UI section** in the dashboard page return, after the "Quick Actions" app grid section:

```jsx
{/* Games Needing Listing */}
{stats.gamesNeedingListing && stats.gamesNeedingListing.length > 0 && (
  <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <ShoppingBag size={16} className="text-amber-400" />
        <h3 className="text-sm font-bold text-[var(--text)]">
          {stats.gamesNeedingListing.length} Game Siap Di-Listing
        </h3>
        <span className="text-[10px] text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
          Menunggu Listing Shopee
        </span>
      </div>
      <Link
        href="/scout"
        className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
      >
        Buka Listing Studio <ArrowRight size={12} />
      </Link>
    </div>

    <div className="flex flex-wrap gap-2">
      {stats.gamesNeedingListing.map(game => (
        <Link
          key={game._id.toString()}
          href={`/scout?prefill=${encodeURIComponent(game.cleanTitle || game.name)}`}
          className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-950/20 hover:bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-200 hover:text-white transition-all"
        >
          {game.coverImageUrl && (
            <img src={game.coverImageUrl} alt="" className="w-5 h-7 object-cover rounded shrink-0" />
          )}
          <span className="truncate max-w-[140px]">{game.cleanTitle || game.name}</span>
        </Link>
      ))}
    </div>
  </div>
)}
```

**Add `ShoppingBag` and `ArrowRight` to the imports** at the top of `page.js` (they may already be imported).

**Handle `prefill` query param in Scout page** (`app/(dashboard)/scout/page.js`):

```js
// Add at the top of ShopeeListingStudio component, after state declarations:
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const prefill = params.get('prefill')
  if (prefill) {
    setQuery(decodeURIComponent(prefill))
    // Auto-trigger search after a short delay to let component mount
    setTimeout(() => handleSearch(null, decodeURIComponent(prefill)), 100)
  }
}, []) // intentionally empty deps — run once on mount
```

---

## Verification Checklist

After completing all tasks in this phase:

- [ ] After a successful upload in Studio, check MongoDB: the game's `GameCatalog` entry should have `pipelineStatus: 'on_drive'` and `lastUploadedAt` set
- [ ] Listing Studio: the "Game Belum Di-Listing" panel shows games that have `pipelineStatus: 'on_drive'` and `shopeeListed: false`
- [ ] Clicking a game in the panel pre-fills the search and triggers search automatically
- [ ] After generating slides, the "Tandai Sudah Live di Shopee" button is visible
- [ ] Clicking it (with a catalog game selected) updates `shopeeListed: true` in MongoDB
- [ ] After marking listed, the game disappears from the "Belum Di-Listing" panel
- [ ] Dashboard shows the "Game Siap Di-Listing" section when there are unlisted games
- [ ] Clicking a game chip in dashboard opens Listing Studio with search pre-filled
- [ ] `npm run build` passes

---

## Files Changed in This Phase

| File | Action |
|------|--------|
| `app/(dashboard)/studio/page.js` | Modified — call catalog status update after upload |
| `app/api/studio/process/route.js` | Possibly modified — ensure catalog `_id` is in response |
| `app/(dashboard)/scout/page.js` | Modified — unlisted panel, mark listed button, prefill support |
| `app/(dashboard)/page.js` | Modified — fetch + display unlisted games panel |
| `models/GameCatalog.js` | No change (done in Phase 1) |
| `app/api/catalog/[id]/status/route.js` | No change (done in Phase 1) |
| `app/api/catalog/pipeline/route.js` | No change (done in Phase 1) |
