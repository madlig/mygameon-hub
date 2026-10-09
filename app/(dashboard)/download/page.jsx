'use client'

import { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react'
import Link from 'next/link'
import {
  DownloadCloud, HardDrive, RefreshCw, FolderOpen, Play,
  CheckCircle2, Clock, Loader2, ArrowRight, Zap, AlertTriangle,
  Package, FileCode, Check, Layers, ChevronRight, ChevronDown,
  Sparkles, Trash2, Pause, Square, Plus, Link2, X, Globe, Radio
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import PreInstalledWizardModal from '@/components/studio/PreInstalledWizardModal'
import LocalFolderInspectModal from '@/components/files/LocalFolderInspectModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import DownloadHeader from '@/components/download/DownloadHeader'
import ActiveDownloadItem from '@/components/download/ActiveDownloadItem'
import StagedSection from '@/components/download/StagedSection'
import GamePipelineCard from '@/components/download/GamePipelineCard'
import { formatSpeed } from '@/lib/utils'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { useToast } from '@/components/ui/Toast'

const initialActionState = {
  handoff: {},
  handoffDone: {},
  taskControl: {},
  extracting: {},
  staged: {},
  startingAll: false,
  packageControl: {},
  launchingJd: false,
  deletingRaw: false,
  cleaningRar: {},
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
    case 'SET_CLEANING_RAR':
      return { ...state, cleaningRar: { ...state.cleaningRar, [action.key]: action.value } }
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
    activeGroups: [],
    readyItems: [],
    historyItems: [],
    streamTasks: [],
    stagedPackages: [],
    stagedItems: [],
    activeExtractions: [],
    cnlStatus: { running: false, port: 9666, error: null },
    diskSpace: null
  })

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [wizardFolder, setWizardFolder] = useState(null)
  const [inspectFolder, setInspectFolder] = useState(null)
  const [confirmDeleteRaw, setConfirmDeleteRaw] = useState(null)
  const [confirmCleanRar, setConfirmCleanRar] = useState(null)
  const [extractModal, setExtractModal] = useState(null)

  // Staging / Penampungan
  const [expandedActiveGroups, setExpandedActiveGroups] = useState({})

  // Modal Tambah Tautan Manual
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [manualFilename, setManualFilename] = useState('')
  const [manualAutoStart, setManualAutoStart] = useState(false)
  const pollErrorCount = useRef(0)

  // Filter List Pemrosesan Game
  const [readyFilter, setReadyFilter] = useState('all') // 'all' | 'pending' | 'installed'
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)

  // ── 1. Polling Status ──
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
      }
    } catch (err) {
      pollErrorCount.current += 1
      if (!isSilent) toast({ title: 'Gagal memuat status unduhan', description: err.message, variant: 'error' })
    } finally {
      if (!isSilent) setRefreshing(false)
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(() => {
      fetchStatus(true)
    }, 2500)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Navigation Guard: Peringatkan jika ada unduhan atau ekstraksi aktif saat pindah tab
  const hasActiveDownloads = (data.activeItems?.length || 0) > 0 || (data.activeExtractions?.length || 0) > 0
  useNavigationGuard(hasActiveDownloads, 'Unduhan atau pemrosesan game sedang berjalan di latar belakang.')

  // Total Kecepatan Unduh
  const totalSpeedFormatted = useMemo(() => {
    const totalBytesPerSec = (data.activeItems || []).reduce((acc, cur) => acc + (cur.downloadSpeed || 0), 0)
    if (totalBytesPerSec <= 0) return null
    return `${formatSpeed(totalBytesPerSec)}/s`
  }, [data.activeItems])

  // ── 2. Handlers Kontrol Unduhan ──
  async function handleTakeoverPort() {
    dispatchAction({ type: 'SET_LAUNCHING_JD', value: true })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'takeover_cnl_port' })
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Port 9666 Diambil Alih', description: 'MyGameON kini menjadi penangkap Click\'n\'Load aktif.', variant: 'success' })
        fetchStatus(true)
      } else {
        toast({ title: 'Gagal Mengambil Alih Port', description: json.error, variant: 'error' })
      }
    } catch (err) {
      toast({ title: 'Kesalahan Sistem', description: err.message, variant: 'error' })
    } finally {
      dispatchAction({ type: 'SET_LAUNCHING_JD', value: false })
    }
  }

  async function handlePauseTask(taskId) {
    dispatchAction({ type: 'SET_TASK_CONTROL', key: taskId, value: 'pause' })
    try {
      await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause_task', taskId })
      })
      fetchStatus(true)
    } catch (_) {}
    finally {
      dispatchAction({ type: 'SET_TASK_CONTROL', key: taskId, value: null })
    }
  }

  async function handleResumeTask(taskId) {
    dispatchAction({ type: 'SET_TASK_CONTROL', key: taskId, value: 'resume' })
    try {
      await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume_task', taskId })
      })
      fetchStatus(true)
    } catch (_) {}
    finally {
      dispatchAction({ type: 'SET_TASK_CONTROL', key: taskId, value: null })
    }
  }

  async function handleCancelTask(taskId) {
    dispatchAction({ type: 'SET_TASK_CONTROL', key: taskId, value: 'cancel' })
    try {
      await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_task', taskId })
      })
      fetchStatus(true)
    } catch (_) {}
    finally {
      dispatchAction({ type: 'SET_TASK_CONTROL', key: taskId, value: null })
    }
  }

  async function handleStartStagedPackage(key) {
    dispatchAction({ type: 'SET_STAGED', key, value: 'start' })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_staged', packageKey: key })
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Unduhan Dimulai', description: 'Paket berhasil masuk ke antrean unduh aktif.', variant: 'success' })
        fetchStatus(true)
      }
    } catch (_) {}
    finally {
      dispatchAction({ type: 'SET_STAGED', key, value: null })
    }
  }

  async function handleRemoveStagedPackage(key) {
    dispatchAction({ type: 'SET_STAGED', key, value: 'remove' })
    try {
      await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_staged', packageKey: key })
      })
      fetchStatus(true)
    } catch (_) {}
    finally {
      dispatchAction({ type: 'SET_STAGED', key, value: null })
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
        toast({ title: 'Semua Paket Dimulai', description: `${json.startedCount || 0} tugas berhasil dimasukkan ke antrean.`, variant: 'success' })
        fetchStatus(true)
      }
    } catch (_) {}
    finally {
      dispatchAction({ type: 'SET_STARTING_ALL', value: false })
    }
  }

  // ── 3. Handlers Ekstraksi UnRAR ──
  async function handleManualExtract(folderPath, packageName, password) {
    if (!password) {
      const defaultPwd = packageName?.toLowerCase().includes('ova') ? 'www.ovagames.com' : 'mygameon'
      setExtractModal({ folderPath, packageName, password: defaultPwd })
      return
    }

    dispatchAction({ type: 'SET_EXTRACTING', key: folderPath, value: true })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract_archive', folderPath, packageName, password })
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Ekstraksi Dimulai', description: `Mengekstrak ${packageName} di latar belakang.`, variant: 'success' })
        fetchStatus(true)
      } else {
        toast({ title: 'Gagal Memulai Ekstraksi', description: json.error, variant: 'error' })
      }
    } catch (err) {
      toast({ title: 'Kesalahan Sistem', description: err.message, variant: 'error' })
    } finally {
      dispatchAction({ type: 'SET_EXTRACTING', key: folderPath, value: false })
      setExtractModal(null)
    }
  }

  // ── 4. Handlers Pembersihan Ruang Disk ──
  async function handleConfirmCleanRar() {
    if (!confirmCleanRar) return
    const item = confirmCleanRar
    const folderKey = item.folderName
    dispatchAction({ type: 'SET_CLEANING_RAR', key: folderKey, value: true })

    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_rar_parts', folderPath: item.fullPath })
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Ruang Harddisk Berhasil Dibebaskan!',
          description: `${json.deletedCount} file part RAR dihapus (~${json.freedSizeFormatted} kapasitas dibebaskan).`,
          variant: 'success'
        })
        setConfirmCleanRar(null)
        fetchStatus(true)
      } else {
        toast({ title: 'Gagal Membersihkan Part RAR', description: json.error, variant: 'error' })
      }
    } catch (err) {
      toast({ title: 'Kesalahan Sistem', description: err.message, variant: 'error' })
    } finally {
      dispatchAction({ type: 'SET_CLEANING_RAR', key: folderKey, value: false })
    }
  }

  async function handleConfirmDeleteRaw() {
    if (!confirmDeleteRaw) return
    const item = confirmDeleteRaw
    dispatchAction({ type: 'SET_DELETING_RAW', value: true })

    try {
      const res = await fetch('/api/installer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_raw_folder', folderName: item.folderName })
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Berkas Mentahan Berhasil Dihapus',
          description: `Folder mentah ${item.cleanTitle || item.folderName} dihapus. Ruang disk bertambah lega.`,
          variant: 'success'
        })
        setConfirmDeleteRaw(null)
        fetchStatus(true)
      } else {
        toast({ title: 'Gagal Menghapus Mentahan', description: json.error, variant: 'error' })
      }
    } catch (err) {
      toast({ title: 'Kesalahan Sistem', description: err.message, variant: 'error' })
    } finally {
      dispatchAction({ type: 'SET_DELETING_RAW', value: false })
    }
  }

  // ── 5. Handlers Handoff & Folder Explorer ──
  async function handleHandoff(folderName, targetMode = 'new') {
    dispatchAction({ type: 'SET_HANDOFF', key: folderName, value: true })
    try {
      const res = await fetch('/api/download/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName, targetMode })
      })
      const json = await res.json()
      if (json.success) {
        dispatchAction({ type: 'SET_HANDOFF_DONE', key: folderName, value: true })
        toast({ title: 'Sukses Dioper ke Workbench', description: `Folder ${folderName} kini siap dipersiapkan di Studio Workbench.`, variant: 'success' })
        fetchStatus(true)
      } else {
        toast({ title: 'Gagal Mengoper Folder', description: json.error, variant: 'error' })
      }
    } catch (err) {
      toast({ title: 'Kesalahan Sistem', description: err.message, variant: 'error' })
    } finally {
      dispatchAction({ type: 'SET_HANDOFF', key: folderName, value: false })
    }
  }

  async function handleOpenFolder(folderPath) {
    try {
      await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_folder', folderPath })
      })
    } catch (err) {
      toast({ title: 'Gagal membuka folder', description: err.message, variant: 'error' })
    }
  }

  function handleOpenGameSource(e, url, title) {
    if (typeof window !== 'undefined' && window.electronAPI?.openExternalBrowser) {
      e.preventDefault()
      window.electronAPI.openExternalBrowser(url)
      toast({ title: `Membuka ${title}`, description: 'Membuka situs web di browser resmi Anda.', variant: 'success' })
    }
  }

  // ── 6. Tambah Tautan Manual ──
  async function handleAddDownload(e) {
    if (e) e.preventDefault()
    if (!manualUrl.trim()) return

    dispatchAction({ type: 'SET_ADDING_DOWNLOAD', value: true })
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_stream_download',
          url: manualUrl.trim(),
          filename: manualFilename.trim() || undefined,
          autoStart: manualAutoStart
        })
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Tautan Berhasil Ditambahkan', description: manualAutoStart ? 'Unduhan langsung dimulai di antrean.' : 'Tautan disimpan di penampungan staged.', variant: 'success' })
        setManualUrl('')
        setManualFilename('')
        setIsAddModalOpen(false)
        fetchStatus(true)
      } else {
        toast({ title: 'Gagal Menambahkan Tautan', description: json.error, variant: 'error' })
      }
    } catch (err) {
      toast({ title: 'Kesalahan Sistem', description: err.message, variant: 'error' })
    } finally {
      dispatchAction({ type: 'SET_ADDING_DOWNLOAD', value: false })
    }
  }

  // Filter Catalog Items
  const displayedCatalogItems = useMemo(() => {
    const list = data.readyItems || []
    if (readyFilter === 'pending') {
      return list.filter((i) => !i.isInstalledInStudio && i.status !== 'transferred')
    }
    if (readyFilter === 'installed') {
      return list.filter((i) => i.isInstalledInStudio || i.status === 'transferred')
    }
    return list
  }, [data.readyItems, readyFilter])

  return (
    <div className="min-h-screen bg-[var(--bg-1)] flex flex-col">
      <TopBar />

      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* ── 1. HEADER & STATUS STRIP MINIMALIS ── */}
        <DownloadHeader
          targetDir={data.targetDir}
          diskSpace={data.diskSpace}
          cnlStatus={data.cnlStatus}
          totalSpeedFormatted={totalSpeedFormatted}
          activeCount={data.activeItems?.length || 0}
          stagedCount={data.stagedPackages?.length || 0}
          readyCount={data.readyItems?.length || 0}
          refreshing={refreshing}
          onRefresh={() => fetchStatus()}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenTargetFolder={handleOpenFolder}
          onTakeoverPort={handleTakeoverPort}
          isTakingOver={actionState.launchingJd}
          onOpenGameSource={handleOpenGameSource}
        />

        {/* ── 2. STAGED PACKAGES (JIKA ADA TANGKAPAN DITAMPUNG) ── */}
        <StagedSection
          stagedPackages={data.stagedPackages}
          onStartPackage={handleStartStagedPackage}
          onRemovePackage={handleRemoveStagedPackage}
          onStartAll={handleStartAllStaged}
          isStartingAll={actionState.startingAll}
          actionLoading={actionState.staged}
        />

        {/* ── 3. ANTREAN UNDUHAN BERJALAN (JIKA ADA DOWNLOAD AKTIF) ── */}
        {data.activeGroups && data.activeGroups.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 text-xs">
                  <DownloadCloud size={14} />
                </span>
                <h2 className="text-xs font-black uppercase tracking-wider text-white">
                  Antrean Unduhan Berjalan ({data.activeGroups.length})
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {data.activeGroups.map((group) => {
                const isExpanded = !!expandedActiveGroups[group.key]
                return (
                  <ActiveDownloadItem
                    key={group.key}
                    group={group}
                    isExpanded={isExpanded}
                    onToggleExpand={() =>
                      setExpandedActiveGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                    }
                    onPause={() => handlePauseTask(group.items?.[0]?.id || group.key)}
                    onResume={() => handleResumeTask(group.items?.[0]?.id || group.key)}
                    onCancel={() => handleCancelTask(group.items?.[0]?.id || group.key)}
                    actionLoading={actionState.taskControl[group.items?.[0]?.id || group.key]}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── 4. KATALOG PEMROSESAN GAME (PIPELINE EKSTRAK & INSTALL) ── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-xs">
                <CheckCircle2 size={16} />
              </span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Pemrosesan Game: Ekstrak, Pasang &amp; Siap Kirim ({data.readyItems?.length || 0})
                </h2>
                <p className="text-[11px] text-[var(--text-4)]">
                  Lakukan ekstraksi arsip RAR atau pasang file ISO game langsung ke format Pre-Installed siap upload.
                </p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-xl p-1 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setReadyFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    readyFilter === 'all'
                      ? 'bg-white/20 text-white shadow-sm'
                      : 'text-[var(--text-4)] hover:text-white'
                  }`}
                >
                  Semua ({data.readyItems?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setReadyFilter('pending')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    readyFilter === 'pending'
                      ? 'bg-amber-400 text-black shadow-sm font-black'
                      : 'text-[var(--text-4)] hover:text-amber-300'
                  }`}
                >
                  Perlu Proses ({data.readyItems?.filter((i) => !i.isInstalledInStudio).length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setReadyFilter('installed')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    readyFilter === 'installed'
                      ? 'bg-emerald-500 text-black shadow-sm font-black'
                      : 'text-[var(--text-4)] hover:text-emerald-300'
                  }`}
                >
                  Siap di Workbench ({data.readyItems?.filter((i) => i.isInstalledInStudio).length || 0})
                </button>
              </div>

              <Link
                href="/workbench"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer"
              >
                <span>Buka Workbench</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Daftar Kartu Game Pipeline */}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-[var(--text-4)]">
              <Loader2 size={26} className="animate-spin text-emerald-400 mb-2" />
              <span className="text-xs font-mono">Memindai berkas game...</span>
            </div>
          ) : data.readyItems?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-center p-6 text-[var(--text-4)] rounded-2xl border border-dashed border-white/10 bg-black/20">
              <Package size={28} className="text-zinc-600 mb-2" />
              <p className="text-xs font-bold text-zinc-300">Belum ada game di folder GameDownload</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-sm">
                Game yang selesai diunduh akan otomatis terdeteksi di sini untuk diekstrak atau dipasang ke Pre-Installed.
              </p>
            </div>
          ) : displayedCatalogItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center p-6 text-[var(--text-4)] rounded-2xl border border-dashed border-white/10 bg-black/20">
              <CheckCircle2 size={24} className="text-emerald-400 mb-2" />
              <p className="text-xs font-bold text-white">Tidak ada item pada filter ini.</p>
              <button
                type="button"
                onClick={() => setReadyFilter('all')}
                className="mt-2 text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                Tampilkan Semua Game ({data.readyItems.length})
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedCatalogItems.map((item) => {
                // Cari apakah folder ini sedang menjalani ekstraksi aktif
                const matchingExtraction = (data.activeExtractions || []).find(
                  (e) =>
                    e.folderPath === item.fullPath ||
                    (e.packageName && item.cleanTitle && e.packageName.toLowerCase() === item.cleanTitle.toLowerCase())
                )

                return (
                  <GamePipelineCard
                    key={item.folderName}
                    item={item}
                    activeExtraction={matchingExtraction}
                    onInspect={(name, fPath, type) => setInspectFolder({ folderName: name, folderPath: fPath, type })}
                    onOpenExplorer={handleOpenFolder}
                    onExtract={handleManualExtract}
                    onCleanRar={(it) => setConfirmCleanRar(it)}
                    onLaunchInstaller={(folder) => setWizardFolder(folder)}
                    onHandoff={handleHandoff}
                    onDeleteRaw={(it) => setConfirmDeleteRaw(it)}
                    isExtracting={Boolean(actionState.extracting[item.fullPath])}
                    isCleaningRar={Boolean(actionState.cleaningRar[item.folderName])}
                    isHandoffLoading={Boolean(actionState.handoff[item.folderName])}
                    isDeletingRaw={actionState.deletingRaw}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* ── 5. RIWAYAT TRANSFER RINGKAS (COLLAPSIBLE) ── */}
        {data.historyItems?.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Riwayat Pengoperan Game ({data.historyItems.length})</span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isHistoryExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isHistoryExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 mt-3 border-t border-white/5 animate-in fade-in duration-200 text-xs">
                {data.historyItems.slice(0, 9).map((h) => (
                  <div key={h.id} className="rounded-xl border border-white/5 bg-black/40 p-3 space-y-1">
                    <span className="font-bold text-white block truncate">{h.cleanTitle || h.folderName}</span>
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>{h.sizeFormatted}</span>
                      <span className="text-emerald-400">Terkirim</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── MODALS & DIALOGS ── */}

      {/* 1. Modal Wizard Instalasi Silent / Manual */}
      {wizardFolder && (
        <PreInstalledWizardModal
          isOpen={!!wizardFolder}
          onClose={() => {
            setWizardFolder(null)
            fetchStatus(true)
          }}
          folderName={wizardFolder}
          onSuccess={() => {
            setWizardFolder(null)
            fetchStatus(true)
            toast({ title: 'Instalasi Game Sukses!', description: 'Game berhasil dipasang ke folder GameUpload dan siap dioperasikan.', variant: 'success' })
          }}
        />
      )}

      {/* 2. Modal Inspeksi Folder Berkas */}
      {inspectFolder && (
        <LocalFolderInspectModal
          isOpen={!!inspectFolder}
          onClose={() => setInspectFolder(null)}
          folderName={inspectFolder.folderName}
          folderPath={inspectFolder.folderPath}
          type={inspectFolder.type}
        />
      )}

      {/* 3. Dialog Konfirmasi Hapus Mentahan Download */}
      <ConfirmDialog
        open={!!confirmDeleteRaw}
        onClose={() => setConfirmDeleteRaw(null)}
        onConfirm={handleConfirmDeleteRaw}
        loading={actionState.deletingRaw}
        title="Hapus Berkas Mentahan Unduhan?"
        description={`Apakah Anda yakin ingin menghapus folder mentah "${confirmDeleteRaw?.folderName}" dari folder GameDownload? Game yang sudah terpasang di Upload Studio tetap aman 100%.`}
        confirmLabel="Ya, Hapus Mentahan (Hemat Disk)"
        cancelLabel="Batal"
        tone="danger"
      />

      {/* 4. Dialog Konfirmasi Hapus Part RAR (Hemat Disk) */}
      <ConfirmDialog
        open={!!confirmCleanRar}
        onClose={() => setConfirmCleanRar(null)}
        onConfirm={handleConfirmCleanRar}
        loading={Boolean(confirmCleanRar && actionState.cleaningRar[confirmCleanRar.folderName])}
        title="Hapus Berkas Part RAR?"
        description={`Hapus ${confirmCleanRar?.rarPartsCount} berkas part RAR mentah untuk membebaskan ruang harddisk sebesar ${confirmCleanRar?.rarSizeFormatted}? File ISO/installer hasil ekstraksi akan tetap aman.`}
        confirmLabel="Ya, Hapus File RAR"
        cancelLabel="Batal"
        tone="warning"
      />

      {/* 5. Modal Tambah Tautan Manual */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Tambah Tautan Unduhan</h3>
                <p className="text-[11px] text-[var(--text-4)]">Mulai mengunduh berkas langsung dari link web</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDownload} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 font-bold block">URL Unduhan Langsung (Direct Link):</label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 font-bold block">Nama Berkas (Opsional):</label>
                <input
                  type="text"
                  placeholder="Contoh: Game_Part1.rar"
                  value={manualFilename}
                  onChange={(e) => setManualFilename(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 transition-colors"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={manualAutoStart}
                  onChange={(e) => setManualAutoStart(e.target.checked)}
                  className="rounded border-white/20 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-zinc-300 font-sans text-xs">Langsung mulai unduh (tanpa ditampung di antrean staged)</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionState.addingDownload || !manualUrl.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-black hover:brightness-110 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionState.addingDownload ? 'Menyimpan...' : 'Tambahkan Tautan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Ekstrak UnRAR Manual (dengan Password Input) */}
      {extractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-sm font-black uppercase text-white">Ekstrak Arsip UnRAR</h3>
                <p className="text-[11px] text-[var(--text-4)]">{extractModal.packageName}</p>
              </div>
              <button
                type="button"
                onClick={() => setExtractModal(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="text-[11px] text-zinc-300 font-bold block">Password Arsip WinRAR:</label>
              <input
                type="text"
                value={extractModal.password}
                onChange={(e) => setExtractModal({ ...extractModal, password: e.target.value })}
                placeholder="mygameon / www.ovagames.com"
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-400"
              />
              <p className="text-[10px] text-zinc-500">
                Password default biasanya &quot;mygameon&quot; atau &quot;www.ovagames.com&quot; tergantung sumber unduhan.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setExtractModal(null)}
                className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleManualExtract(extractModal.folderPath, extractModal.packageName, extractModal.password)}
                className="px-4 py-2 rounded-xl bg-blue-500 text-white font-bold hover:brightness-110 cursor-pointer shadow-md"
              >
                Mulai Ekstrak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
