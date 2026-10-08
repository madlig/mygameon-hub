# Phase 4 — Refactor & Polish

## Prerequisites

Phases 1, 2, and 3 must be completed.
This phase improves code quality and UX without adding new features.
Each task is independent — they can be done in any order within this phase.

## Context

Project: MyGameON Hub — Electron desktop app (Next.js 14+ App Router).
Working directory: `C:\mad\proyek\mygameon-hub`

---

## Task 4.1 — Consolidate Loading States in Download Hub

**File:** `app/(dashboard)/download/page.jsx`

**Problem:** 14+ separate `useState` calls for loading flags, each with its own cleanup in `finally` blocks. This is fragile — one missed `finally` leaves a spinner stuck.

**Solution:** Replace all action-related loading states with a single `useReducer`.

**Step A:** Remove these individual loading states:
```js
// REMOVE:
const [handoffLoading, setHandoffLoading] = useState({})
const [handoffSuccess, setHandoffSuccess] = useState({})
const [taskActionLoading, setTaskActionLoading] = useState({})
const [extractingFolders, setExtractingFolders] = useState({})
const [stagedActionLoading, setStagedActionLoading] = useState({})
const [startingAllStaged, setStartingAllStaged] = useState(false)
const [packageActionLoading, setPackageActionLoading] = useState({})
const [launchingJd, setLaunchingJd] = useState(false)
const [deletingRaw, setDeletingRaw] = useState(false)
const [addingDownload, setAddingDownload] = useState(false)
```

**Step B:** Add a single reducer near the top of the file (before the component):

```js
const initialActionState = {
  handoff: {},       // { [folderName]: boolean }
  handoffDone: {},   // { [folderName]: boolean }
  taskControl: {},   // { [taskId]: 'pause' | 'resume' | 'cancel' | null }
  extracting: {},    // { [folderPath]: boolean }
  staged: {},        // { [key]: 'start' | 'remove' | null }
  startingAll: false,
  packageControl: {},// { [packageName]: action | null }
  launchingJd: false,
  deletingRaw: false,
  addingDownload: false
}

function actionReducer(state, action) {
  switch (action.type) {
    case 'SET_HANDOFF':
      return { ...state, handoff: { ...state.handoff, [action.key]: action.value } }
    case 'SET_HANDOFF_DONE':
      return { ...state, handoffDone: { ...state.handoffDone, [action.key]: action.value } }
    case 'SET_TASK_CONTROL':
      return { ...state, taskControl: { ...state.taskControl, [action.key]: action.value } }
    case 'SET_EXTRACTING':
      return { ...state, extracting: { ...state.extracting, [action.key]: action.value } }
    case 'SET_STAGED':
      return { ...state, staged: { ...state.staged, [action.key]: action.value } }
    case 'SET_STARTING_ALL':
      return { ...state, startingAll: action.value }
    case 'SET_PACKAGE_CONTROL':
      return { ...state, packageControl: { ...state.packageControl, [action.key]: action.value } }
    case 'SET_LAUNCHING_JD':
      return { ...state, launchingJd: action.value }
    case 'SET_DELETING_RAW':
      return { ...state, deletingRaw: action.value }
    case 'SET_ADDING_DOWNLOAD':
      return { ...state, addingDownload: action.value }
    default:
      return state
  }
}
```

**Step C:** In the component, replace all removed states with:
```js
const [actionState, dispatchAction] = useReducer(actionReducer, initialActionState)
```

**Step D:** Update all references. Examples:
```js
// BEFORE: setHandoffLoading(prev => ({ ...prev, [folderName]: true }))
// AFTER:  dispatchAction({ type: 'SET_HANDOFF', key: folderName, value: true })

// BEFORE: handoffLoading[folderName]
// AFTER:  actionState.handoff[folderName]

// BEFORE: setLaunchingJd(true)
// AFTER:  dispatchAction({ type: 'SET_LAUNCHING_JD', value: true })
```

Do a full find-and-replace pass for all 10 removed states.

---

## Task 4.2 — Extract CleanWorkbench Queue State to Custom Hook

**File:** `components/studio/CleanWorkbench.jsx`

**Problem:** `CleanWorkbench` receives 25+ props, many of which are state + setter pairs that logically belong together. This makes the component hard to maintain.

**Step A:** Create `hooks/useUploadQueue.js`:

```js
'use client'

import { useState, useCallback } from 'react'

/**
 * Manages the upload queue state for CleanWorkbench.
 * Extracted to reduce prop drilling and co-locate related state.
 */
export function useUploadQueue() {
  const [queue, setQueue] = useState([])
  const [activeItem, setActiveItem] = useState(null)
  const [queueProcessing, setQueueProcessing] = useState(false)

  const addToQueue = useCallback((item) => {
    setQueue(prev => {
      if (prev.find(q => q.folderPath === item.folderPath)) return prev
      return [...prev, item]
    })
  }, [])

  const removeFromQueue = useCallback((folderPath) => {
    setQueue(prev => prev.filter(q => q.folderPath !== folderPath))
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
    setActiveItem(null)
  }, [])

  return {
    queue,
    setQueue,
    activeItem,
    setActiveItem,
    queueProcessing,
    setQueueProcessing,
    addToQueue,
    removeFromQueue,
    clearQueue
  }
}
```

**Step B:** In `app/(dashboard)/studio/page.js`, replace queue-related `useState` calls with this hook:

```js
import { useUploadQueue } from '@/hooks/useUploadQueue'
// ...
const uploadQueue = useUploadQueue()
```

**Step C:** Pass the hook result as a single prop to `CleanWorkbench` instead of individual state pieces:

```jsx
// BEFORE (many individual props):
<CleanWorkbench
  uploadQueue={uploadQueue}
  onAddToQueue={handleAddToQueue}
  onRemoveFromQueue={handleRemoveFromQueue}
  // ... many more
/>

// AFTER (one bundled prop):
<CleanWorkbench
  queueState={uploadQueue}
  // ... other non-queue props remain
/>
```

**Step D:** Update `CleanWorkbench.jsx` to destructure from `queueState` prop instead of individual props. This is a mechanical replacement — find all queue-related prop usages and update them to `props.queueState.xxx`.

---

## Task 4.3 — Deduplicate handleSelectFolder in Studio

**File:** `app/(dashboard)/studio/page.js`

**Problem:** The folder selection logic (auto-detect existing game in catalog, set upload mode, etc.) exists in two places:
- The `setSelectedFolder` prop callback passed to `CleanWorkbench` (around line ~917)
- The Console tab folder list click handler (around line ~1075)

**Fix:** Extract to a single `handleSelectFolder` function at the `StudioPage` level:

```js
const handleSelectFolder = useCallback((folder) => {
  setSelectedFolder(folder)

  // Auto-detect if this game already exists in catalog
  const matchingGame = existingGames.find(g => {
    const folderClean = cleanReleaseName(folder.name || '').toLowerCase()
    const gameClean = (g.name || g.cleanTitle || '').toLowerCase()
    return folderClean.includes(gameClean) || gameClean.includes(folderClean)
  })

  if (matchingGame) {
    setUploadMode('update')
    setSelectedGame(matchingGame)
    setCustomCatalogTitle(matchingGame.cleanTitle || matchingGame.name || '')
  } else {
    setUploadMode('new')
    setSelectedGame(null)
    setCustomCatalogTitle(cleanReleaseName(folder.name || ''))
  }
}, [existingGames])
```

Then replace both occurrences with calls to `handleSelectFolder(folder)`.

Pass it as a single prop to `CleanWorkbench`:
```jsx
<CleanWorkbench
  onSelectFolder={handleSelectFolder}
  // ... other props
/>
```

---

## Task 4.4 — Navigation Guard Hook

**Create file:** `hooks/useNavigationGuard.js`

Prevents accidental navigation away during active processes (upload, download, Python rendering).

```js
'use client'

import { useEffect } from 'react'

/**
 * Warns user before leaving the page when a condition is true.
 * @param {boolean} isActive - Whether to block navigation
 * @param {string} message - Warning message shown to user
 */
export function useNavigationGuard(isActive, message = 'Proses sedang berjalan. Yakin ingin meninggalkan halaman?') {
  useEffect(() => {
    if (!isActive) return

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = message
      return message
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isActive, message])
}
```

**Use in each page:**

In `app/(dashboard)/download/page.jsx`:
```js
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
// ...
const isProcessActive = (data.activeItems?.length > 0) || (data.activeExtractions?.length > 0)
useNavigationGuard(isProcessActive, 'Download sedang berjalan. Yakin ingin meninggalkan halaman?')
```

In `app/(dashboard)/studio/page.js`:
```js
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
// ...
const isUploading = processState?.status === 'processing' || processState?.status === 'uploading'
useNavigationGuard(isUploading, 'Upload ke Google Drive sedang berjalan. Yakin ingin meninggalkan halaman?')
```

In `app/(dashboard)/scout/page.js`:
```js
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
// ...
const isRendering = generateState.status === 'generating'
useNavigationGuard(isRendering, 'Slide Shopee sedang dirender. Yakin ingin meninggalkan halaman?')
```

---

## Task 4.5 — Replace Individual Toasts with useToast()

**Prerequisites:** Phase 1.5 (Toast component) must be done.

**Files:**
- `app/(dashboard)/download/page.jsx`
- `app/(dashboard)/studio/page.js` (both `actionMessage` and `crudMessage` systems)
- `app/(dashboard)/scout/page.js` (inline error divs → toast)

**Pattern per file:**

```js
// 1. Add import:
import { useToast } from '@/components/ui/Toast'

// 2. Add hook call in component:
const { toast } = useToast()

// 3. Remove old state:
// REMOVE: const [notification, setNotification] = useState(null)
// REMOVE: const [actionMessage, setActionMessage] = useState(null)
// REMOVE: const [crudMessage, setCrudMessage] = useState(null)

// 4. Replace all setNotification calls:
// BEFORE: setNotification({ type: 'success', text: 'Upload berhasil!' })
//         setTimeout(() => setNotification(null), 4000)
// AFTER:  toast('Upload berhasil!', 'success')

// BEFORE: setNotification({ type: 'error', text: 'Gagal upload' })
// AFTER:  toast('Gagal upload', 'error')

// 5. Remove all notification JSX render blocks (the fixed top-16 right-6 div)
```

**For Studio page specifically** — it has two separate message systems (`actionMessage` for file actions in `CleanWorkbench`, `crudMessage` for CRUD). Both should be replaced with `toast()`. Pass the `toast` function down to `CleanWorkbench` as a prop or use the hook directly in `CleanWorkbench` (since it's a Client Component and `ToastProvider` is in the layout, `useToast()` works anywhere in the tree).

---

## Task 4.6 — Listing Output Path from Settings

**Files:**
- `app/(dashboard)/scout/page.js`
- `app/api/listing/generate/route.js`

**Problem:** `D:\\Shopee\\3-listing_output` is hardcoded in both files.

**Step A:** Add listing output path to the preferences system. Check `app/api/preferences/route.js` for how preferences are stored. Add `listingOutputDir` field.

**Step B:** In `app/(dashboard)/scout/page.js`, fetch the preference on mount:

```js
useEffect(() => {
  fetch('/api/preferences')
    .then(r => r.json())
    .then(json => {
      if (json?.listingOutputDir) {
        setCustomOutputDir(json.listingOutputDir)
      }
    })
    .catch(() => {}) // non-fatal
}, [])
```

**Step C:** Save preference when user changes the output dir field (debounced):

```js
// After the customOutputDir input onChange handler, add debounced save:
useEffect(() => {
  const timer = setTimeout(() => {
    if (customOutputDir) {
      fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingOutputDir: customOutputDir })
      }).catch(() => {})
    }
  }, 1000) // save 1 second after user stops typing
  return () => clearTimeout(timer)
}, [customOutputDir])
```

**Step D:** In `app/api/listing/generate/route.js`, change the fallback from hardcoded path to:
```js
// BEFORE:
let baseOutputDir = customOutputDir || 'D:\\Shopee\\3-listing_output'

// AFTER (the customOutputDir already comes from the request body — keep it, just change the fallback):
const fallbackDir = process.env.LISTING_OUTPUT_DIR || path.join(process.cwd(), 'listing_output')
let baseOutputDir = customOutputDir || fallbackDir
```

Also add `LISTING_OUTPUT_DIR` to `.env.local` documentation comment.

---

## Verification Checklist

- [ ] Download Hub: no more individual loading state variables — all via `actionState.xxx`
- [ ] Download Hub: stuck spinner bug is no longer possible (reducers always have clear reset paths)
- [ ] Studio: `CleanWorkbench` receives `queueState` prop (not 10+ individual queue props)
- [ ] Studio: `handleSelectFolder` exists once, is passed as single `onSelectFolder` prop
- [ ] All 3 pages: navigating away during active process shows browser warning dialog
- [ ] All 3 pages: toast notifications come from shared `<Toast>` component (no inline fixed divs)
- [ ] Listing Studio: output dir is remembered across page refreshes
- [ ] Listing Studio: output dir can be configured in preferences, no hardcoded `D:\Shopee` path
- [ ] `npm run build` passes

---

## Files Changed in This Phase

| File | Action |
|------|--------|
| `app/(dashboard)/download/page.jsx` | Modified — useReducer for loading states, useToast, useNavigationGuard |
| `app/(dashboard)/studio/page.js` | Modified — useNavigationGuard, useToast, dedup handleSelectFolder, useUploadQueue |
| `app/(dashboard)/scout/page.js` | Modified — useNavigationGuard, useToast for errors, save/load output dir pref |
| `app/api/listing/generate/route.js` | Modified — remove hardcoded path, use env var fallback |
| `app/api/preferences/route.js` | Modified — add listingOutputDir field |
| `components/studio/CleanWorkbench.jsx` | Modified — accept queueState prop, use useToast directly |
| `hooks/useUploadQueue.js` | Created |
| `hooks/useNavigationGuard.js` | Created |
