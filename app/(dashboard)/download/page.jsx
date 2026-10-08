'use client'

import { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react'
import Link from 'next/link'
import {
  DownloadCloud, HardDrive, RefreshCw, FolderOpen, ExternalLink, Play,
  CheckCircle2, Clock, Loader2, ArrowRight, Zap, AlertTriangle, ShieldCheck,
  Package, FileCode, Check, Layers, ChevronRight, ChevronDown, Sparkles, Terminal, Trash2,
  Pause, Square, Plus, Link2, X, Globe, Radio, CheckCircle
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import PreInstalledWizardModal from '@/components/studio/PreInstalledWizardModal'
import LocalFolderInspectModal from '@/components/files/LocalFolderInspectModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { formatSpeed } from '@/lib/utils'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { useToast } from '@/components/ui/Toast'

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

export default function DownloadHubPage() {
  const { toast } = useToast()
  const [actionState, dispatchAction] = useReducer(actionReducer, initialActionState)

  const [data, setData] = useState({
    targetDir: 'D:\\Game\\Shopee\\GameDownload',
    uploadDir: 'D:\\Game\\Shopee\\GameUpload',
    isRunning: false,
    activeItems: [],
    readyItems: [],
    historyItems: [],
    streamTasks: [],
    stagedPackages: [],
    stagedItems: [],
    activeExtractions: [],
    cnlStatus: { running: false, port: 9666, error: null }
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [wizardFolder, setWizardFolder] = useState(null)
  const [inspectFolder, setInspectFolder] = useState(null) // { folderName, folderPath, type: 'download' | 'upload' }
  const [confirmDeleteRaw, setConfirmDeleteRaw] = useState(null)
  const [extractModal, setExtractModal] = useState(null) // { folderPath, packageName, password }

  // Staging / Penampungan Unduhan Baru
  const [expandedPackages, setExpandedPackages] = useState({})

  // Kelompok Unduhan Berjalan (Parent-Child)
  const [expandedActiveGroups, setExpandedActiveGroups] = useState({})

  // Modal Tambah Tautan Manual
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [manualFilename, setManualFilename] = useState('')
  const [manualAutoStart, setManualAutoStart] = useState(false)
  const pollErrorCount = useRef(0)
  const [serverUnreachable, setServerUnreachable] = useState(false)

  // Filter & Tampilan Unduhan Selesai
  const [readyFilter, setReadyFilter] = useState('pending') // 'pending' | 'all' | 'transferred'
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)

  // ── 1. Fetch Status Download ──
  const fetchStatus = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true)
    try {
      const res = await fetch('/api/download/status')
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
        pollErrorCount.current = 0
        setServerUnreachable(false)
      } else {
        pollErrorCount.current += 1
        if (pollErrorCount.current >= 3) {
          setServerUnreachable(true)
        }
      }
    } catch (err) {
      if (!isSilent) {
        console.error('Gagal mengambil status download:', err)
      }
      pollErrorCount.current += 1
      if (pollErrorCount.current >= 3) {
        setServerUnreachable(true)
      }
    } finally {
      setLoading(false)
      if (!isSilent) setRefreshing(false)
    }
  }, [])

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
    let isCancelled = false
    let timerId = null

    function scheduleNext() {
      if (isCancelled) return
      const d = dataRef.current
      const hasActive =
        (d.activeItems && d.activeItems.length > 0) ||
        (d.activeExtractions && d.activeExtractions.length > 0) ||
        (d.stagedPackages && d.stagedPackages.length > 0)
      const delay = hasActive ? 1500 : 6000

      timerId = setTimeout(async () => {
        if (isCancelled) return
        await fetchStatus(true)
        if (!isCancelled) {
          scheduleNext() // reschedule after fetch completes
        }
      }, delay)
    }

    scheduleNext()

    return () => {
      isCancelled = true
      if (timerId) clearTimeout(timerId)
    }
  }, [fetchStatus])

  // Total Kecepatan Unduhan Saat Ini
  const totalSpeedFormatted = useMemo(() => {
    const totalBytesPerSec = (data.activeItems || []).reduce((acc, cur) => acc + (cur.downloadSpeed || 0), 0)
    return formatSpeed(totalBytesPerSec)
  }, [data.activeItems])

  // ── 2. Kontrol Unduhan (Pause / Resume / Cancel) ──
  async function handleTaskControl(action, taskId, folderName) {
    if (!taskId) return
    dispatchAction({ type: 'SET_TASK_CONTROL', key: taskId, value: action })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, taskId })
      })
      const json = await res.json()
      if (json.success) {
        toast(
          action === 'pause'
            ? `⏸️ Unduhan "${folderName || 'berkas'}" dijeda.`
            : action === 'resume'
            ? `▶️ Unduhan "${folderName || 'berkas'}" dilanjutkan.`
            : `⏹️ Unduhan "${folderName || 'berkas'}" dibatalkan.`,
          'success'
        )
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal memproses aksi unduhan', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_TASK_CONTROL', key: taskId, value: null })
    }
  }

  // ── 2b. Jeda Semua & Lanjutkan Semua ──
  async function handlePauseAll() {
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause_all' })
      })
      const json = await res.json()
      if (json.success) {
        toast('⏸️ Seluruh unduhan berhasil dijeda.', 'success')
        fetchStatus(true)
      }
    } catch (_) {}
  }

  async function handleResumeAll() {
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume_all' })
      })
      const json = await res.json()
      if (json.success) {
        toast('▶️ Seluruh antrean unduhan dilanjutkan.', 'success')
        fetchStatus(true)
      }
    } catch (_) {}
  }

  // ── 2c. Kontrol Paket Multi-Part (Pause / Resume / Cancel seluruh part paket) ──
  async function handlePackageControl(action, packageName) {
    if (!packageName) return
    dispatchAction({ type: 'SET_PACKAGE_CONTROL', key: packageName, value: action })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, packageName })
      })
      const json = await res.json()
      if (json.success) {
        toast(
          action === 'pause_package'
            ? `⏸️ Seluruh part paket "${packageName}" dijeda.`
            : action === 'resume_package'
            ? `▶️ Seluruh part paket "${packageName}" dilanjutkan.`
            : `⏹️ Seluruh part paket "${packageName}" dibatalkan.`,
          'success'
        )
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal memproses aksi paket', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_PACKAGE_CONTROL', key: packageName, value: null })
    }
  }

  // ── Kelompokkan Unduhan Berjalan ke Format Parent-Child ──
  const activeGroups = useMemo(() => {
    if (data.activeGroups && data.activeGroups.length > 0) {
      return data.activeGroups
    }
    const groupMap = new Map()
    for (const item of (data.activeItems || [])) {
      const key = item.packageName || item.id || item.folderName
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          packageName: item.packageName || item.cleanTitle || item.folderName,
          cleanTitle: item.packageName || item.cleanTitle || item.folderName,
          isPackage: !!item.packageName,
          customDir: item.fullPath ? item.fullPath : null,
          packageType: item.packageType || 'ARCHIVE',
          displayBadge: item.packageName ? 'MULTI-PART' : item.displayBadge || 'NATIVE STREAM',
          items: []
        })
      }
      groupMap.get(key).items.push(item)
    }
    return Array.from(groupMap.values()).map((grp) => {
      const totalBytes = grp.items.reduce((acc, cur) => acc + (cur.totalSize || cur.targetBytes || 0), 0)
      const downloadedBytes = grp.items.reduce((acc, cur) => acc + (cur.downloadedBytes || 0), 0)
      const downloadSpeed = grp.items.reduce((acc, cur) => acc + (cur.downloadSpeed || 0), 0)
      const progressPercent = totalBytes > 0
        ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10)
        : (grp.items[0]?.progressPercent || 0)
      const isDownloading = grp.items.some((i) => i.status === 'downloading')
      const isQueued = grp.items.some((i) => i.status === 'queued')
      const isPaused = grp.items.every((i) => i.status === 'paused')
      const isError = grp.items.some((i) => i.status === 'error')
      const firstErrorItem = grp.items.find((i) => i.status === 'error' && i.error)
      const groupError = grp.error || (firstErrorItem ? firstErrorItem.error : null)

      const activePart = grp.items.find((i) => i.status === 'downloading') || grp.items.find((i) => i.status === 'queued')
      const activePartIndex = activePart ? grp.items.indexOf(activePart) + 1 : 1

      return {
        ...grp,
        error: groupError,
        partsCount: grp.items.length,
        totalBytes,
        totalBytesFormatted: totalBytes > 0 ? `${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB` : null,
        downloadedBytes,
        downloadedBytesFormatted: downloadedBytes > 0 ? `${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB` : '0 B',
        progressPercent,
        downloadSpeed,
        downloadSpeedFormatted: downloadSpeed > 0 ? `${(downloadSpeed / (1024 * 1024)).toFixed(2)} MB/s` : null,
        status: isDownloading ? 'downloading' : (isPaused ? 'paused' : (isQueued ? 'queued' : (isError ? 'error' : 'paused'))),
        statusText: isDownloading
          ? `Sedang Mengunduh (Part ${activePartIndex}/${grp.items.length})`
          : (isPaused ? 'Dijeda' : (isError ? 'Gagal' : 'Antrean')),
        activePartName: activePart ? activePart.folderName : null,
        activePartIndex
      }
    })
  }, [data.activeGroups, data.activeItems])

  // ── 2c. Pengelompokan & Filter Unduhan Selesai (Dapur Kotor -> Workbench) ──
  const pendingReadyItems = useMemo(() => {
    return (data.readyItems || []).filter(
      (item) => item.status !== 'transferred' && !actionState.handoffDone[item.folderName]
    )
  }, [data.readyItems, actionState.handoffDone])

  const transferredReadyItems = useMemo(() => {
    return (data.readyItems || []).filter(
      (item) => item.status === 'transferred' || actionState.handoffDone[item.folderName]
    )
  }, [data.readyItems, actionState.handoffDone])

  const displayedReadyItems = useMemo(() => {
    if (readyFilter === 'pending') {
      return pendingReadyItems.length > 0 ? pendingReadyItems : data.readyItems || []
    }
    if (readyFilter === 'transferred') return transferredReadyItems
    return data.readyItems || []
  }, [readyFilter, data.readyItems, pendingReadyItems, transferredReadyItems])

  // ── 2d. Kontrol Paket & Item Staging (Ditampung) ──
  async function handleStartStagedPackage(packageName, packageKey) {
    if (!packageName) return
    dispatchAction({ type: 'SET_STAGED', key: packageKey, value: 'start' })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_package', packageName })
      })
      const json = await res.json()
      if (json.success) {
        toast(`▶️ Paket "${packageName}" berhasil dimasukkan ke antrean unduh!`, 'success')
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal memulai paket unduhan', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_STAGED', key: packageKey, value: null })
    }
  }

  async function handleStartStagedTask(taskId, filename, packageKey) {
    if (!taskId) return
    dispatchAction({ type: 'SET_STAGED', key: packageKey || taskId, value: 'start' })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_task', taskId })
      })
      const json = await res.json()
      if (json.success) {
        toast(`▶️ Unduhan "${filename || 'berkas'}" dimulai!`, 'success')
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal memulai unduhan', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_STAGED', key: packageKey || taskId, value: null })
    }
  }

  async function handleStartAllStaged() {
    dispatchAction({ type: 'SET_STARTING_ALL', value: true })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_all_staged' })
      })
      const json = await res.json()
      if (json.success) {
        toast('▶️ Seluruh paket yang ditampung dimasukkan ke antrean unduh!', 'success')
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal memulai semua unduhan', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_STARTING_ALL', value: false })
    }
  }

  async function handleRemoveStagedPackage(packageName, packageKey) {
    if (!packageName) return
    dispatchAction({ type: 'SET_STAGED', key: packageKey, value: 'remove' })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_staged', packageName })
      })
      const json = await res.json()
      if (json.success) {
        toast(`🗑️ Paket "${packageName}" dihapus dari penampungan.`, 'success')
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal menghapus paket', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_STAGED', key: packageKey, value: null })
    }
  }

  async function handleRemoveStagedTask(taskId, filename, packageKey) {
    if (!taskId) return
    dispatchAction({ type: 'SET_STAGED', key: packageKey || taskId, value: 'remove' })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_staged', taskId })
      })
      const json = await res.json()
      if (json.success) {
        toast(`🗑️ Unduhan "${filename || 'berkas'}" dihapus dari penampungan.`, 'success')
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal menghapus unduhan', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_STAGED', key: packageKey || taskId, value: null })
    }
  }

  async function handleSetConcurrency(limit) {
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_concurrency', concurrency: limit })
      })
      const json = await res.json()
      if (json.success) {
        setData((prev) => ({ ...prev, maxConcurrent: limit }))
        toast(`⚡ Batas unduhan aktif diatur ke ${limit} game sekaligus.`, 'success')
        fetchStatus(true)
      }
    } catch (_) {}
  }

  // ── 3. Ambil Alih Port 9666 dari JDownloader ──
  async function handleTakeoverPort() {
    dispatchAction({ type: 'SET_LAUNCHING_JD', value: true })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_jd' })
      })
      const json = await res.json()
      if (json.success) {
        toast('✓ JDownloader 2 ditutup. Port 9666 kini dikendalikan penuh oleh MyGameON!', 'success')
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal mengambil alih port 9666', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_LAUNCHING_JD', value: false })
    }
  }

  // ── 4. Eksekusi Ekstraksi UnRAR Manual ──
  function handleManualExtract(folderPath, packageName, defaultPassword) {
    if (!folderPath) return
    setExtractModal({
      folderPath,
      packageName: packageName || 'Game',
      password: defaultPassword || 'mygameon'
    })
  }

  async function handleExecuteExtract(folderPath, packageName, password) {
    if (!folderPath) return
    setExtractModal(null)
    dispatchAction({ type: 'SET_EXTRACTING', key: folderPath, value: true })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract_now',
          folderPath,
          packageName,
          password: password !== undefined ? String(password).trim() : 'mygameon'
        })
      })
      const json = await res.json()
      if (json.success) {
        toast(`⚡ Ekstraksi UnRAR untuk "${packageName || 'berkas'}" dimulai di background!`, 'success')
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal memulai ekstraksi', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_EXTRACTING', key: folderPath, value: false })
    }
  }

  async function handleDismissExtraction(taskId) {
    if (!taskId) return
    try {
      await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss_extraction', taskId })
      })
      fetchStatus(true)
    } catch (_) {}
  }

  // ── 5. Tambah Tautan Manual ──
  async function handleAddManualDownload(e) {
    e.preventDefault()
    if (!manualUrl.trim()) return

    dispatchAction({ type: 'SET_ADDING_DOWNLOAD', value: true })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_url',
          url: manualUrl.trim(),
          filename: manualFilename.trim() || undefined,
          autoStart: manualAutoStart
        })
      })
      const json = await res.json()
      if (json.success) {
        toast(
          json.message || (manualAutoStart
            ? `🚀 Unduhan "${json.task?.filename || 'berkas'}" langsung dimulai!`
            : `📦 Tautan "${json.task?.filename || 'berkas'}" berhasil ditampung di antrean (Siap Mulai).`),
          'success'
        )
        setManualUrl('')
        setManualFilename('')
        setManualAutoStart(false)
        setIsAddModalOpen(false)
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal memulai unduhan dari tautan', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_ADDING_DOWNLOAD', value: false })
    }
  }

  // ── 6. Buka Folder di Windows Explorer ──
  async function handleOpenFolder(folderPath) {
    try {
      await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_folder', targetPath: folderPath || data.targetDir })
      })
    } catch (err) {
      console.error('Gagal membuka folder di explorer:', err)
    }
  }

  // ── 7. Buka Sumber Game di In-App Protected Browser ──
  function handleOpenGameSource(e, url, title) {
    if (typeof window !== 'undefined' && window.electronAPI?.openGameBrowser) {
      e.preventDefault()
      window.electronAPI.openGameBrowser(url, title)
    }
  }

  // ── 8. Eksekusi Handoff (Kirim ke Workbench) ──
  async function handleHandoff(folderName, mode = 'new') {
    dispatchAction({ type: 'SET_HANDOFF', key: folderName, value: true })
    try {
      const res = await fetch('/api/download/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName,
          mode,
          cleanReplace: true
        })
      })
      const json = await res.json()
      if (json.success) {
        dispatchAction({ type: 'SET_HANDOFF_DONE', key: folderName, value: true })
        const delCount = json.deletedFiles?.length || 0
        const addCount = json.addedFiles?.length || 0
        const brandMsg = delCount > 0
          ? `(Dibersihkan ${delCount} sampah iklan luar, disematkan ${addCount} aset resmi MyGameON)`
          : `(Disematkan ${addCount} aset resmi MyGameON)`
        toast(`✅ "${folderName}" berhasil dioper ke Workbench! ${brandMsg}`, 'success')
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal melakukan handoff game', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_HANDOFF', key: folderName, value: false })
    }
  }

  // ── 9. Hapus Mentahan Download ──
  async function handleDeleteRaw(folderName) {
    if (!folderName) return
    dispatchAction({ type: 'SET_DELETING_RAW', value: true })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_file', folderName })
      })
      const json = await res.json()
      if (json.success) {
        toast(`🗑️ Berkas mentahan "${folderName}" berhasil dihapus. Ruang penyimpanan bertambah lega!`, 'success')
        fetchStatus(true)
      } else {
        toast(json.error || 'Gagal menghapus folder mentahan', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      dispatchAction({ type: 'SET_DELETING_RAW', value: false })
      setConfirmDeleteRaw(null)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <TopBar title="Download Hub" />

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

      {/* 🌟 1. DOWNLOAD MANAGER CONTROL BAR (HERO HEADER) */}
      <div className="rounded-3xl border border-[var(--border-strong)] bg-gradient-to-r from-zinc-950 via-[var(--surface)] to-zinc-950 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-500/10 via-[var(--primary)]/5 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                <DownloadCloud size={20} />
              </span>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                  <span>Download Manager</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Native Stream Engine
                  </span>
                </h2>
              </div>
            </div>
            <p className="text-xs text-[var(--text-3)] max-w-2xl leading-relaxed">
              Pusat kendali unduhan game PC berkecepatan tinggi. Mendukung penangkapan otomatis Click&apos;n&apos;Load (Port 9666), ekstrak otomatis multi-part UnRAR, dan pengoperan instan 1-klik ke Workbench.
            </p>
          </div>

          {/* Quick Actions & Status Strip */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Status Click'n'Load Port 9666 */}
            {data.cnlStatus?.running ? (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-2 shadow-inner">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div className="text-left">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/80 block leading-none">
                    Click&apos;n&apos;Load (Port 9666)
                  </span>
                  <span className="text-xs font-bold text-emerald-300 leading-none mt-1 block">
                    🟢 Siap Tangkap FileCrypt
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-950/30 px-3.5 py-2 shadow-inner">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <div className="text-left">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/80 block leading-none">
                    Click&apos;n&apos;Load Port 9666
                  </span>
                  <span className="text-xs font-bold text-amber-300 leading-none mt-1 block">
                    Terpakai JDownloader
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTakeoverPort}
                  disabled={actionState.launchingJd}
                  className="rounded-xl bg-amber-400 text-black px-2.5 py-1 text-[11px] font-black hover:brightness-110 cursor-pointer transition-all shadow-sm disabled:opacity-50"
                  title="Tutup JDownloader dan jadikan MyGameON sebagai penangkap Click'n'Load utama"
                >
                  {actionState.launchingJd ? <Loader2 size={12} className="animate-spin inline" /> : 'Ambil Alih Port'}
                </button>
              </div>
            )}

            {/* Speed Badge jika ada aktivitas unduh */}
            {totalSpeedFormatted && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-2 shadow-inner">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <div className="text-left">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/80 block leading-none">
                    Kecepatan Total
                  </span>
                  <span className="text-xs font-mono font-black text-emerald-300 leading-none mt-1 block">
                    {totalSpeedFormatted}
                  </span>
                </div>
              </div>
            )}

            {/* Tombol Tambah Tautan Manual */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2.5 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Tambah Tautan</span>
            </button>

            {/* Tombol Segarkan */}
            <button
              type="button"
              onClick={() => fetchStatus()}
              disabled={refreshing}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              title="Segarkan antrean download"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Path Status & Stats Strip */}
        <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Folder Unduhan:</span>
              <button
                type="button"
                onClick={() => handleOpenFolder(data.targetDir)}
                className="font-mono text-[11px] text-[var(--text-2)] bg-black/40 border border-white/10 px-2.5 py-1 rounded-lg hover:border-emerald-400/40 hover:text-white transition-colors flex items-center gap-1.5 truncate cursor-pointer"
                title="Klik untuk membuka folder di Windows Explorer"
              >
                <FolderOpen size={13} className="text-amber-400 shrink-0" />
                <span className="truncate">{data.targetDir}</span>
              </button>
            </div>

            {/* Live Free Disk Space Indicator */}
            {data.diskSpace && (
              <div className="flex items-center gap-1.5 font-mono text-[11px] bg-black/40 border border-white/10 px-2.5 py-1 rounded-lg">
                <HardDrive size={13} className="text-cyan-400 shrink-0" />
                <span className="text-[var(--text-4)]">Ruang Disk D:</span>
                <span className="text-cyan-300 font-bold">{data.diskSpace.freeFormatted} Sisa</span>
                <span className="text-zinc-500 text-[10px]">({data.diskSpace.usedPercent}% terpakai)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {data.stagedPackages && data.stagedPackages.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span className="text-teal-400 font-bold">{data.stagedPackages.length}</span>
                  <span className="text-[var(--text-4)]">Ditampung</span>
                </div>
                <div className="h-3 w-px bg-white/10" />
              </>
            )}
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-amber-400 font-bold">{data.activeItems?.length || 0}</span>
              <span className="text-[var(--text-4)]">Sedang Mengunduh</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-emerald-400 font-bold">{data.readyItems?.length || 0}</span>
              <span className="text-[var(--text-4)]">Siap Dioper ke Workbench</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🌐 QUICK BAR: PUSAT SUMBER GAME PC (MUDAH DIAKSES TANPA SCROLL) */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Buka Sumber Game (Browser Aman):
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://www.ovagames.com"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => handleOpenGameSource(e, 'https://www.ovagames.com', 'OvaGames')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-[var(--text)] hover:border-amber-400/40 hover:text-amber-300 transition-all cursor-pointer shadow-sm group"
          >
            <span>🎮 OvaGames</span>
            <ExternalLink size={11} className="opacity-50 group-hover:opacity-100" />
          </a>
          <a
            href="https://steamrip.com"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => handleOpenGameSource(e, 'https://steamrip.com', 'SteamRIP')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-[var(--text)] hover:border-blue-400/40 hover:text-blue-300 transition-all cursor-pointer shadow-sm group"
          >
            <span>⚡ SteamRIP</span>
            <ExternalLink size={11} className="opacity-50 group-hover:opacity-100" />
          </a>
          <a
            href="https://fitgirl-repacks.site"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => handleOpenGameSource(e, 'https://fitgirl-repacks.site', 'FitGirl Repacks')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-[var(--text)] hover:border-purple-400/40 hover:text-purple-300 transition-all cursor-pointer shadow-sm group"
          >
            <span>📦 FitGirl</span>
            <ExternalLink size={11} className="opacity-50 group-hover:opacity-100" />
          </a>
          <a
            href="https://dodi-repacks.site"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => handleOpenGameSource(e, 'https://dodi-repacks.site', 'DODI Repacks')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-[var(--text)] hover:border-pink-400/40 hover:text-pink-300 transition-all cursor-pointer shadow-sm group"
          >
            <span>🚀 DODI</span>
            <ExternalLink size={11} className="opacity-50 group-hover:opacity-100" />
          </a>
        </div>
      </div>

      {/* ⚡ 2. ACTIVE UNRAR EXTRACTION CARD (PROSES / SELESAI / GAGAL) */}
      {data.activeExtractions && data.activeExtractions.length > 0 && (
        <div className="space-y-3">
          {data.activeExtractions.map((ext) => {
            if (ext.status === 'error') {
              return (
                <div
                  key={ext.id}
                  className="rounded-3xl border border-rose-500/50 bg-gradient-to-r from-rose-950/50 via-zinc-950 to-rose-950/30 p-5 space-y-3 shadow-2xl relative overflow-hidden animate-in fade-in duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        <AlertTriangle size={16} />
                      </span>
                      <div>
                        <h4 className="font-black text-sm text-white flex items-center gap-2">
                          <span>❌ Ekstraksi Gagal: {ext.packageName}</span>
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-rose-300 border border-rose-500/30">
                            WinRAR UnRAR
                          </span>
                        </h4>
                        <p className="text-[11px] font-mono text-rose-300/90 mt-0.5">
                          {ext.error || 'Terjadi kesalahan saat mengekstrak berkas.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          handleDismissExtraction(ext.id)
                          handleManualExtract(
                            ext.folderPath,
                            ext.packageName,
                            ext.packageName?.toLowerCase().includes('ova') || ext.primaryArchive?.toLowerCase().includes('og')
                              ? 'www.ovagames.com'
                              : 'mygameon'
                          )
                        }}
                        className="rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw size={12} />
                        <span>Coba Ekstrak Lagi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDismissExtraction(ext.id)}
                        className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            if (ext.status === 'completed') {
              return (
                <div
                  key={ext.id}
                  className="rounded-3xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 via-zinc-950 to-emerald-950/30 p-5 space-y-2 shadow-2xl animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 size={16} />
                      </span>
                      <div>
                        <h4 className="font-black text-sm text-white flex items-center gap-2">
                          <span>✅ Ekstraksi Selesai: {ext.packageName}</span>
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                            100% Selesai
                          </span>
                        </h4>
                        <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                          Berkas game/ISO telah terekstrak rapi dan siap dipasang ke Pre-Installed atau dioper ke Workbench.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDismissExtraction(ext.id)}
                      className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={ext.id}
                className="rounded-3xl border border-blue-500/40 bg-gradient-to-r from-blue-950/30 via-zinc-950 to-blue-950/20 p-5 space-y-3 shadow-2xl relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Loader2 size={16} className="animate-spin" />
                    </span>
                    <div>
                      <h4 className="font-black text-sm text-white flex items-center gap-2">
                        <span>⚡ Mengekstrak: {ext.packageName}</span>
                        <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-blue-300 border border-blue-500/30">
                          WinRAR UnRAR Native
                        </span>
                      </h4>
                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        Berkas aktif: <strong className="text-blue-300">{ext.currentFile || 'Mengekstrak berkas...'}</strong>
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-lg font-black text-blue-400">
                    {ext.progressPercent}%
                  </span>
                </div>

                {/* Progress bar ekstraksi */}
                <div className="w-full h-3 rounded-full bg-black/80 border border-white/10 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 transition-all duration-300 shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                    style={{ width: `${Math.max(ext.progressPercent || 0, 2)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-4)]">
                  <span>Volume pertama: {ext.primaryArchive}</span>
                  <span className="text-blue-300/80">Otomatis siap dioper setelah 100% selesai</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 📦 2b. SECTION PENAMPUNGAN UNDUHAN BARU (STAGED / DITAMPUNG - MENUNGGU KONFIRMASI MULAI) */}
      {data.stagedPackages && data.stagedPackages.length > 0 && (
        <div className="rounded-3xl border border-teal-500/40 bg-gradient-to-r from-teal-950/40 via-zinc-950 to-emerald-950/30 p-6 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-teal-500/20">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300 text-xs font-black border border-teal-500/30">
                <Package size={17} />
              </span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <span>Tangkapan Baru Ditampung ({data.stagedPackages.length} Paket)</span>
                  <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-teal-300 border border-teal-500/30">
                    Menunggu Konfirmasi Mulai
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Tautan Click&apos;n&apos;Load atau direct download telah berhasil ditampung. Klik tombol <strong className="text-teal-300">Mulai Unduh</strong> saat Anda siap mendownload.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleStartAllStaged}
                disabled={actionState.startingAll}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:brightness-110 text-black px-4 py-2 text-xs font-black shadow-lg shadow-teal-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {actionState.startingAll ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
                <span>Mulai Semua ({data.stagedPackages.length} Paket)</span>
              </button>
            </div>
          </div>

          {/* Cards List for Staged Packages */}
          <div className="grid grid-cols-1 gap-3.5">
            {data.stagedPackages.map((pkg) => {
              const isLoading = actionState.staged[pkg.key]
              const isExpanded = !!expandedPackages[pkg.key]
              const displayItems = isExpanded ? pkg.items : (pkg.items || []).slice(0, 2)
              const remainingCount = (pkg.items?.length || 0) - displayItems.length

              return (
                <div
                  key={pkg.key}
                  className="rounded-2xl border border-teal-500/30 bg-black/60 p-4.5 space-y-3 shadow-lg hover:border-teal-400/50 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-white truncate max-w-xl">
                          📁 {pkg.packageName}
                        </span>
                        <span className="rounded-md bg-teal-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-teal-300 border border-teal-500/30">
                          {pkg.isPackage ? `${pkg.partsCount} BAGIAN RAR` : 'DIRECT STREAM'}
                        </span>
                        {pkg.password && (
                          <span
                            className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30"
                            title="Password Ekstraksi UnRAR Otomatis"
                          >
                            PW: {pkg.password}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[var(--text-3)]">
                        <span>
                          Jumlah Berkas: <strong className="text-white font-bold">{pkg.partsCount} berkas</strong>
                        </span>
                        {pkg.firstUrl && (
                          <>
                            <span>•</span>
                            <span className="text-[var(--text-4)] truncate max-w-[280px]" title={pkg.firstUrl}>
                              {pkg.firstUrl}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          pkg.isPackage
                            ? handleStartStagedPackage(pkg.packageName, pkg.key)
                            : handleStartStagedTask(pkg.items[0]?.id, pkg.packageName, pkg.key)
                        }
                        disabled={!!isLoading}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-black px-4 py-2 text-xs font-black shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                        title="Mulai mengunduh paket ini sekarang"
                      >
                        {isLoading === 'start' ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Play size={13} fill="currentColor" />
                        )}
                        <span>Mulai Unduh Sekarang</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          pkg.isPackage
                            ? handleRemoveStagedPackage(pkg.packageName, pkg.key)
                            : handleRemoveStagedTask(pkg.items[0]?.id, pkg.packageName, pkg.key)
                        }
                        disabled={!!isLoading}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-rose-500/20 text-[var(--text-3)] hover:text-rose-400 border border-white/10 hover:border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                        title="Hapus / Buang dari daftar penampungan"
                      >
                        {isLoading === 'remove' ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Preview Part List jika multi-part */}
                  {pkg.isPackage && pkg.items && pkg.items.length > 0 && (
                    <div className="rounded-xl bg-black/40 border border-white/5 p-3 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-4)] font-bold uppercase tracking-wider">
                        <span>Rincian Part ({pkg.items.length} Berkas):</span>
                        {pkg.items.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPackages((prev) => ({
                                ...prev,
                                [pkg.key]: !prev[pkg.key]
                              }))
                            }
                            className="text-teal-400 hover:underline cursor-pointer lowercase"
                          >
                            {isExpanded ? 'tutup rincian' : `lihat semua ${pkg.items.length} part`}
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {displayItems.map((it, idx) => (
                          <div key={it.id || idx} className="flex items-center justify-between text-[11px] text-zinc-300 py-0.5 border-b border-white/5 last:border-0">
                            <span className="truncate max-w-md">📄 {it.filename}</span>
                            <span className="text-teal-400/80 text-[10px] shrink-0 font-sans font-medium">Siap Diunduh</span>
                          </div>
                        ))}
                      </div>
                      {!isExpanded && remainingCount > 0 && (
                        <div className="text-[10px] text-zinc-500 pt-0.5">
                          + {remainingCount} part lainnya terdaftar rapi
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 🚀 3. HERO SECTION: SEDANG MENGUNDUH (FOCUS UTAMA DOWNLOAD MANAGER) */}
      <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 text-xs font-black">
              <Clock size={15} />
            </span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Antrean Unduhan Berjalan ({activeGroups?.length || 0})</span>
                {activeGroups?.length > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Concurrency Limit Switcher */}
            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1 text-[11px] font-mono">
              <span className="text-[var(--text-4)] px-1.5 hidden sm:inline">Batas Aktif:</span>
              <button
                type="button"
                onClick={() => handleSetConcurrency(1)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  (data.maxConcurrent || 1) === 1
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-[var(--text-3)] hover:text-white'
                }`}
                title="Unduh 1 game saja dalam satu waktu (sekuensial murni)"
              >
                1 Game
              </button>
              <button
                type="button"
                onClick={() => handleSetConcurrency(2)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  data.maxConcurrent === 2
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-[var(--text-3)] hover:text-white'
                }`}
                title="Unduh 2 game/part bersamaan"
              >
                2 Game
              </button>
              <button
                type="button"
                onClick={() => handleSetConcurrency(3)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  data.maxConcurrent === 3
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-[var(--text-3)] hover:text-white'
                }`}
                title="Unduh 3 game/part bersamaan"
              >
                3 Game
              </button>
            </div>

            {/* Quick Pause All / Resume All */}
            {data.activeItems?.length > 0 && (
              <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
                <button
                  type="button"
                  onClick={handlePauseAll}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer flex items-center gap-1"
                  title="Jeda semua unduhan aktif"
                >
                  <Pause size={11} />
                  <span className="hidden sm:inline">Jeda Semua</span>
                </button>
                <button
                  type="button"
                  onClick={handleResumeAll}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center gap-1"
                  title="Lanjutkan semua unduhan di antrean"
                >
                  <Play size={11} fill="currentColor" />
                  <span className="hidden sm:inline">Lanjut Semua</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/20 transition-all"
            >
              <Plus size={12} />
              <span>Tambah Tautan</span>
            </button>
          </div>
        </div>

        {/* List Unduhan Berjalan */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-[var(--text-4)]">
              <Loader2 size={28} className="animate-spin text-emerald-400 mb-2" />
              <span className="text-xs font-medium">Memindai proses unduhan aktif...</span>
            </div>
          ) : activeGroups?.length === 0 ? (
            /* Empty State Hero Modern */
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center flex flex-col items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mb-3 text-emerald-400">
                <DownloadCloud size={32} />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Tidak Ada Unduhan Berjalan</h4>
              <p className="text-xs text-[var(--text-4)] max-w-md leading-relaxed mb-5">
                Download Manager siap! Klik link unduh di Firefox atau tombol Click&apos;n&apos;Load di FileCrypt &mdash; otomatis didekripsi dan masuk ke sini.
              </p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer"
              >
                <Plus size={13} className="text-emerald-400" />
                <span>+ Tempel Tautan Unduhan Game</span>
              </button>
            </div>
          ) : (
            activeGroups.map((group) => {
              const isMultiPart = group.isPackage && group.partsCount > 1
              const isExpanded = !!expandedActiveGroups[group.key]
              const isPkgLoading = actionState.packageControl[group.packageName]
              const isGroupDownloading = group.status === 'downloading'
              const isGroupPaused = group.status === 'paused'
              const isGroupQueued = group.status === 'queued'
              const isGroupError = group.status === 'error'

              // ── PARENT CARD UNTUK PAKET MULTI-PART ──
              if (isMultiPart) {
                return (
                  <div
                    key={group.key}
                    className={`rounded-2xl border p-5 space-y-4 shadow-xl relative overflow-hidden transition-all ${
                      isGroupQueued
                        ? 'border-white/10 bg-black/40 opacity-85'
                        : isGroupPaused
                        ? 'border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-black/40 to-black/30'
                        : 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-black/40 to-black/30'
                    }`}
                  >
                    {/* Baris Atas Parent: Judul Game, Badge Multi-Part, Metrik & Kontrol Paket */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-white truncate max-w-[320px] sm:max-w-xl">
                            📁 {group.packageName}
                          </span>
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                            MULTI-PART ({group.partsCount} BAGIAN)
                          </span>
                          {group.activePartName && isGroupDownloading && (
                            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span>Aktif: Part {group.activePartIndex}/{group.partsCount}</span>
                            </span>
                          )}
                        </div>

                        {/* Sub-row: Detail Ukuran & Metrik Agregat */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[var(--text-3)]">
                          <span>
                            Total Terunduh: <strong className="text-white font-bold">{group.downloadedBytesFormatted || '0 B'}</strong>
                            {group.totalBytesFormatted && (
                              <span className="text-[var(--text-4)]"> / {group.totalBytesFormatted}</span>
                            )}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-400/90 font-medium">
                            {group.partsCount} Berkas Terdaftar
                          </span>
                        </div>
                      </div>

                      {/* Status Badge & Aksi Kontrol Seluruh Paket */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <div className="flex items-center gap-1.5 mr-1">
                          <span
                            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold border ${
                              isGroupQueued
                                ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                : isGroupPaused
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : isGroupError
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {isGroupDownloading && <Loader2 size={11} className="animate-spin text-emerald-400" />}
                            {isGroupPaused && <Pause size={10} className="text-amber-400" />}
                            {isGroupError && <AlertTriangle size={10} className="text-rose-400" />}
                            {isGroupQueued && <Clock size={10} className="text-zinc-400" />}
                            <span>{group.statusText || 'Sedang Mengunduh'}</span>
                          </span>

                          <span className="text-base font-mono font-black text-emerald-400 min-w-[54px] text-right">
                            {group.progressPercent || 0}%
                          </span>
                        </div>

                        {/* Tombol Kontrol Paket (Jeda Semua Part / Lanjut Semua Part) */}
                        <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-xl p-1">
                          {isGroupPaused || isGroupError ? (
                            <button
                              type="button"
                              onClick={() => handlePackageControl('resume_package', group.packageName)}
                              disabled={!!isPkgLoading}
                              className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2.5 text-xs font-bold border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                              title="Lanjutkan seluruh part paket ini"
                            >
                              {isPkgLoading === 'resume_package' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                              <span>Lanjut Paket</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePackageControl('pause_package', group.packageName)}
                              disabled={!!isPkgLoading}
                              className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 text-xs font-bold border border-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
                              title="Jeda seluruh part paket ini"
                            >
                              {isPkgLoading === 'pause_package' ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} fill="currentColor" />}
                              <span>Jeda Paket</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handlePackageControl('cancel_package', group.packageName)}
                            disabled={!!isPkgLoading}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                            title="Batalkan dan buang seluruh part paket ini"
                          >
                            {isPkgLoading === 'cancel_package' ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} fill="currentColor" />}
                          </button>
                        </div>

                        {/* Tombol Toggle Accordion Child */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedActiveGroups((prev) => ({
                              ...prev,
                              [group.key]: !prev[group.key]
                            }))
                          }
                          className="flex h-8 items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
                          title={isExpanded ? 'Tutup rincian part' : 'Buka rincian part'}
                        >
                          <ChevronDown size={14} className={`text-teal-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          <span>{isExpanded ? 'Tutup Part' : `Lihat ${group.partsCount} Part`}</span>
                        </button>
                      </div>
                    </div>

                    {/* High-Contrast Dynamic Progress Bar Keseluruhan Paket */}
                    <div className="space-y-1.5">
                      <div className="w-full h-3 rounded-full bg-black/80 border border-white/10 overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ease-out ${
                            isGroupQueued
                              ? 'bg-zinc-600'
                              : isGroupPaused
                              ? 'bg-amber-500'
                              : isGroupError
                              ? 'bg-rose-500'
                              : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                          }`}
                          style={{
                            width: `${Math.max(group.progressPercent || 0, 1.5)}%`
                          }}
                        />
                      </div>

                      {/* Live Speed, ETA & Disk Metrics */}
                      <div className="flex items-center justify-between text-xs font-mono text-[var(--text-3)] px-1">
                        <div className="flex items-center gap-3">
                          {group.downloadSpeedFormatted ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <Zap size={12} />
                              <span>{group.downloadSpeedFormatted}</span>
                            </span>
                          ) : (
                            <span className="text-[var(--text-4)] text-[11px]">
                              {isGroupQueued ? 'Menunggu giliran antrean...' : isGroupPaused ? 'Unduhan Dijeda' : 'Menghitung kecepatan...'}
                            </span>
                          )}

                          {group.etaFormatted && (
                            <span className="text-amber-300 font-medium text-[11px]">
                              ⏱️ {group.etaFormatted}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-4)]">
                          <span>{group.partsCount} Bagian Part Berkas</span>
                        </div>
                      </div>

                      {/* Pesan Keterangan Kegagalan jika Ada Part yang Error */}
                      {isGroupError && group.error && (
                        <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300 font-mono">
                          <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-0.5">
                            <span className="font-bold text-rose-200">Penyebab Gagal: </span>
                            <span>{group.error}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── CHILD PARTS LIST (ACCORDION) ── */}
                    {isExpanded && (
                      <div className="rounded-2xl bg-black/60 border border-white/10 p-3.5 space-y-2 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 pb-1.5 border-b border-white/5 uppercase tracking-wider font-mono">
                          <span>Rincian Tiap Part Berkas:</span>
                          <span className="text-teal-400 lowercase">{group.partsCount} berkas</span>
                        </div>

                        <div className="space-y-2 pt-1">
                          {group.items.map((item, idx) => {
                            const isTaskLoading = actionState.taskControl[item.id]
                            const isItemPaused = item.status === 'paused'
                            const isItemError = item.status === 'error'
                            const isItemQueued = item.status === 'queued'
                            const isItemDownloading = item.status === 'downloading'
                            const isItemCompleted = item.status === 'completed'

                            return (
                              <div
                                key={item.id || idx}
                                className="rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 p-3 space-y-2 transition-all font-mono"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-white font-bold truncate max-w-sm sm:max-w-md">
                                        📄 {item.folderName}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                          isItemDownloading
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                            : isItemPaused
                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                            : isItemCompleted
                                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                        }`}
                                      >
                                        {item.statusText || item.status}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                      <span>
                                        {item.downloadedBytesFormatted || '0 B'} / {item.targetBytesFormatted || item.totalSizeFormatted}
                                      </span>
                                      {item.downloadSpeedFormatted && (
                                        <>
                                          <span>•</span>
                                          <span className="text-emerald-400">{item.downloadSpeedFormatted}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Part Controls & Percent */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-bold text-emerald-400 text-xs min-w-[38px] text-right">
                                      {item.progressPercent || 0}%
                                    </span>

                                    {item.isNativeStream && item.id && (
                                      <div className="flex items-center gap-1 bg-black/40 border border-white/5 rounded-lg p-0.5">
                                        {isItemPaused || isItemError ? (
                                          <button
                                            type="button"
                                            onClick={() => handleTaskControl('resume', item.id, item.folderName)}
                                            disabled={!!isTaskLoading}
                                            className="h-6 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                            title="Lanjutkan part ini"
                                          >
                                            {isTaskLoading === 'resume' ? <Loader2 size={10} className="animate-spin" /> : <Play size={9} fill="currentColor" />}
                                            <span>Lanjut</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleTaskControl('pause', item.id, item.folderName)}
                                            disabled={!!isTaskLoading}
                                            className="h-6 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                            title="Jeda part ini"
                                          >
                                            {isTaskLoading === 'pause' ? <Loader2 size={10} className="animate-spin" /> : <Pause size={9} fill="currentColor" />}
                                            <span>Jeda</span>
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleTaskControl('cancel', item.id, item.folderName)}
                                          disabled={!!isTaskLoading}
                                          className="h-6 w-6 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center"
                                          title="Batalkan part ini"
                                        >
                                          {isTaskLoading === 'cancel' ? <Loader2 size={10} className="animate-spin" /> : <Square size={9} fill="currentColor" />}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Miniature Progress Bar Per Part */}
                                <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-200 ${
                                      isItemDownloading
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                        : isItemPaused
                                        ? 'bg-amber-500'
                                        : isItemCompleted
                                        ? 'bg-teal-400'
                                        : 'bg-zinc-700'
                                    }`}
                                    style={{ width: `${Math.max(item.progressPercent || 0, 1)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              // ── STANDALONE CARD UNTUK SINGLE FILE (NON MULTI-PART) ──
              const item = group.items[0] || group
              const isTaskLoading = actionState.taskControl[item.id]
              const isPaused = item.status === 'paused'
              const isError = item.status === 'error'
              const isQueued = item.status === 'queued'

              return (
                <div
                  key={item.id || item.folderName}
                  className={`rounded-2xl border p-5 space-y-4 shadow-xl relative overflow-hidden transition-all ${
                    isQueued
                      ? 'border-white/10 bg-black/40 opacity-80'
                      : 'border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-black/40 to-black/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-white truncate max-w-[320px] sm:max-w-xl">
                          📁 {item.folderName}
                        </span>
                        {item.displayBadge && (
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                            {item.displayBadge}
                          </span>
                        )}
                        {item.activePartName && (
                          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30">
                            📦 {item.activePartName}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[var(--text-3)]">
                        <span>
                          Terunduh: <strong className="text-white font-bold">{item.downloadedBytesFormatted || item.totalSizeFormatted}</strong>
                          {item.targetBytesFormatted && item.targetBytesFormatted !== item.downloadedBytesFormatted && (
                            <span className="text-[var(--text-4)]"> / {item.targetBytesFormatted}</span>
                          )}
                        </span>
                        {item.url && (
                          <>
                            <span>•</span>
                            <span className="text-[var(--text-4)] truncate max-w-[200px]" title={item.url}>
                              {item.url}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 mr-2">
                        <span
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold border ${
                            isQueued
                              ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                              : isPaused
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : isError
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {!isPaused && !isError && !isQueued && <Loader2 size={11} className="animate-spin text-emerald-400" />}
                          {isPaused && <Pause size={10} className="text-amber-400" />}
                          {isError && <AlertTriangle size={10} className="text-rose-400" />}
                          {isQueued && <Clock size={10} className="text-zinc-400" />}
                          <span>{item.statusText || 'Mengunduh'}</span>
                        </span>

                        <span className="text-base font-mono font-black text-emerald-400 min-w-[54px] text-right">
                          {item.progressPercent || 0}%
                        </span>
                      </div>

                      {item.isNativeStream && item.id && (
                        <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-xl p-1">
                          {isPaused || isError ? (
                            <button
                              type="button"
                              onClick={() => handleTaskControl('resume', item.id, item.folderName)}
                              disabled={!!isTaskLoading}
                              className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2.5 text-xs font-bold border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                              title="Lanjutkan unduhan"
                            >
                              {isTaskLoading === 'resume' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                              <span>Lanjut</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTaskControl('pause', item.id, item.folderName)}
                              disabled={!!isTaskLoading}
                              className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 text-xs font-bold border border-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
                              title="Jeda sementara unduhan"
                            >
                              {isTaskLoading === 'pause' ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} fill="currentColor" />}
                              <span>Jeda</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleTaskControl('cancel', item.id, item.folderName)}
                            disabled={!!isTaskLoading}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                            title="Batalkan dan hapus unduhan ini"
                          >
                            {isTaskLoading === 'cancel' ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} fill="currentColor" />}
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenFolder(item.fullPath || data.targetDir)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[var(--text-3)] hover:text-white transition-all cursor-pointer"
                        title="Buka di Windows Explorer"
                      >
                        <FolderOpen size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="w-full h-3 rounded-full bg-black/80 border border-white/10 overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                          isQueued
                            ? 'bg-zinc-600'
                            : isPaused
                            ? 'bg-amber-500'
                            : isError
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                        }`}
                        style={{
                          width: `${Math.max(item.progressPercent || 0, 1.5)}%`
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-[var(--text-3)] px-1">
                      <div className="flex items-center gap-3">
                        {item.downloadSpeedFormatted ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <Zap size={12} />
                            <span>{item.downloadSpeedFormatted}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--text-4)] text-[11px]">
                            {isQueued ? 'Menunggu giliran antrean...' : isPaused ? 'Unduhan Dijeda' : 'Menghitung kecepatan...'}
                          </span>
                        )}

                        {item.etaFormatted && (
                          <span className="text-amber-300 font-medium text-[11px]">
                            ⏱️ {item.etaFormatted}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-4)]">
                        {item.error ? (
                          <span className="text-rose-400 font-bold">{item.error}</span>
                        ) : (
                          <span>File part: {item.fileCount || 1} berkas</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 📦 4. SECTION UNDUHAN SELESAI (SIAP DIOPER KE WORKBENCH) */}
      <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-black">
              <CheckCircle2 size={15} />
            </span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Unduhan Selesai & Siap Dioper ke Workbench ({data.readyItems?.length || 0})
              </h3>
            </div>
          </div>

          {/* Filter Tabs & Tombol Navigasi ke Workbench */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setReadyFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  readyFilter === 'pending'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-[var(--text-4)] hover:text-emerald-400'
                }`}
                title="Tampilkan hanya game yang belum dioper"
              >
                Belum Dioper ({pendingReadyItems.length})
              </button>
              <button
                type="button"
                onClick={() => setReadyFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  readyFilter === 'all'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-[var(--text-4)] hover:text-white'
                }`}
                title="Tampilkan seluruh game selesai"
              >
                Semua ({data.readyItems?.length || 0})
              </button>
              {transferredReadyItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReadyFilter('transferred')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    readyFilter === 'transferred'
                      ? 'bg-zinc-700 text-white shadow-sm'
                      : 'text-[var(--text-4)] hover:text-white'
                  }`}
                  title="Tampilkan game yang sudah berhasil dioper"
                >
                  Sudah Dioper ({transferredReadyItems.length})
                </button>
              )}
            </div>

            <Link
              href="/workbench"
              className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1.5 cursor-pointer bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10 transition-all"
            >
              <span>Buka Workbench</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* List Berkas Selesai */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-[var(--text-4)]">
              <Loader2 size={24} className="animate-spin text-emerald-400 mb-2" />
              <span className="text-xs font-medium">Memindai hasil unduhan...</span>
            </div>
          ) : data.readyItems?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-[var(--text-4)] rounded-2xl border border-dashed border-white/10 bg-black/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 mb-2 text-emerald-400/50">
                <Package size={24} />
              </div>
              <p className="text-xs font-bold text-[var(--text-2)]">Belum ada unduhan selesai</p>
              <p className="text-[11px] text-[var(--text-4)] mt-1 max-w-sm leading-relaxed">
                Game atau berkas arsip yang telah selesai diunduh 100% akan otomatis muncul di sini dan siap diekstrak atau dioperkan ke Workbench dalam 1-klik.
              </p>
            </div>
          ) : displayedReadyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center p-6 text-[var(--text-4)] rounded-2xl border border-dashed border-white/10 bg-black/10">
              <CheckCircle2 size={24} className="text-emerald-400 mb-2" />
              <p className="text-xs font-bold text-white">Seluruh unduhan selesai sudah dioper ke Workbench!</p>
              <p className="text-[11px] text-[var(--text-4)] mt-1">
                Gunakan filter &quot;Semua&quot; di atas untuk meninjau kembali berkas mentahan, atau lanjutkan pekerjaan di Workbench.
              </p>
              <button
                type="button"
                onClick={() => setReadyFilter('all')}
                className="mt-3 text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                Tampilkan Semua Unduhan Selesai ({data.readyItems.length})
              </button>
            </div>
          ) : (
            displayedReadyItems.map((item) => {
              const isItemLoading = actionState.handoff[item.folderName]
              const isTransferred = item.status === 'transferred' || actionState.handoffDone[item.folderName]
              const isExtractingThis = actionState.extracting[item.fullPath]

              return (
                <div
                  key={item.folderName}
                  className={`rounded-2xl border p-4 transition-all shadow-md ${
                    isTransferred
                      ? 'border-white/10 bg-black/30 opacity-75'
                      : 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-black/40 to-black/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setInspectFolder({ folderName: item.folderName, folderPath: item.fullPath, type: 'download' })}
                          className="font-black text-sm text-white truncate max-w-[280px] sm:max-w-md text-left hover:text-amber-300 hover:underline cursor-pointer group"
                          title="Klik untuk membuka & melihat isi berkas"
                        >
                          {item.folderName}
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-amber-400 ml-1.5 font-normal">(Buka Isi)</span>
                        </button>

                        {item.packageType === 'ISO' || item.hasIso ? (
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <span>💿 DISC IMAGE (.ISO)</span>
                            <span className="rounded bg-amber-400/20 px-1 text-[8px] text-amber-200">Perlu Pasang</span>
                          </span>
                        ) : item.packageType === 'REPACK' ? (
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30">
                            📦 REPACK SETUP
                          </span>
                        ) : (
                          <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-purple-300 border border-purple-500/30">
                            ⚡ PRE-INSTALLED
                          </span>
                        )}
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/20">
                          🛡️ Auto-Sanitize & Brand
                        </span>
                        {item.isInstalledInStudio ? (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-300 border border-emerald-500/40">
                            ✓ TERPASANG DI WORKBENCH ({item.installedSizeFormatted || 'Siap Upload'})
                          </span>
                        ) : isTransferred ? (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                            ✓ SUDAH DI WORKBENCH
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-4)]">
                        <span>Ukuran: <strong className="text-emerald-300">{item.totalSizeFormatted}</strong></span>
                        <span>•</span>
                        <span>{item.fileCount} berkas</span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setInspectFolder({ folderName: item.folderName, folderPath: item.fullPath, type: 'download' })}
                          className="text-amber-400 hover:brightness-125 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                          title="Buka & jelajahi rincian file"
                        >
                          <FolderOpen size={11} /> Lihat Isi
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => handleOpenFolder(item.fullPath)}
                          className="text-[var(--text-4)] hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Explorer
                        </button>
                      </div>
                    </div>

                    {/* Tombol Handoff / Install / Extract Action */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInspectFolder({ folderName: item.folderName, folderPath: item.fullPath, type: 'download' })}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-[var(--text-2)] hover:text-white transition-all cursor-pointer"
                        title="Buka & lihat isi folder"
                      >
                        <FolderOpen size={13} className="text-amber-400" />
                        <span className="hidden sm:inline">Buka Isi</span>
                      </button>

                      {/* Tombol Ekstrak Manual UnRAR jika masih berupa arsip RAR/Part */}
                      {(item.hasRar || item.hasPartFiles || item.completedPartsCount > 0) && !item.isInstalledInStudio && (
                        <button
                          type="button"
                          onClick={() => handleManualExtract(item.fullPath, item.cleanTitle, item.password)}
                          disabled={isExtractingThis}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/15 hover:bg-blue-500/25 px-3 py-2 text-xs font-bold text-blue-300 transition-all cursor-pointer disabled:opacity-50"
                          title="Ekstrak arsip RAR multi-part menggunakan WinRAR native"
                        >
                          {isExtractingThis ? (
                            <Loader2 size={13} className="animate-spin text-blue-400" />
                          ) : (
                            <Package size={13} className="text-blue-400" />
                          )}
                          <span>Ekstrak UnRAR</span>
                        </button>
                      )}

                      {item.isInstalledInStudio ? (
                        <div className="flex items-center gap-2">
                          <Link
                            href="/workbench"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all cursor-pointer shadow-sm"
                          >
                            <span>Lihat di Workbench</span>
                            <ArrowRight size={13} />
                          </Link>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRaw(item)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-300 transition-all cursor-pointer"
                            title="Hapus berkas mentahan unduhan ini untuk menghemat ruang disk"
                          >
                            <Trash2 size={13} className="text-rose-400" />
                            <span>Hapus Mentahan</span>
                          </button>
                        </div>
                      ) : isTransferred ? (
                        <div className="flex items-center gap-2">
                          {(item.packageType === 'ISO' || item.hasIso) && (
                            <button
                              type="button"
                              onClick={() => setWizardFolder(item.folderName)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-3.5 py-2 text-xs font-black text-black hover:brightness-110 shadow-md transition-all cursor-pointer"
                            >
                              <Play size={13} />
                              <span>💿 Pasang Game ke Pre-Installed</span>
                            </button>
                          )}
                          <Link
                            href="/workbench"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all cursor-pointer shadow-sm"
                          >
                            <span>Lihat di Workbench</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {(item.packageType === 'ISO' || item.hasIso) ? (
                            <button
                              type="button"
                              onClick={() => setWizardFolder(item.folderName)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2.5 text-xs font-black text-black hover:brightness-110 shadow-md transition-all cursor-pointer"
                            >
                              <Play size={14} />
                              <span>💿 Pasang Game ke Pre-Installed</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleHandoff(item.folderName, 'new')}
                              disabled={isItemLoading}
                              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2.5 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                              title="Pindahkan folder game bersih & pre-installed ke Workbench untuk di-upload"
                            >
                              {isItemLoading ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Zap size={14} />
                              )}
                              <span>🚀 Oper ke Workbench</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 📜 5. RIWAYAT OPER KE WORKBENCH (KOMPAK & DAPAT DILIPAT) */}
      {data.historyItems?.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-black/20 p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="text-xs font-black uppercase tracking-wider text-[var(--text-3)] hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
            >
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Riwayat Pengoperan Game ({data.historyItems.length})</span>
              <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isHistoryExpanded ? 'rotate-180' : ''}`} />
            </button>
            <Link href="/workbench" className="text-[10px] font-mono text-emerald-400 hover:underline flex items-center gap-1">
              <span>Ke Workbench</span>
              <ArrowRight size={10} />
            </Link>
          </div>

          {isHistoryExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-white/5 animate-in fade-in duration-200">
              {data.historyItems.slice(0, 9).map((h) => (
                <div key={h.id} className="rounded-xl border border-white/5 bg-black/40 p-3 text-xs space-y-1">
                  <button
                    type="button"
                    onClick={() => setInspectFolder({ folderName: h.folderName, folderPath: h.targetPath, type: 'upload' })}
                    className="font-bold text-white block truncate text-left hover:text-amber-300 hover:underline cursor-pointer w-full"
                    title="Klik untuk melihat isi folder"
                  >
                    {h.cleanTitle || h.folderName}
                  </button>
                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-4)]">
                    <span>{h.sizeFormatted}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectFolder({ folderName: h.folderName, folderPath: h.targetPath, type: 'upload' })}
                        className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FolderOpen size={10} /> Lihat Isi
                      </button>
                      <span className="text-emerald-400">Telah Terkirim</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 📥 Modal Tambah Tautan Unduhan Manual */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Link2 size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-black uppercase text-white">Tambah Tautan Unduhan</h3>
                  <p className="text-[11px] text-[var(--text-4)]">Mulai mengunduh langsung dari direct link web game</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[var(--text-4)] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddManualDownload} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[var(--text-3)] mb-1.5">
                  URL Unduhan Langsung (Direct Link) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://... (Buzzheavier, Gofile, SteamRIP, Direct HTTP)"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[var(--text-3)] mb-1.5">
                  Nama Berkas (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: EldenRing.rar (biarkan kosong untuk auto-detect)"
                  value={manualFilename}
                  onChange={(e) => setManualFilename(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Opsi Mode: Tampung Dulu vs Langsung Unduh */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!manualAutoStart}
                    onChange={(e) => setManualAutoStart(!e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/20 bg-zinc-900"
                  />
                  <div className="text-xs space-y-0.5">
                    <span className="font-bold text-white block">Tampung Dulu di Antrean (Staging)</span>
                    <span className="text-[11px] text-[var(--text-4)] block leading-relaxed">
                      Tautan tidak langsung mendownload, melainkan ditampung terlebih dahulu sampai Anda menekan tombol Mulai.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionState.addingDownload || !manualUrl.trim()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-2 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionState.addingDownload ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : manualAutoStart ? (
                    <DownloadCloud size={13} />
                  ) : (
                    <Package size={13} />
                  )}
                  <span>{manualAutoStart ? 'Mulai Unduh Sekarang' : 'Tampung di Antrean'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚡ Asisten Game Pre-Installed Modal */}
      <PreInstalledWizardModal
        isOpen={!!wizardFolder}
        folderName={wizardFolder}
        onClose={() => setWizardFolder(null)}
        onSuccess={() => {
          fetchStatus(true)
          setWizardFolder(null)
          toast('Game berhasil dimatangkan ke format Pre-Installed! Siap diunggah.', 'success')
        }}
      />

      {/* 📂 Inspeksi Isi Folder Lokal (Multi-Part RAR, ISO, dsb.) */}
      <LocalFolderInspectModal
        isOpen={!!inspectFolder}
        folderName={inspectFolder?.folderName}
        folderPath={inspectFolder?.folderPath}
        type={inspectFolder?.type || 'download'}
        onClose={() => setInspectFolder(null)}
        onLaunchWizard={(folderName) => {
          setWizardFolder(folderName)
        }}
        onHandoff={inspectFolder?.type === 'download' ? (folderName) => handleHandoff(folderName, 'new') : null}
      />

      {/* 🗑️ Dialog Konfirmasi Hapus Mentahan Manual */}
      <ConfirmDialog
        open={!!confirmDeleteRaw}
        title={`Hapus Berkas Mentahan ${confirmDeleteRaw?.folderName}?`}
        description={`Berkas mentahan (${confirmDeleteRaw?.totalSizeFormatted}) di GameDownload akan dihapus permanen. Folder game Anda sudah terpasang rapi di Workbench (${confirmDeleteRaw?.installedSizeFormatted || ''}) dan siap diarsip/diunggah ke Google Drive.`}
        confirmLabel="Ya, Hapus Mentahan"
        cancelLabel="Simpan Mentahan"
        tone="danger"
        loading={actionState.deletingRaw}
        onConfirm={() => handleDeleteRaw(confirmDeleteRaw?.folderName)}
        onClose={() => setConfirmDeleteRaw(null)}
      />

      {/* ⚡ Modal Konfirmasi & Password Ekstrak UnRAR */}
      {extractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Package size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-black uppercase text-white">Ekstrak Arsip UnRAR</h3>
                  <p className="text-[11px] text-[var(--text-4)]">Mengekstrak berkas multi-part menjadi folder game</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtractModal(null)}
                className="text-[var(--text-4)] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-black/40 border border-white/5 p-3 text-xs font-mono space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block">Paket Game:</span>
                <span className="text-white font-bold block truncate">{extractModal.packageName}</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[var(--text-3)] mb-1.5">
                  Password Arsip (Jika Terenkripsi)
                </label>
                <input
                  type="text"
                  placeholder="Misal: mygameon atau www.ovagames.com"
                  value={extractModal.password}
                  onChange={(e) => setExtractModal({ ...extractModal, password: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none font-mono"
                  autoFocus
                />
                {/* Quick Password Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  <span className="text-[10px] text-zinc-500 font-mono">Pilihan Cepat:</span>
                  {[
                    { label: 'www.ovagames.com', val: 'www.ovagames.com' },
                    { label: 'mygameon', val: 'mygameon' },
                    { label: 'fitgirl', val: 'fitgirl-repacks.site' },
                    { label: '(Tanpa Password)', val: '' }
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setExtractModal((prev) => ({ ...prev, password: chip.val }))}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
                        extractModal.password === chip.val
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm'
                          : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-white/5">
              <button
                type="button"
                onClick={() => setExtractModal(null)}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleExecuteExtract(extractModal.folderPath, extractModal.packageName, extractModal.password)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2 text-xs font-black text-white hover:brightness-110 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Play size={13} fill="currentColor" />
                <span>Mulai Ekstraksi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
