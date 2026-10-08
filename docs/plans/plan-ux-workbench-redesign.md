# Plan: CleanWorkbench UX Redesign + Size Bug Fix

## Context

Project: MyGameON Hub — Electron desktop app (Next.js 14+ App Router).
Working directory: `C:\mad\proyek\mygameon-hub`

This plan addresses two issues in the Upload Studio (Meja Kerja tab):
1. **Bug:** Folder size shown in the game list is wrong — shows RAR part size instead of actual folder size
2. **UX:** The workbench is too dense, requires too much scrolling before reaching the Upload button, and game status (ready to upload or not) is not immediately obvious

The primary redesign goal: **Upload is the main action — everything else is secondary context.**

Files to change:
- `components/studio/CleanWorkbench.jsx` (main UI redesign + all layout changes)
- `app/api/studio/scan/route.js` → function `scanLocalDirectory` (size bug fix)

Do NOT change:
- `app/(dashboard)/studio/page.js` (parent stays the same — CleanWorkbench's props contract is unchanged)
- Any API routes other than scan
- Logic inside `folderStatus` useMemo — the 4 conditions (RAW_ARCHIVE, PRE_INSTALLED, EXTRACTED_WITH_RAR, EMPTY_OR_JUNK) are correct and must be kept exactly as-is
- All handler functions (handleExtractRar, handleCleanAllRar, handleDeleteSingleFile, etc.) — keep all logic, only change where/how they're triggered in the UI

---

## Bug Fix 1 — Folder Size Calculation

**File:** `app/api/studio/scan/route.js`

**Root cause:** In `scanLocalDirectory`, PASS 2 (around line 195) merges archive files into existing folder entries, but incorrectly overwrites `formattedSize` with `stats.size` of just the first archive file:

```js
// WRONG — overwrites folder size with single archive file size:
matchedExisting.formattedSize = formatBytes(stats.size)
```

**Fix:** When merging an archive into an existing folder entry, keep the folder's actual size (already calculated in PASS 1). Only update `formattedSize` if the folder entry had no real size before.

Find the merge block in PASS 2 (inside the `if (matchedExisting)` branch) and change:

```js
// BEFORE (incorrect):
if (matchedExisting) {
  matchedExisting.hasArchive = true
  matchedExisting.archiveParts = partsCount
  matchedExisting.archivePath = fullPath
  matchedExisting.formattedSize = formatBytes(stats.size)  // ← BUG: overwrites folder size
}

// AFTER (correct):
if (matchedExisting) {
  matchedExisting.hasArchive = true
  matchedExisting.archiveParts = partsCount
  matchedExisting.archivePath = fullPath
  // Only use archive size as fallback if folder had no real size calculated in PASS 1
  if (!matchedExisting.size || matchedExisting.size === 0) {
    matchedExisting.size = stats.size
    matchedExisting.formattedSize = formatBytes(stats.size)
  }
  // Otherwise keep the folder size from PASS 1 — it reflects actual disk usage
}
```

**Also:** The local `formatBytes` in `scan/route.js` is a duplicate. Import it from `lib/utils.js` instead:

```js
// Remove local formatBytes function from scan/route.js
// Add import:
import { formatBytes } from '@/lib/utils'
```

---

## UX Redesign — CleanWorkbench Layout

### Design Principles for This Redesign

1. **Upload button is always visible** — never hidden below the fold
2. **Status is the first thing you see** per game — color-coded, unambiguous
3. **Progressive disclosure** — detail (file list) is collapsed by default, expand on demand
4. **One action at a time** — the primary action per status is the biggest button

### New Layout Structure

Replace the current `lg:grid-cols-12` two-column layout with this structure:

```
┌─────────────────────────────────────────────────────────────────┐
│  GAME LIST (horizontal scrollable chips OR compact vertical list)│
│  Each chip shows: Game name | Status badge | Size               │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  ACTIVE GAME PANEL (takes full width when game selected)        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Game name + Status badge + Size  │  [Open Explorer]      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  STATUS BANNER (color-coded, one line, clear action label)      │
│  [Primary action button — large, prominent]                     │
│                                                                  │
│  ── Upload Settings (collapsed accordion, expands on click) ──  │
│  Drive account | Game name | Mode | Part size                   │
│                                                                  │
│  ── File Detail (collapsed, expands on click) ──                │
│  File list table                                                 │
│                                                                  │
│  [Upload to Drive button] ← always visible at bottom           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Implementation

### Part A — Game List (Left Column → Top Strip)

**Current:** Left 4-column panel with vertical folder list, max-height scroll.

**New:** Keep it as a **left column (lg:col-span-4)** BUT make each folder card more compact and immediately informative. The status must be visible AT A GLANCE without clicking.

Replace the current folder card render (inside `filteredFolders.map(...)`) with:

```jsx
filteredFolders.map((f) => {
  const isSelected = activeFolder?.path === f.path || activeFolder?.name === f.name

  // Derive quick status from folder flags (pre-compute without folderStatus useMemo)
  const quickStatus = f.hasArchive && !f.hasExe && !f.hasExtractedSubfolder
    ? { label: 'Arsip Mentah', color: 'text-amber-400', dot: 'bg-amber-400' }
    : f.hasExe || (!f.hasArchive && f.size > 1000000)
    ? { label: 'Siap Upload', color: 'text-emerald-400', dot: 'bg-emerald-400' }
    : { label: 'Periksa', color: 'text-zinc-400', dot: 'bg-zinc-600' }

  return (
    <div
      key={f.path || f.name}
      onClick={() => (onSelectFolder ? onSelectFolder(f) : setSelectedFolder?.(f))}
      className={`p-3 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-amber-400/60 bg-amber-500/10 shadow-lg shadow-amber-500/5'
          : 'border-white/5 bg-black/20 hover:border-white/15 hover:bg-white/5'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status dot */}
          <span className={`shrink-0 h-2 w-2 rounded-full ${quickStatus.dot} ${
            isSelected ? 'shadow-[0_0_6px_currentColor]' : ''
          }`} />
          <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
            {cleanReleaseName(f.name)}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[10px] font-mono text-zinc-400 block">
            {f.formattedSize || formatBytes(f.size)}
          </span>
          <span className={`text-[9px] font-bold ${quickStatus.color} block`}>
            {quickStatus.label}
          </span>
        </div>
      </div>
    </div>
  )
})
```

### Part B — Active Game Panel (Right Column Redesign)

Replace the current right column (everything inside `{!activeFolder ? ... : ...}`) with the new layout below.

**Key structural changes:**
- Status banner is prominent and always at the top
- Upload settings are in a collapsible accordion (open by default, can close to save space)
- File list is collapsed by default with a toggle button
- Upload button is visually separated and always the last element before the file list toggle

**Add new state variables** at the top of CleanWorkbench (inside the component, with other state):

```js
const [showUploadSettings, setShowUploadSettings] = useState(true)
const [showFileList, setShowFileList] = useState(false) // collapsed by default
```

**Replace the right column content** with:

```jsx
{/* ── RIGHT COLUMN: ACTIVE GAME WORKBENCH ── */}
<div className="lg:col-span-8 flex flex-col gap-4">
  {!activeFolder ? (
    /* Empty State */
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-16 text-center flex flex-col items-center justify-center min-h-[400px] gap-3">
      <FolderOpen size={40} className="opacity-20 text-amber-400" />
      <p className="text-sm font-bold text-white">Pilih Game di Sebelah Kiri</p>
      <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
        Pilih folder game untuk melihat status dan langsung upload ke Google Drive.
      </p>
    </div>
  ) : (
    <>
      {/* ─── SECTION 1: GAME HEADER ─── */}
      <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4 flex items-center justify-between gap-3 shadow-xl">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-black text-white truncate">{cleanName}</h2>
            {folderStatus && (
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black border shrink-0 ${
                folderStatus.badgeColor === 'amber'   ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'   :
                folderStatus.badgeColor === 'emerald' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                folderStatus.badgeColor === 'teal'    ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'      :
                'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {folderStatus.badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              {activeFolder.formattedSize || formatBytes(activeFolder.size)}
            </span>
            <span className="text-[10px] text-zinc-500 truncate max-w-xs" title={activeFolder.path}>
              {activeFolder.path}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyPath}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Salin path"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={handleOpenExplorer}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Explorer</span>
          </button>
        </div>
      </div>

      {/* ─── SECTION 2: STATUS BANNER + PRIMARY ACTION ─── */}
      {folderStatus && (
        <div className={`rounded-2xl border p-4 ${
          folderStatus.type === 'RAW_ARCHIVE'       ? 'border-amber-500/30 bg-amber-950/20' :
          folderStatus.type === 'PRE_INSTALLED'     ? 'border-emerald-500/30 bg-emerald-950/20' :
          folderStatus.type === 'EXTRACTED_WITH_RAR'? 'border-teal-500/30 bg-teal-950/20' :
          'border-white/10 bg-black/40'
        }`}>
          {/* Status description */}
          <p className="text-xs text-zinc-300 leading-relaxed mb-3">
            {folderStatus.description}
          </p>

          {/* Primary action for current status */}
          <div className="flex flex-wrap gap-2">
            {folderStatus.type === 'RAW_ARCHIVE' && (
              <button
                type="button"
                onClick={handleExtractRar}
                disabled={actionBusy || isProcessing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-black text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <Zap size={14} fill="currentColor" />
                <span>⚡ Ekstrak Sekarang</span>
              </button>
            )}

            {folderStatus.type === 'EXTRACTED_WITH_RAR' && (
              <button
                type="button"
                onClick={() => setConfirmDelete({ type: 'rar' })}
                disabled={actionBusy || isProcessing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <Eraser size={13} />
                <span>Hapus RAR Sisa ({formatBytes(folderStatus.totalRarSize)})</span>
              </button>
            )}

            {folderStatus.type === 'EMPTY_OR_JUNK' && handleDeleteAll && (
              <button
                type="button"
                onClick={() => handleDeleteAll(activeFolder)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Hapus Sisa Folder</span>
              </button>
            )}

            {/* Bypass checkbox for RAW_ARCHIVE */}
            {folderStatus.type === 'RAW_ARCHIVE' && (
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-200 self-center">
                <input
                  type="checkbox"
                  checked={bypassRawExtract}
                  onChange={(e) => setBypassRawExtract(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <span>Lewati ekstraksi — upload arsip mentah langsung</span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* ─── LIVE PROGRESS (shows only when processing) ─── */}
      {isProcessing && (
        <div className="rounded-2xl border border-amber-500/30 bg-black/50 p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-amber-300 flex items-center gap-2 min-w-0">
              <Loader2 size={14} className="animate-spin shrink-0" />
              <span className="truncate">{processState.text}</span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-white">{processState.progress}%</span>
              {handleProcessControl && (
                <div className="flex items-center gap-1 ml-1">
                  {processState.status === 'processing' && (
                    <button onClick={() => handleProcessControl('pause')}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] text-amber-300 font-bold cursor-pointer">
                      Jeda
                    </button>
                  )}
                  {processState.status === 'paused' && (
                    <button onClick={() => handleProcessControl('resume')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] text-emerald-300 font-bold cursor-pointer">
                      Lanjut
                    </button>
                  )}
                  <button onClick={() => handleProcessControl('cancel')}
                    className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-[10px] text-red-400 font-bold cursor-pointer">
                    Batal
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-300"
              style={{ width: `${processState.progress}%` }} />
          </div>
        </div>
      )}

      {/* ─── SECTION 3: UPLOAD SETTINGS (collapsible accordion) ─── */}
      <div className="rounded-2xl border border-white/10 bg-[var(--surface)] shadow-xl overflow-hidden">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setShowUploadSettings(p => !p)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-xs font-black text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <CloudUpload size={15} className="text-emerald-400" />
            <span>Pengaturan Upload</span>
            {/* Show summary when collapsed */}
            {!showUploadSettings && targetWorkspace && (
              <span className="text-[10px] font-normal text-zinc-400">
                → {targetWorkspace.email} · {uploadMode === 'new' ? 'Game Baru' : 'Update'} · {rarConfig.splitSize > 0 ? `${rarConfig.splitSize}MB/part` : 'Satu file'}
              </span>
            )}
          </div>
          <ChevronDown size={14} className={`text-zinc-400 transition-transform ${showUploadSettings ? 'rotate-180' : ''}`} />
        </button>

        {/* Accordion Body */}
        {showUploadSettings && (
          <div className="px-5 pb-5 pt-0 border-t border-white/5 space-y-4">

            {/* Upload Mode Toggle */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs self-start mt-4">
              <button
                type="button"
                onClick={() => { if (setUploadMode) setUploadMode('new'); if (setSelectedGame) setSelectedGame(null) }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  uploadMode === 'new' ? 'bg-emerald-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                + Game Baru
              </button>
              <button
                type="button"
                onClick={() => { if (setUploadMode) setUploadMode('update') }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  uploadMode === 'update' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                🔄 Update Versi
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Drive Account */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1.5">
                  Akun Google Drive Tujuan:
                </label>
                <WorkspaceDrivePicker
                  workspaces={workspaces}
                  targetWorkspace={targetWorkspace}
                  setTargetWorkspace={setTargetWorkspace}
                />
              </div>

              {/* Game Name / Select */}
              {uploadMode === 'new' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 block">
                      Nama Folder di Drive:
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomCatalogTitle(cleanReleaseName(activeFolder.name))}
                      className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={10} /> Auto-Clean
                    </button>
                  </div>
                  <input
                    type="text"
                    value={customCatalogTitle}
                    onChange={(e) => setCustomCatalogTitle(e.target.value)}
                    placeholder="Nama folder game di Google Drive..."
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/40"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold text-amber-300 block mb-1.5">
                    Pilih Game yang Diperbarui:
                  </label>
                  <select
                    value={selectedGame?.folderId || ''}
                    onChange={(e) => {
                      const found = existingGames.find((g) => g.folderId === e.target.value)
                      if (found && setSelectedGame) {
                        setSelectedGame(found)
                        const primaryOwner = found.ownerEmail?.split(',')[0]?.trim()
                        const matchedWs = workspaces.find((w) => w.email === primaryOwner)
                        if (matchedWs) setTargetWorkspace(matchedWs)
                      }
                    }}
                    className="w-full rounded-xl border border-amber-500/30 bg-black/40 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">-- Pilih Game dari Katalog Drive --</option>
                    {existingGames.map((g) => (
                      <option key={g.folderId} value={g.folderId}>
                        {g.name} ({g.ownerEmail || 'Drive'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* RAR Part Size */}
              {folderStatus?.type !== 'EMPTY_OR_JUNK' && setRarConfig && (
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1.5">
                    Ukuran Part WinRAR:
                  </label>
                  <select
                    value={rarConfig.splitSize}
                    onChange={(e) => setRarConfig((prev) => ({ ...prev, splitSize: Number(e.target.value) }))}
                    className="w-full sm:w-auto rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  >
                    <option value={500}>500 MB (Rekomendasi Shopee)</option>
                    <option value={1000}>1 GB</option>
                    <option value={2000}>2 GB</option>
                    <option value={4100}>4.1 GB (DVD)</option>
                    <option value={0}>Tanpa Part (1 File Utuh)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── SECTION 4: UPLOAD BUTTONS (always visible, never below fold) ─── */}
      <div className="flex flex-col sm:flex-row items-stretch gap-3">
        {/* Primary Upload Button */}
        <button
          type="button"
          onClick={() => startProcessing && startProcessing('upload')}
          disabled={
            isProcessing ||
            !targetWorkspace ||
            (uploadMode === 'update' && !selectedGame) ||
            (folderStatus?.type === 'RAW_ARCHIVE' && !bypassRawExtract) ||
            folderStatus?.type === 'EMPTY_OR_JUNK'
          }
          className="flex-1 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 px-6 py-4 text-sm font-black text-black shadow-xl shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CloudUpload size={18} />
          <span>
            {folderStatus?.type === 'RAW_ARCHIVE' && !bypassRawExtract
              ? 'Ekstrak Dulu Sebelum Upload'
              : folderStatus?.type === 'RAW_ARCHIVE' && bypassRawExtract
              ? '🚀 Upload Arsip Mentah ke Drive'
              : '🚀 Arsipkan & Upload ke Google Drive'}
          </span>
        </button>

        {/* Secondary: Archive Only */}
        {(folderStatus?.type === 'PRE_INSTALLED' || folderStatus?.type === 'EXTRACTED_WITH_RAR') && (
          <button
            type="button"
            onClick={() => startProcessing && startProcessing('archive')}
            disabled={isProcessing}
            className="sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 px-4 py-4 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Pecah part WinRAR lokal tanpa upload"
          >
            <FileArchive size={14} />
            <span>Arsipkan Saja</span>
          </button>
        )}

        {/* Queue */}
        {(addToQueue || queueState?.addToQueue) && (
          <button
            type="button"
            onClick={addToQueue || queueState?.addToQueue}
            disabled={
              isProcessing || !targetWorkspace ||
              (uploadMode === 'update' && !selectedGame) ||
              (folderStatus?.type === 'RAW_ARCHIVE' && !bypassRawExtract) ||
              folderStatus?.type === 'EMPTY_OR_JUNK'
            }
            className="sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-4 py-4 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>+ Antrean</span>
          </button>
        )}
      </div>

      {/* ─── SECTION 5: FILE DETAIL (collapsible, collapsed by default) ─── */}
      <div className="rounded-2xl border border-white/10 bg-[var(--surface)] shadow-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFileList(p => !p)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-xs font-black text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-zinc-400" />
            <span>Detail Berkas</span>
            <span className="text-[10px] font-normal text-zinc-500">
              ({fileList.length} file{fileList.length !== 1 ? '' : ''})
            </span>
            {inspectLoading && <Loader2 size={11} className="animate-spin text-amber-400" />}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fetchFolderContent() }}
              disabled={inspectLoading}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh isi folder"
            >
              <RefreshCw size={11} className={inspectLoading ? 'animate-spin' : ''} />
            </button>
            <ChevronDown size={14} className={`text-zinc-400 transition-transform ${showFileList ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {showFileList && (
          <div className="border-t border-white/5 p-4 space-y-3">
            {/* Confirm delete dialog */}
            {confirmDelete && (
              <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-rose-300">
                  <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                  <span>
                    {confirmDelete.type === 'rar'
                      ? `Hapus seluruh file RAR mentah (${formatBytes(folderStatus?.totalRarSize || 0)})? Data game aman.`
                      : `Hapus berkas "${confirmDelete.file?.name}"?`}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setConfirmDelete(null)}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-zinc-300 cursor-pointer">
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDelete.type === 'rar') handleCleanAllRar()
                      else if (confirmDelete.type === 'single') handleDeleteSingleFile(confirmDelete.file)
                    }}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer">
                    Ya, Hapus
                  </button>
                </div>
              </div>
            )}

            {/* File list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-white/5 rounded-xl border border-white/10 bg-black/40 scrollbar-thin">
              {inspectLoading && !inspectData ? (
                <div className="py-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin text-amber-400" />
                  <span>Membaca berkas...</span>
                </div>
              ) : inspectError ? (
                <div className="p-4 text-center text-xs text-rose-300">{inspectError}</div>
              ) : fileList.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">Folder kosong</div>
              ) : (
                fileList.map((file, idx) => {
                  const isArchive = /\.(rar|7z|zip)$/i.test(file.name)
                  const isExe = file.category === 'executable' || file.category === 'setup'
                  const isIso = file.category === 'iso'
                  return (
                    <div key={file.fullPath || idx}
                      className="flex items-center justify-between px-3 py-2 text-xs hover:bg-white/5 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isArchive ? <FileArchive size={13} className="text-amber-400 shrink-0" />
                          : isExe ? <FileCode size={13} className="text-emerald-400 shrink-0" />
                          : isIso ? <Disc size={13} className="text-cyan-400 shrink-0" />
                          : <FileText size={13} className="text-zinc-500 shrink-0" />}
                        <span className="font-mono text-zinc-300 truncate">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-zinc-400">{file.sizeFormatted}</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ type: 'single', file })}
                          disabled={actionBusy || isProcessing}
                          className="p-1 rounded hover:bg-rose-500/20 text-zinc-600 hover:text-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )}
</div>
```

### Part C — Add Missing Import

Add `ChevronDown` to the lucide-react import at the top of `CleanWorkbench.jsx`:

```js
import {
  Folder, FolderOpen, RefreshCw, Search, CloudUpload, Zap,
  Trash2, Eraser, Check, Copy, ExternalLink, Loader2, Sparkles,
  AlertTriangle, FileArchive, FileText, FileCode, Disc, CheckCircle2,
  ChevronDown   // ← ADD THIS
} from 'lucide-react'
```

---

## Summary of Changes

| What changes | Why |
|---|---|
| Folder card shows color-coded status dot | Immediate visual read of each game's state |
| Status banner shows description, not just badge | Clear instruction: what to do next |
| Prep actions (extract/clean) are inline in status banner | No separate "Tahap 1" section needed |
| Upload settings in collapsible accordion | Out of the way by default, accessible when needed |
| File list collapsed by default | Reduces noise; available on demand |
| **Upload button is always the last prominent element** | Never hidden below fold |
| Upload button is larger (py-4, text-sm) | Primary action deserves primary visual weight |
| RAR merge in `scanLocalDirectory` preserves folder size | Shows real game size, not archive part size |
| `formatBytes` imported from utils in scan/route.js | Remove 5th duplicate |

## What Does NOT Change

- `folderStatus` useMemo logic — all 4 conditions remain identical
- All handler functions (handleExtractRar, handleCleanAllRar, etc.)
- Props contract — parent `studio/page.js` unchanged
- WorkspaceDrivePicker component — used as-is
- Upload mode toggle logic (new vs update)
- Bypass checkbox for RAW_ARCHIVE
- Queue button logic

## Verification Checklist

- [ ] Selecting a folder with a RAR file shows the correct folder size (not just the RAR part size)
- [ ] Selecting a game in the list immediately shows status badge: amber = Arsip Mentah, green = Siap Upload
- [ ] The Upload button is visible without scrolling after selecting a game
- [ ] Upload Settings accordion is open by default; can be collapsed; collapsed state shows summary (drive account, mode, part size)
- [ ] File Detail section is collapsed by default; clicking expands it with the file list
- [ ] Clicking "Arsip Mentah" game shows the Extract button prominently before the Upload button
- [ ] `npm run build` passes
