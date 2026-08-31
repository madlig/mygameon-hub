'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  HardDrive, FolderOpen, AlertCircle, Loader2, UploadCloud,
  CheckCircle2, ChevronRight, Server, FileArchive, Settings2,
  Trash2, Plus, Store, Cloud, Clock, CheckSquare, Square, ChevronDown,
  RefreshCw, Sparkles, Calendar, Layers, ExternalLink, Zap, ShieldCheck,
  Palette, Bot, ShoppingBag, ArrowRight, Telescope, Play, Pause, ListPlus,
  RotateCcw, XCircle
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '-'
  }
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

function formatTargetDate(str) {
  if (!str || str === 'Target Rilis Terdekat' || str === 'Tanpa Tanggal Target') return 'Tanpa Tanggal Target'
  try {
    const d = new Date(str)
    if (isNaN(d.getTime())) return str
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return str
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function StudioPage() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('console') // 'console' | 'planner' | 'history'

  // Loading & State
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ path: '', folders: [] })
  const [error, setError] = useState(null)

  // Selection & Mode
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [targetWorkspace, setTargetWorkspace] = useState(null)
  const [workspaces, setWorkspaces] = useState([])

  // 2-Mode Upload System
  const [uploadMode, setUploadMode] = useState('new') // 'new' | 'update'
  const [existingGames, setExistingGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [autoPropagate, setAutoPropagate] = useState(true)

  // Search & Filter in Studio
  const [folderSearch, setFolderSearch] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')

  // Multi-Upload Queue System
  const [queue, setQueue] = useState([])
  const [isQueueRunning, setIsQueueRunning] = useState(false)
  const [activeQueueId, setActiveQueueId] = useState(null)
  const queueRef = useRef([])
  const isQueueRunningRef = useRef(false)
  queueRef.current = queue
  isQueueRunningRef.current = isQueueRunning

  // Process & Electron state
  const [processState, setProcessState] = useState({ status: 'idle', progress: 0, text: '', logs: [] })
  const [isElectron, setIsElectron] = useState(true)
  const prevStatusRef = useRef('idle')

  const isAppElectron = () => typeof window !== 'undefined' && !!window.electronAPI

  // Advanced WinRAR Settings
  const [showSettings, setShowSettings] = useState(false)
  const [rarConfig, setRarConfig] = useState({
    splitSize: 4100,
    compression: 'm5',
    solid: true,
    recoveryRecord: true,
    autoDelete: false,
  })

  // Production Planner (Tasks)
  const [tasks, setTasks] = useState([])
  const [history, setHistory] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDate, setNewTaskDate] = useState('')
  const [newTaskType, setNewTaskType] = useState('new') // 'new' | 'update'
  const [isUpdatingTask, setIsUpdatingTask] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.electronAPI) {
      setIsElectron(false)
    }

    fetchScan()
    fetchWorkspaces()
    fetchTasks()
    fetchHistory()
    fetchExistingGames()

    const interval = setInterval(checkStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (processState.status === 'success' && prevStatusRef.current === 'processing') {
      fetchScan()
      fetchHistory()
      fetchTasks()
      fetchExistingGames()

      // Handle Queue Advancement
      if (isQueueRunningRef.current && activeQueueId) {
        handleQueueItemCompleted(activeQueueId, 'success')
      }
    } else if (processState.status === 'error' && prevStatusRef.current === 'processing') {
      if (isQueueRunningRef.current && activeQueueId) {
        handleQueueItemCompleted(activeQueueId, 'error')
      }
    }

    // Sync active queue item progress
    if (activeQueueId && processState.status === 'processing') {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === activeQueueId
            ? { ...item, progress: processState.progress || 0, text: processState.text || 'Sedang memproses...' }
            : item
        )
      )
    }

    prevStatusRef.current = processState.status
  }, [processState.status, processState.progress, processState.text])

  async function checkStatus() {
    try {
      if (isAppElectron()) {
        const res = await fetch('/api/studio/status')
        const state = await res.json()
        if (state && state.status) {
          setProcessState((prev) => {
            if (prev.status === 'processing' && state.status === 'idle') return prev
            return state
          })
        }
      } else {
        const res = await fetch('/api/c2/state')
        const json = await res.json()
        if (json.success && json.state && json.state.currentTask) {
          setProcessState((prev) => {
            if (prev.status === 'processing' && json.state.currentTask.status === 'idle') return prev
            return json.state.currentTask
          })
        }
      }
    } catch (_) {}
  }

  async function resetMonitorState() {
    setProcessState({ status: 'idle', progress: 0, text: '', logs: [] })
    try {
      await fetch('/api/studio/status', { method: 'DELETE' })
    } catch (_) {}
  }

  async function fetchScan() {
    setLoading(true)
    try {
      if (isAppElectron()) {
        const res = await fetch('/api/studio/scan')
        const json = await res.json()
        if (json.success) setData(json)
      } else {
        const res = await fetch('/api/c2/state')
        const json = await res.json()
        if (json.success && json.state) {
          setData({ folders: json.state.folders || [], disks: [] })
        }
      }
    } catch (_) {
    } finally {
      setLoading(false)
    }
  }

  async function fetchWorkspaces() {
    try {
      const res = await fetch('/api/drive/status')
      const d = await res.json()
      setWorkspaces(d.workspaces || [])
      if (d.workspaces && d.workspaces.length > 0 && !targetWorkspace) {
        setTargetWorkspace(d.workspaces[0])
      }
    } catch (_) {}
  }

  async function fetchExistingGames() {
    try {
      const res = await fetch('/api/search?q=&limit=1000')
      const json = await res.json()
      const list = json.results || json.games || []
      const formatted = list.map((g) => ({
        folderId: g.targetId || g.sources?.[0]?.folderId || g.id,
        name: g.name,
        ownerEmail: g.sources?.[0]?.ownerEmail || g.ownerEmail || '',
        sources: g.sources || [],
        fileCount: g.totalFiles || g.fileCount || 0,
        size: g.size || '',
      }))
      setExistingGames(formatted)
    } catch (_) {}
  }

  async function fetchTasks() {
    try {
      const res = await fetch('/api/studio/tasks')
      const d = await res.json()
      setTasks(d.tasks || [])
    } catch (_) {}
  }

  async function fetchHistory() {
    try {
      const res = await fetch('/api/studio/history')
      const d = await res.json()
      setHistory(d.history || [])
    } catch (_) {}
  }

  // ── Eksekusi Single Item ──
  const executeSingleJob = async (folder, mode, game, workspace, config, propagate, action = 'upload') => {
    const effectiveGameName = mode === 'update' && game ? game.name : folder.name
    const effectiveFolderId = mode === 'update' && game ? game.folderId : null

    setProcessState({ status: 'processing', progress: 0, text: `Memulai upload: ${effectiveGameName}...` })
    let res

    if (isAppElectron()) {
      res = await fetch('/api/studio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: folder.path,
          targetEmail: workspace?.email,
          config: config || rarConfig,
          action: action === 'auto_pipeline' ? 'archive' : action,
          mode: mode,
          targetFolderId: effectiveFolderId,
          autoPropagate: propagate,
          gameName: effectiveGameName,
        }),
      })
    } else {
      const cmdType = action === 'archive' ? 'START_ARCHIVE' : 'START_UPLOAD'
      res = await fetch('/api/c2/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: cmdType,
          payload: {
            targetFolder: folder.path,
            workspace: workspace?.email || '',
            rarConfig: config || rarConfig,
            options: {
              mode: mode,
              targetFolderId: effectiveFolderId,
              autoPropagate: propagate,
              gameName: effectiveGameName,
            },
          },
        }),
      })
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `HTTP Error: ${res.status}`)
    }
  }

  const startProcessing = async (action) => {
    if (!selectedFolder) return
    if ((action === 'upload' || action === 'auto_pipeline') && !targetWorkspace) return

    try {
      await executeSingleJob(
        selectedFolder,
        uploadMode,
        selectedGame,
        targetWorkspace,
        rarConfig,
        autoPropagate,
        action
      )
    } catch (e) {
      console.error('Failed to start processing:', e)
      setProcessState({ status: 'error', progress: 0, text: 'Gagal: ' + e.message })
    }
  }

  // ── Multi-Upload Queue Handlers ──
  const addToQueue = () => {
    if (!selectedFolder) return
    if (!targetWorkspace) return
    if (uploadMode === 'update' && !selectedGame) return

    const newItem = {
      id: `${selectedFolder.name}-${Date.now()}`,
      folder: selectedFolder,
      mode: uploadMode,
      targetGame: selectedGame,
      workspace: targetWorkspace,
      rarConfig: { ...rarConfig },
      autoPropagate,
      status: 'waiting', // 'waiting' | 'processing' | 'success' | 'error'
      progress: 0,
      text: 'Menunggu antrean...',
    }

    setQueue((prev) => [...prev, newItem])
  }

  const removeFromQueue = (id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
    if (activeQueueId === id) {
      setActiveQueueId(null)
      setIsQueueRunning(false)
    }
  }

  const clearCompletedQueue = () => {
    setQueue((prev) => prev.filter((item) => item.status === 'waiting' || item.status === 'processing'))
  }

  const startQueueRunner = async () => {
    setIsQueueRunning(true)
    const nextItem = queue.find((item) => item.status === 'waiting')
    if (nextItem) {
      runQueueItem(nextItem)
    }
  }

  const pauseQueueRunner = () => {
    setIsQueueRunning(false)
  }

  const runQueueItem = async (item) => {
    setActiveQueueId(item.id)
    setQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: 'processing', text: 'Sedang memproses...' } : q))
    )

    try {
      await executeSingleJob(
        item.folder,
        item.mode,
        item.targetGame,
        item.workspace,
        item.rarConfig,
        item.autoPropagate,
        'upload'
      )
    } catch (e) {
      handleQueueItemCompleted(item.id, 'error', e.message)
    }
  }

  const handleQueueItemCompleted = (itemId, resultStatus, errorMsg = '') => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === itemId
          ? {
              ...q,
              status: resultStatus,
              progress: resultStatus === 'success' ? 100 : q.progress,
              text: resultStatus === 'success' ? '✓ Berhasil diupload' : `Gagal: ${errorMsg}`,
            }
          : q
      )
    )

    setActiveQueueId(null)

    // Check if there are more waiting items
    if (isQueueRunningRef.current) {
      const remaining = queueRef.current.filter((q) => q.id !== itemId && q.status === 'waiting')
      if (remaining.length > 0) {
        setTimeout(() => {
          if (isQueueRunningRef.current) {
            runQueueItem(remaining[0])
          }
        }, 2000)
      } else {
        setIsQueueRunning(false)
      }
    }
  }

  // ── Planner Actions ──
  async function addTask(e) {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    setIsUpdatingTask(true)
    try {
      const res = await fetch('/api/studio/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          targetDate: newTaskDate || 'Target Rilis Terdekat',
          taskType: newTaskType,
        }),
      })
      if (res.ok) {
        setNewTaskTitle('')
        setNewTaskDate('')
        setNewTaskType('new')
        fetchTasks()
      }
    } finally {
      setIsUpdatingTask(false)
    }
  }

  async function updateTaskField(id, field, value) {
    try {
      setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)))
      await fetch('/api/studio/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      })
      fetchTasks()
    } catch (_) {}
  }

  async function deleteTask(id) {
    try {
      setTasks((prev) => prev.filter((t) => t._id !== id))
      await fetch('/api/studio/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      fetchTasks()
    } catch (_) {}
  }

  const handleLaunchStudioForTask = (taskTitle) => {
    setActiveTab('console')
    const match = data.folders.find((f) => f.name.toLowerCase().includes(taskTitle.toLowerCase()))
    if (match) {
      setSelectedFolder(match)
    }
  }

  // Filtered folders
  const filteredFolders = useMemo(() => {
    if (!folderSearch.trim()) return data.folders
    const q = folderSearch.toLowerCase()
    return data.folders.filter((f) => f.name.toLowerCase().includes(q))
  }, [data.folders, folderSearch])

  // Filtered existing catalog games for mode update
  const filteredCatalogGames = useMemo(() => {
    if (!catalogSearch.trim()) return existingGames
    const q = catalogSearch.toLowerCase()
    return existingGames.filter((g) => g.name.toLowerCase().includes(q) || g.ownerEmail.toLowerCase().includes(q))
  }, [existingGames, catalogSearch])

  // Grouped tasks by target date
  const groupedTasks = useMemo(() => {
    const map = {}
    tasks.forEach((t) => {
      const group = t.targetDate || 'Tanpa Tanggal Target'
      if (!map[group]) map[group] = []
      map[group].push(t)
    })
    return map
  }, [tasks])

  return (
    <div className="space-y-6">
      <TopBar title="Upload Studio" backHref="/" />

      {/* 🧭 3-Tab Main Header Navigation */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'console'
                ? 'bg-[var(--primary)] text-black shadow-[0_0_20px_rgba(255,209,0,0.3)]'
                : 'text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text)]'
            }`}
          >
            <HardDrive size={15} /> ⚡ Studio Console
          </button>

          <button
            onClick={() => setActiveTab('planner')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'planner'
                ? 'bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                : 'text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text)]'
            }`}
          >
            <Calendar size={15} /> 📅 Target Rilis & Planner ({tasks.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                : 'text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text)]'
            }`}
          >
            <Clock size={15} /> 📜 Riwayat Upload ({history.length})
          </button>
        </div>

        {/* Status Mode Badge */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/5 bg-black/40 px-3 py-1 text-[10px] font-mono text-[var(--text-4)]">
          <span className={`h-2 w-2 rounded-full ${isElectron ? 'bg-emerald-400' : 'bg-blue-400 animate-ping'}`} />
          <span>{isElectron ? 'Desktop Native Mode' : 'Remote C2 Mode'}</span>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          TAB 1: ⚡ STUDIO CONSOLE (3-STEP PIPELINE WITH MULTI-UPLOAD QUEUE)
      ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          
          {/* 📁 STEP 1: PILIH GAME LOKAL (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-black">
                  1
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">Pilih Game di PC</h3>
              </div>
              <button
                onClick={fetchScan}
                disabled={loading}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text)]"
                title="Refresh folder lokal"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Search Folder */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Cari folder game..."
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            {/* Folder List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[520px] pr-1 scrollbar-thin">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--text-3)] gap-2">
                  <Loader2 size={24} className="animate-spin text-[var(--primary)]" />
                  <p className="text-[11px]">Memindai folder PC...</p>
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-xl">
                  <FileArchive size={28} className="text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-[var(--text-3)] font-semibold">Tidak Ada Folder Game</p>
                  <p className="text-[10px] text-[var(--text-4)] mt-1">Letakkan folder game pada direktori staging Anda.</p>
                </div>
              ) : (
                filteredFolders.map((folder) => {
                  const isSelected = selectedFolder?.name === folder.name
                  return (
                    <button
                      key={folder.name}
                      onClick={() => {
                        setSelectedFolder(folder)
                        // Auto check if this game already exists in catalog
                        const match = existingGames.find((g) => g.name.toLowerCase() === folder.name.toLowerCase())
                        if (match) {
                          setSelectedGame(match)
                          setUploadMode('update')
                          const primaryOwner = match.ownerEmail?.split(',')[0]?.trim()
                          const matchedWs = workspaces.find((w) => w.email === primaryOwner)
                          if (matchedWs) setTargetWorkspace(matchedWs)
                        } else {
                          setSelectedGame(null)
                          setUploadMode('new')
                        }
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-3.5 py-3 transition-all ${
                        isSelected
                          ? 'border border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] shadow-md'
                          : 'border border-transparent bg-black/20 text-[var(--text-2)] hover:bg-white/5'
                      }`}
                    >
                      <div className="flex flex-col items-start min-w-0 pr-2">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text)]'}`}>
                          {folder.name}
                        </span>
                        {folder.hasArchive ? (
                          <span className="mt-1 flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/20">
                            ✓ Siap Upload ({folder.archiveParts} Part)
                          </span>
                        ) : (
                          <span className="mt-0.5 text-[9px] text-[var(--text-4)]">Folder Mentah (Butuh Arsip)</span>
                        )}
                      </div>
                      {isSelected && <ChevronRight size={16} className="text-[var(--primary)] shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* ⚙️ STEP 2: KONFIGURASI TARGET & MODE (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 text-xs font-black">
                2
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">Konfigurasi Target & Mode</h3>
            </div>

            {!selectedFolder ? (
              <div className="flex flex-col items-center justify-center py-24 text-center text-[var(--text-3)] p-4">
                <UploadCloud size={36} className="text-white/10 mb-2" />
                <p className="text-xs font-bold text-[var(--text-3)]">Pilih Game di Step 1 Terlebih Dahulu</p>
                <p className="text-[10px] text-[var(--text-4)] mt-1">Konfigurasi workspace & mode akan muncul di sini.</p>
              </div>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                
                <div className="space-y-3.5">
                  {/* Game Title Display */}
                  <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-4)]">Game Terpilih:</span>
                    <p className="text-xs font-black text-[var(--text)] truncate mt-0.5">{selectedFolder.name}</p>
                    <p className="text-[10px] font-mono text-[var(--text-4)] truncate mt-0.5">{selectedFolder.path}</p>
                  </div>

                  {/* 2-Mode Selector */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1.5">
                      Mode Penerbitan:
                    </label>
                    <div className="flex rounded-xl border border-white/10 bg-black/40 p-1 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode('new')
                          setSelectedGame(null)
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                          uploadMode === 'new'
                            ? 'bg-[var(--primary)] text-black shadow-md'
                            : 'text-[var(--text-4)] hover:text-[var(--text)]'
                        }`}
                      >
                        <Plus size={13} /> Game Baru
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode('update')
                          const match = existingGames.find((g) => g.name.toLowerCase() === selectedFolder.name.toLowerCase())
                          if (match) {
                            setSelectedGame(match)
                            const primaryOwner = match.ownerEmail?.split(',')[0]?.trim()
                            const matchedWs = workspaces.find((w) => w.email === primaryOwner)
                            if (matchedWs) setTargetWorkspace(matchedWs)
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                          uploadMode === 'update'
                            ? 'bg-amber-400 text-black shadow-md'
                            : 'text-[var(--text-4)] hover:text-[var(--text)]'
                        }`}
                      >
                        <RefreshCw size={13} /> Update Versi
                      </button>
                    </div>
                  </div>

                  {/* Mode Update Options */}
                  {uploadMode === 'update' && (
                    <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-amber-400">
                          Pilih Game yang Ditimpa:
                        </label>
                        <span className="text-[9px] font-mono text-[var(--text-4)]">{existingGames.length} di Katalog</span>
                      </div>

                      {/* Filter Search for Catalog */}
                      <input
                        type="text"
                        placeholder="Cari judul game di katalog..."
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-amber-400 focus:outline-none mb-1"
                      />

                      <select
                        value={selectedGame?.folderId || ''}
                        onChange={(e) => {
                          const game = existingGames.find((g) => g.folderId === e.target.value)
                          setSelectedGame(game || null)
                          if (game) {
                            const primaryOwner = game.ownerEmail?.split(',')[0]?.trim()
                            const matchedWs = workspaces.find((w) => w.email === primaryOwner)
                            if (matchedWs) setTargetWorkspace(matchedWs)
                          }
                        }}
                        className="w-full rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-xs font-bold text-[var(--text)] focus:border-amber-400 focus:outline-none"
                      >
                        <option value="">-- Pilih Judul Game di Katalog --</option>
                        {filteredCatalogGames.map((g) => (
                          <option key={g.folderId} value={g.folderId}>
                            {g.name} ({g.ownerEmail} • {g.fileCount} part)
                          </option>
                        ))}
                      </select>

                      {selectedGame && (
                        <div className="rounded-lg bg-black/40 p-2 text-[10px] text-amber-200">
                          <p className="font-semibold text-amber-400">✓ ID Drive Tetap Sama ({selectedGame.folderId})</p>
                          <p className="opacity-80">Part lama dibersihkan dan digantikan part baru.</p>
                        </div>
                      )}

                      <div className="flex items-start gap-2 pt-1 border-t border-amber-500/10">
                        <input
                          type="checkbox"
                          id="autoPropagateTab1"
                          checked={autoPropagate}
                          onChange={(e) => setAutoPropagate(e.target.checked)}
                          className="accent-amber-400 mt-0.5"
                        />
                        <label htmlFor="autoPropagateTab1" className="text-[10px] font-semibold text-[var(--text-2)] cursor-pointer">
                          Otomatis sinkronkan ke semua workspace cadangan (Safe Waterfall)
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Workspace Selector */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1.5">
                      {uploadMode === 'update' ? 'Workspace Utama (Primary)' : 'Target Workspace Google Drive'}
                    </label>
                    <select
                      value={targetWorkspace?.email || ''}
                      onChange={(e) => {
                        const ws = workspaces.find((w) => w.email === e.target.value)
                        if (ws) setTargetWorkspace(ws)
                      }}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs font-bold text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                    >
                      {workspaces.map((ws) => (
                        <option key={ws.email} value={ws.email}>
                          {ws.email} ({ws.storage?.usageGB || '0'} / {ws.storage?.limitGB || '1024'} GB)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Advanced WinRAR Settings */}
                  <div className="pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setShowSettings(!showSettings)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-4)] hover:text-[var(--text)] transition-colors"
                    >
                      <Settings2 size={13} /> {showSettings ? 'Sembunyikan Pengaturan WinRAR' : 'Pengaturan WinRAR'}
                    </button>

                    {showSettings && (
                      <div className="mt-2.5 rounded-xl border border-white/5 bg-black/40 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--text-3)] font-semibold">Split Size (MB):</span>
                          <input
                            type="number"
                            value={rarConfig.splitSize}
                            onChange={(e) => setRarConfig({ ...rarConfig, splitSize: parseInt(e.target.value) || 0 })}
                            className="w-20 rounded-lg border border-white/10 bg-black px-2 py-1 text-xs text-right font-mono"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--text-3)] font-semibold">Kompresi:</span>
                          <select
                            value={rarConfig.compression}
                            onChange={(e) => setRarConfig({ ...rarConfig, compression: e.target.value })}
                            className="w-24 rounded-lg border border-white/10 bg-black px-2 py-1 text-xs"
                          >
                            <option value="m5">Best</option>
                            <option value="m4">Good</option>
                            <option value="m3">Normal</option>
                            <option value="m0">Fast</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <span className="text-[10px] text-red-400 font-semibold">Auto-Delete Folder Lokal:</span>
                          <input
                            type="checkbox"
                            checked={rarConfig.autoDelete}
                            onChange={(e) => setRarConfig({ ...rarConfig, autoDelete: e.target.checked })}
                            className="accent-red-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ➕ Tombol Tambah ke Antrean Multi-Upload */}
                <div className="pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={addToQueue}
                    disabled={!selectedFolder || !targetWorkspace || (uploadMode === 'update' && !selectedGame)}
                    className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 py-2.5 text-xs font-black text-amber-400 hover:bg-amber-400 hover:text-black disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                  >
                    <ListPlus size={15} />
                    <span>➕ Masukkan ke Antrean Upload</span>
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* ⚡ STEP 3: PUSAT EKSEKUSI & MULTI-UPLOAD QUEUE (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-black">
                  3
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">Eksekusi & Live Monitor</h3>
              </div>
              
              {/* Reset Status Button */}
              {processState.status !== 'idle' && processState.status !== 'processing' && (
                <button
                  type="button"
                  onClick={resetMonitorState}
                  className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-4)] hover:text-[var(--text)]"
                  title="Reset monitor ke status netral"
                >
                  <RotateCcw size={11} /> Reset
                </button>
              )}
            </div>

            {/* Live Progress Bar Panel */}
            <div
              className={`rounded-2xl p-4 text-xs transition-all duration-500 border mb-4 ${
                processState.status === 'error'
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : processState.status === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : processState.status === 'processing'
                  ? 'border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'border-white/5 bg-black/20 text-[var(--text-4)]'
              }`}
            >
              <div className="flex items-center justify-between font-black text-xs mb-2">
                <span className="flex items-center gap-2">
                  {processState.status === 'processing' && <Loader2 size={13} className="animate-spin text-[var(--primary)]" />}
                  {processState.status === 'processing'
                    ? 'SEDANG BERJALAN...'
                    : processState.status === 'error'
                    ? 'PROSES GAGAL'
                    : processState.status === 'success'
                    ? 'PROSES SELESAI'
                    : 'SIAP EKSEKUSI (NETRAL)'}
                </span>
                <span className="font-mono text-sm">{processState.progress || 0}%</span>
              </div>

              <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    processState.status === 'error'
                      ? 'bg-red-500'
                      : processState.status === 'success'
                      ? 'bg-emerald-500'
                      : processState.status === 'processing'
                      ? 'bg-gradient-to-r from-[var(--primary)] to-amber-300'
                      : 'bg-transparent'
                  }`}
                  style={{ width: `${processState.progress || 0}%` }}
                />
              </div>
              <p className="text-[10px] font-medium truncate opacity-90">
                {processState.status === 'idle'
                  ? 'Belum ada proses berjalan. Siap mengeksekusi upload.'
                  : processState.text || 'Memproses berkas...'}
              </p>
            </div>

            {/* 📋 Multi-Upload Queue Board */}
            <div className="flex-1 flex flex-col justify-between space-y-3">
              <div className="flex flex-col flex-1 min-h-[160px] max-h-[260px] rounded-xl border border-white/5 bg-black/30 p-2.5">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-1.5">
                    <Layers size={12} className="text-amber-400" />
                    <span>Daftar Antrean Upload ({queue.length})</span>
                  </span>
                  {queue.some((q) => q.status === 'success') && (
                    <button
                      type="button"
                      onClick={clearCompletedQueue}
                      className="text-[9px] text-[var(--text-4)] hover:text-emerald-400"
                    >
                      Bersihkan Selesai
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-6 text-[var(--text-4)]">
                      <Layers size={20} className="opacity-20 mb-1" />
                      <p className="text-[10px]">Antrean kosong.</p>
                      <p className="text-[9px] opacity-70">Gunakan Step 2 untuk menambahkan game ke antrean.</p>
                    </div>
                  ) : (
                    queue.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`rounded-lg p-2 text-xs border transition-all ${
                          item.status === 'processing'
                            ? 'border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)]'
                            : item.status === 'success'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : item.status === 'error'
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : 'border-white/5 bg-black/40 text-[var(--text-2)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-[11px] truncate">{item.folder.name}</p>
                            <p className="text-[9px] text-[var(--text-4)] truncate">
                              {item.mode === 'update' ? '🔄 Update' : '➕ Baru'} ➔ {item.workspace.email}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.status === 'processing' && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 font-mono">
                                <Loader2 size={10} className="animate-spin" /> {item.progress}%
                              </span>
                            )}
                            {item.status === 'success' && (
                              <span className="text-[9px] font-bold text-emerald-400 font-mono">✓ Selesai</span>
                            )}
                            {item.status === 'waiting' && (
                              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-4)]">
                                #{idx + 1}
                              </span>
                            )}
                            {item.status !== 'processing' && (
                              <button
                                type="button"
                                onClick={() => removeFromQueue(item.id)}
                                className="text-[var(--text-4)] hover:text-red-400 ml-1"
                                title="Hapus dari antrean"
                              >
                                <XCircle size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons Hub */}
              <div className="space-y-2">
                
                {/* Opsi 1: Start/Pause Batch Queue Runner */}
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={isQueueRunning ? pauseQueueRunner : startQueueRunner}
                    disabled={processState.status === 'processing' && !isQueueRunning}
                    className={`w-full rounded-xl py-3 text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg ${
                      isQueueRunning
                        ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20'
                        : 'bg-gradient-to-r from-[var(--primary)] to-amber-400 text-black hover:brightness-110 shadow-[0_0_20px_rgba(255,209,0,0.3)]'
                    }`}
                  >
                    {isQueueRunning ? <Pause size={15} /> : <Play size={15} />}
                    <span>{isQueueRunning ? '⏸️ Jeda Antrean Batch' : `🚀 Mulai Proses Antrean (${queue.filter(q => q.status === 'waiting').length} Game)`}</span>
                  </button>
                )}

                {/* Opsi 2: Direct Single Upload */}
                {selectedFolder?.hasArchive && (
                  <button
                    type="button"
                    onClick={() => startProcessing('upload')}
                    disabled={!targetWorkspace || (uploadMode === 'update' && !selectedGame) || processState.status === 'processing' || isQueueRunning}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-black text-white hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <UploadCloud size={15} />
                    <span>{uploadMode === 'update' ? 'Upload Langsung (Game Ini Saja)' : 'Upload Part RAR ke GDrive'}</span>
                  </button>
                )}

                {/* Opsi 3: Arsip WinRAR Saja */}
                <button
                  type="button"
                  onClick={() => startProcessing('archive')}
                  disabled={!selectedFolder || processState.status === 'processing' || isQueueRunning}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <FileArchive size={13} className="text-amber-400" />
                  <span>{selectedFolder?.hasArchive ? 'Re-Archive Ulang (WinRAR)' : 'Mulai Arsip WinRAR'}</span>
                </button>

              </div>
            </div>
          </div>

        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          TAB 2: 📅 TARGET RILIS & PLANNER (SHOPEE)
      ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'planner' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Header Form Tambah Target */}
          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-amber-400" />
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text)]">Tambah Target Rilis Game Baru</h3>
            </div>

            <form onSubmit={addTask} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <input
                  type="text"
                  placeholder="Ketik judul game (misal: Black Myth Wukong)..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <input
                  type="date"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-semibold text-[var(--text)] focus:border-amber-400 focus:outline-none [color-scheme:dark]"
                />
              </div>
              <div className="sm:col-span-2">
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs font-bold text-[var(--text)] focus:border-amber-400 focus:outline-none"
                >
                  <option value="new">➕ Upload Baru</option>
                  <option value="update">🔄 Perlu Update</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim() || isUpdatingTask}
                  className="w-full rounded-xl bg-amber-400 py-2.5 text-xs font-black text-black hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-400/20"
                >
                  <Plus size={15} /> Tambah Target
                </button>
              </div>
            </form>
          </div>

          {/* Grouped Target Batches */}
          {Object.keys(groupedTasks).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-12 text-center">
              <Calendar size={36} className="text-white/10 mx-auto mb-3" />
              <p className="text-sm font-bold text-[var(--text-3)]">Belum Ada Target Rilis yang Direncanakan</p>
              <p className="text-xs text-[var(--text-4)] mt-1">Gunakan formulir di atas untuk merencanakan game yang ingin dirilis.</p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([dateGroup, items]) => {
              const completedCount = items.filter((t) => t.isUploaded && t.shopeeListed).length
              const progressPct = Math.round((completedCount / items.length) * 100)

              return (
                <div key={dateGroup} className="rounded-2xl border border-white/5 bg-[var(--surface)] shadow-xl overflow-hidden">
                  
                  {/* Batch Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 bg-[#0a0b0f] px-6 py-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">{formatTargetDate(dateGroup)}</h4>
                        <p className="text-[10px] text-[var(--text-4)]">{items.length} Judul Game dalam Batch Ini</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <span className="text-[10px] font-mono font-bold text-amber-400">{progressPct}% Siap Rilis</span>
                      <div className="w-28 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Tasks Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">
                          <th className="py-3 px-5">Judul Game</th>
                          <th className="py-3 px-4">Tipe Rilis</th>
                          <th className="py-3 px-4">Pusat Aksi & Tools</th>
                          <th className="py-3 px-4 text-center">☁️ Upload GDrive</th>
                          <th className="py-3 px-4 text-center">🛒 Status Shopee</th>
                          <th className="py-3 px-5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {items.map((task) => {
                          const isUpdate = task.taskType === 'update'
                          return (
                            <tr key={task._id} className="hover:bg-white/[0.02] transition-colors">
                              
                              {/* Judul Game */}
                              <td className="py-3.5 px-5 min-w-[200px]">
                                <span className="font-bold text-[var(--text)] block">{task.title}</span>
                                <span className="text-[10px] text-[var(--text-4)]">Dibuat: {fmtDate(task.createdAt)}</span>
                              </td>

                              {/* Tipe Rilis (Baru vs Update) */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => updateTaskField(task._id, 'taskType', isUpdate ? 'new' : 'update')}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-colors ${
                                    isUpdate
                                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                  }`}
                                  title="Klik untuk mengubah tipe rilis"
                                >
                                  {isUpdate ? <RefreshCw size={11} /> : <Plus size={11} />}
                                  <span>{isUpdate ? '🔄 Perlu Update' : '➕ Upload Baru'}</span>
                                </button>
                              </td>

                              {/* Pusat Aksi / Tools (Buka Studio & Buka AI Scout) */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  
                                  {/* Tombol Buka di Studio */}
                                  <button
                                    type="button"
                                    onClick={() => handleLaunchStudioForTask(task.title)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-colors"
                                    title="Buka folder game ini di Studio Console"
                                  >
                                    <Zap size={12} className="text-amber-400" />
                                    <span>Buka Studio</span>
                                  </button>

                                  {/* Tombol Buka AI Scout */}
                                  <Link
                                    href="/scout"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5 text-[11px] font-bold text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-colors"
                                    title="Buka halaman AI Scout untuk scraping & copywriting"
                                  >
                                    <Telescope size={12} className="text-purple-400" />
                                    <span>Buka AI Scout</span>
                                  </Link>

                                </div>
                              </td>

                              {/* Status Upload GDrive */}
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => updateTaskField(task._id, 'isUploaded', !task.isUploaded)}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-colors ${
                                    task.isUploaded
                                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                      : 'border-white/10 bg-white/5 text-[var(--text-4)] hover:text-[var(--text)]'
                                  }`}
                                >
                                  <CheckCircle2 size={12} />
                                  <span>{task.isUploaded ? 'Uploaded' : 'Belum Upload'}</span>
                                </button>
                              </td>

                              {/* Status Live Shopee */}
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => updateTaskField(task._id, 'shopeeListed', !task.shopeeListed)}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-colors ${
                                    task.shopeeListed
                                      ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
                                      : 'border-white/10 bg-white/5 text-[var(--text-4)] hover:text-[var(--text)]'
                                  }`}
                                >
                                  <ShoppingBag size={12} />
                                  <span>{task.shopeeListed ? 'Live di Toko' : 'Belum Listing'}</span>
                                </button>
                              </td>

                              {/* Actions Hapus */}
                              <td className="py-3.5 px-5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => deleteTask(task._id)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-4)] hover:bg-red-500/10 hover:text-red-400 transition-colors ml-auto"
                                  title="Hapus target rilis"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>

                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              )
            })
          )}

        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          TAB 3: 📜 RIWAYAT UPLOAD (HISTORY)
      ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-2xl border border-white/5 bg-[var(--surface)] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 bg-[#0a0b0f] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">Riwayat Unggahan Game</h3>
                  <p className="text-[10px] text-[var(--text-4)]">Daftar game yang telah berhasil diunggah ke Google Drive</p>
                </div>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--text-4)]">Belum ada riwayat unggahan.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">
                      <th className="py-3 px-5">Nama Game</th>
                      <th className="py-3 px-4">Workspace Google Drive</th>
                      <th className="py-3 px-4">Part File</th>
                      <th className="py-3 px-4">Total Ukuran</th>
                      <th className="py-3 px-5 text-right">Waktu Upload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {history.map((item) => (
                      <tr key={item._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-5 font-bold text-[var(--text)]">{item.gameName}</td>
                        <td className="py-3.5 px-4 font-mono text-[var(--text-3)]">{item.workspaceEmail}</td>
                        <td className="py-3.5 px-4 font-mono text-[var(--text-2)]">{item.fileCount} Part</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[var(--primary)]">{formatBytes(item.totalSize)}</td>
                        <td className="py-3.5 px-5 text-right text-[var(--text-4)] font-mono">
                          {fmtDate(item.uploadedAt || item.createdAt)} {fmtTime(item.uploadedAt || item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
