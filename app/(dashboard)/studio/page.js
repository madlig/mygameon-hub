'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  HardDrive, FolderOpen, AlertCircle, Loader2, UploadCloud,
  CheckCircle2, ChevronRight, Server, FileArchive, Settings2,
  Trash2, Plus, Store, Cloud, Clock, CheckSquare, Square, ChevronDown,
  RefreshCw, Sparkles, Calendar, Layers, ExternalLink, Zap, ShieldCheck,
  Palette, Bot, ShoppingBag, ArrowRight, Telescope, Play, Pause, ListPlus,
  RotateCcw, XCircle, AlertTriangle, Terminal, Key, ShieldAlert,
  Pencil, FolderPlus, Eraser, X, ChevronUp
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { cleanReleaseName } from '@/lib/utils'


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
  const [stageTab, setStageTab] = useState('inspector') // 'inspector' | 'queue_monitor'

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
  const [customCatalogTitle, setCustomCatalogTitle] = useState('')
  const [cleanReplace, setCleanReplace] = useState(true)

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
  const [processState, setProcessState] = useState({ status: 'idle', progress: 0, text: '', logs: [], errorDetail: null })
  const [isElectron, setIsElectron] = useState(true)
  const prevStatusRef = useRef('idle')
  const [showTechDetails, setShowTechDetails] = useState(false)

  // ── CRUD Staging Local Games State (Step 1) ──
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [renameModal, setRenameModal] = useState({ open: false, item: null, newName: '', loading: false, error: null })
  const [stagingPathModal, setStagingPathModal] = useState({ open: false, path: '', loading: false, error: null })
  const [confirmAction, setConfirmAction] = useState(null)
  const [crudMessage, setCrudMessage] = useState(null)


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
    fetchQueue()

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
    } else if (processState.status === 'error' && (prevStatusRef.current === 'processing' || prevStatusRef.current === 'paused')) {
      if (isQueueRunningRef.current && activeQueueId) {
        handleQueueItemCompleted(activeQueueId, 'error')
      }
    } else if (processState.status === 'cancelled') {
      if (isQueueRunningRef.current && activeQueueId) {
        handleQueueItemCompleted(activeQueueId, 'error', 'Dibatalkan oleh pengguna')
        setIsQueueRunning(false)
      }
    }

    // Sync active queue item progress
    if (activeQueueId && (processState.status === 'processing' || processState.status === 'paused')) {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === activeQueueId
            ? {
                ...item,
                progress: processState.progress || 0,
                text: processState.text || (processState.status === 'paused' ? '[Dijeda]' : 'Sedang memproses...'),
              }
            : item
        )
      )
    }

    prevStatusRef.current = processState.status
  }, [processState.status, processState.progress, processState.text])

  useEffect(() => {
    if (crudMessage) {
      const timer = setTimeout(() => setCrudMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [crudMessage])

  async function checkStatus() {
    try {
      const res = await fetch('/api/studio/status')
      const state = await res.json()
      if (state && state.status) {
        setProcessState((prev) => {
          if (
            state.status === 'success' ||
            state.status === 'error' ||
            state.status === 'paused' ||
            state.status === 'cancelled'
          ) {
            return state
          }
          if (state.status === 'processing') return state
          if (state.status === 'idle') {
            if (prev.status === 'processing') {
              return { status: 'success', progress: 100, text: 'Proses selesai dengan sukses.' }
            }
            return state
          }
          return state
        })
      }
    } catch (_) {}
  }

  async function resetMonitorState() {
    setProcessState({ status: 'idle', progress: 0, text: '', logs: [], errorDetail: null })
    setShowTechDetails(false)
    try {
      await fetch('/api/studio/status', { method: 'DELETE' })
    } catch (_) {}
  }

  async function fetchScan(customPath = null) {
    setLoading(true)
    try {
      const url = customPath ? `/api/studio/scan?path=${encodeURIComponent(customPath)}` : '/api/studio/scan'
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) setData(json)
    } catch (_) {
    } finally {
      setLoading(false)
    }
  }

  // ── Handlers CRUD Staging Game di PC ──
  const handleChangeStagingPath = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.selectDirectory) {
      try {
        const chosen = await window.electronAPI.selectDirectory(data.path)
        if (chosen) {
          await saveAndSwitchStaging(chosen)
        }
      } catch (err) {
        console.error('Electron directory picker error:', err)
      }
    } else {
      setStagingPathModal({ open: true, path: data.path || '', loading: false, error: null })
    }
  }

  const saveAndSwitchStaging = async (newPath) => {
    setStagingPathModal(prev => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch('/api/studio/local-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_staging_path', newStagingPath: newPath })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah folder staging')
      setStagingPathModal({ open: false, path: '', loading: false, error: null })
      setCrudMessage({ type: 'success', text: `Direktori staging dipindahkan ke: ${json.stagingPath}` })
      await fetchScan(json.stagingPath)
    } catch (err) {
      setStagingPathModal(prev => ({ ...prev, error: err.message, loading: false }))
    }
  }

  const handleCreateFolder = async (e) => {
    e?.preventDefault()
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      const res = await fetch('/api/studio/local-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_folder',
          stagingPath: data.path,
          folderName: newFolderName.trim()
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal membuat folder')
      setCreateFolderOpen(false)
      setNewFolderName('')
      setCrudMessage({ type: 'success', text: json.message || 'Folder berhasil dibuat' })
      await fetchScan(data.path)
    } catch (err) {
      alert(err.message)
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleRenameSubmit = async (e) => {
    e?.preventDefault()
    if (!renameModal.item || !renameModal.newName.trim()) return
    setRenameModal(prev => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch('/api/studio/local-games', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingPath: data.path,
          oldName: renameModal.item.name,
          newName: renameModal.newName.trim(),
          isArchiveFile: renameModal.item.isArchiveFile
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah nama')
      setRenameModal({ open: false, item: null, newName: '', loading: false, error: null })
      setCrudMessage({ type: 'success', text: json.message })
      if (selectedFolder?.name === renameModal.item.name) {
        setSelectedFolder(prev => prev ? { ...prev, name: json.newName } : null)
      }
      await fetchScan(data.path)
    } catch (err) {
      setRenameModal(prev => ({ ...prev, error: err.message, loading: false }))
    }
  }

  const handleCleanParts = (item) => {
    setConfirmAction({
      open: true,
      title: 'Bersihkan Part RAR Sementara?',
      description: `Apakah Anda ingin menghapus seluruh file .part*.rar sementara untuk "${item.name}"? Ini akan membebaskan ruang hard disk PC Anda. Berkas data game mentah TETAP AMAN dan TIDAK AKAN DIHAPUS.`,
      tone: 'primary',
      confirmLabel: 'Bersihkan File .part',
      loading: false,
      onConfirm: async () => {
        setConfirmAction(prev => ({ ...prev, loading: true }))
        try {
          const res = await fetch('/api/studio/local-games', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stagingPath: data.path,
              itemName: item.name,
              mode: 'clean_parts_only',
              isArchiveFile: item.isArchiveFile
            })
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || 'Gagal membersihkan part')
          setConfirmAction(null)
          setCrudMessage({ type: 'success', text: json.message })
          await fetchScan(data.path)
        } catch (err) {
          alert(err.message)
          setConfirmAction(null)
        }
      }
    })
  }

  const handleDeleteAll = (item) => {
    setConfirmAction({
      open: true,
      title: 'Hapus Game & Berkas dari PC?',
      description: `PERINGATAN: Anda akan menghapus "${item.name}" beserta seluruh foldernya dari hard disk lokal PC (${data.path}). Tindakan ini permanen dan tidak dapat dipulihkan.`,
      tone: 'danger',
      confirmLabel: 'Hapus Permanen',
      loading: false,
      onConfirm: async () => {
        setConfirmAction(prev => ({ ...prev, loading: true }))
        try {
          const res = await fetch('/api/studio/local-games', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stagingPath: data.path,
              itemName: item.name,
              mode: 'delete_all',
              isArchiveFile: item.isArchiveFile
            })
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || 'Gagal menghapus game')
          if (selectedFolder?.name === item.name) {
            setSelectedFolder(null)
          }
          setConfirmAction(null)
          setCrudMessage({ type: 'success', text: json.message })
          await fetchScan(data.path)
        } catch (err) {
          alert(err.message)
          setConfirmAction(null)
        }
      }
    })
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

  async function fetchQueue() {
    try {
      const res = await fetch('/api/studio/queue')
      const d = await res.json()
      if (d.success && Array.isArray(d.queue)) {
        setQueue(d.queue)
      }
    } catch (_) {}
  }

  const syncQueueToBackend = async (newQueue) => {
    try {
      await fetch('/api/studio/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: newQueue }),
      })
    } catch (_) {}
  }


  // ── Eksekusi Single Item ──
  const executeSingleJob = async (
    folder,
    mode,
    game,
    workspace,
    config,
    propagate,
    action = 'upload',
    cleanRep = true,
    customTitle = ''
  ) => {
    const effectiveGameName = mode === 'update' && game ? game.name : (customTitle?.trim() || folder.name)
    const effectiveFolderId = mode === 'update' && game ? game.folderId : null

    const actionText =
      action === 'extract'
        ? 'ekstraksi'
        : action === 'archive'
        ? 'kompresi WinRAR'
        : action === 'extract_and_upload'
        ? 'ekstrak & upload'
        : 'upload'

    setProcessState({ status: 'processing', progress: 0, text: `Memulai ${actionText}: ${effectiveGameName}...` })

    const res = await fetch('/api/studio/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderPath: folder.path,
        targetEmail: workspace?.email,
        config: config || rarConfig,
        action: action,
        mode: mode,
        targetFolderId: effectiveFolderId,
        autoPropagate: propagate,
        gameName: effectiveGameName,
        customTitle: customTitle?.trim() || effectiveGameName,
        cleanReplace: cleanRep !== false,
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `HTTP Error: ${res.status}`)
    }
  }

  const startProcessing = async (action) => {
    if (!selectedFolder) return
    if ((action === 'upload' || action === 'extract_and_upload') && !targetWorkspace) return

    setStageTab('queue_monitor')

    try {
      await executeSingleJob(
        selectedFolder,
        uploadMode,
        selectedGame,
        targetWorkspace,
        rarConfig,
        autoPropagate,
        action,
        cleanReplace,
        customCatalogTitle
      )
    } catch (e) {
      console.error('Failed to start processing:', e)
      setProcessState({ status: 'error', progress: 0, text: 'Gagal: ' + e.message })
    }
  }

  // ── Kontrol Siklus Hidup Proses (Pause, Resume, Cancel) ──
  const handleProcessControl = async (action) => {
    if (action === 'cancel') {
      setConfirmAction({
        title: 'Batalkan Proses yang Sedang Berjalan?',
        message: 'Tindakan ini akan menghentikan proses ekstraksi/kompresi WinRAR atau upload Google Drive secara instan.',
        confirmText: 'Ya, Batalkan Proses',
        confirmVariant: 'danger',
        onConfirm: async () => {
          setConfirmAction(null)
          try {
            await fetch('/api/studio/control', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'cancel' }),
            })
            if (isQueueRunningRef.current) {
              setIsQueueRunning(false)
            }
            if (activeQueueId) {
              handleQueueItemCompleted(activeQueueId, 'error', 'Dibatalkan oleh pengguna')
            }
            setCrudMessage({ type: 'info', text: 'Proses telah dibatalkan atas permintaan Anda.' })
            await checkStatus()
          } catch (e) {
            console.error('Failed to cancel process:', e)
          }
        },
      })
      return
    }

    try {
      await fetch('/api/studio/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (action === 'pause') {
        setCrudMessage({ type: 'info', text: 'Operasi berhasil dijeda (Pause).' })
      } else if (action === 'resume') {
        setCrudMessage({ type: 'success', text: 'Operasi dilanjutkan kembali (Resume).' })
      }
      await checkStatus()
    } catch (e) {
      console.error(`Failed to ${action} process:`, e)
    }
  }

  // ── Multi-Upload Queue Handlers ──
  // ── Multi-Upload Queue Handlers (Persisten & Terstruktur) ──
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
      cleanReplace,
      customTitle: customCatalogTitle?.trim() || selectedFolder.name,
      status: 'waiting', // 'waiting' | 'processing' | 'success' | 'error'
      progress: 0,
      text: 'Menunggu antrean...',
      createdAt: new Date().toISOString(),
    }

    const updated = [...queue, newItem]
    setQueue(updated)
    syncQueueToBackend(updated)
    setCrudMessage({
      type: 'success',
      text: `"${newItem.customTitle}" berhasil ditambahkan ke antrean (#${updated.length}).`,
    })
  }

  const removeFromQueue = (id) => {
    const updated = queue.filter((item) => item.id !== id)
    setQueue(updated)
    syncQueueToBackend(updated)
    if (activeQueueId === id) {
      setActiveQueueId(null)
      setIsQueueRunning(false)
    }
  }

  const reorderQueue = (fromIndex, toIndex) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= queue.length || toIndex >= queue.length) return
    const updated = [...queue]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    setQueue(updated)
    syncQueueToBackend(updated)
  }

  const retryQueueItem = (id) => {
    const updated = queue.map((q) =>
      q.id === id ? { ...q, status: 'waiting', progress: 0, text: 'Menunggu antrean...', errorDetail: null } : q
    )
    setQueue(updated)
    syncQueueToBackend(updated)
    setCrudMessage({ type: 'success', text: 'Item antrean disiapkan untuk dicoba ulang.' })
  }

  const retryAllFailed = () => {
    const updated = queue.map((q) =>
      q.status === 'error' ? { ...q, status: 'waiting', progress: 0, text: 'Menunggu antrean...', errorDetail: null } : q
    )
    setQueue(updated)
    syncQueueToBackend(updated)
    setCrudMessage({ type: 'success', text: 'Semua game gagal disiapkan untuk dicoba ulang.' })
  }

  const clearCompletedQueue = () => {
    const updated = queue.filter((item) => item.status !== 'success')
    setQueue(updated)
    syncQueueToBackend(updated)
    setCrudMessage({ type: 'success', text: 'Item selesai telah dibersihkan dari antrean.' })
  }

  const clearAllQueue = () => {
    const updated = queue.filter((item) => item.status === 'processing')
    setQueue(updated)
    syncQueueToBackend(updated)
    setCrudMessage({ type: 'success', text: 'Antrean berhasil dikosongkan.' })
  }

  const handleClearAllQueue = () => {
    if (queue.length === 0) return
    setConfirmAction({
      title: 'Kosongkan Seluruh Antrean?',
      message: `Tindakan ini akan menghapus ${queue.filter(q => q.status !== 'processing').length} game dari antrean upload.`,
      confirmText: 'Ya, Kosongkan',
      confirmVariant: 'danger',
      onConfirm: async () => {
        clearAllQueue()
        setConfirmAction(null)
      }
    })
  }

  const startQueueRunner = async () => {
    setStageTab('queue_monitor')
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
    const updated = queue.map((q) => (q.id === item.id ? { ...q, status: 'processing', text: 'Sedang memproses...' } : q))
    setQueue(updated)
    syncQueueToBackend(updated)

    try {
      await executeSingleJob(
        item.folder,
        item.mode,
        item.targetGame,
        item.workspace,
        item.rarConfig,
        item.autoPropagate,
        'upload',
        item.cleanReplace !== false,
        item.customTitle || ''
      )
    } catch (e) {
      handleQueueItemCompleted(item.id, 'error', e.message)
    }
  }

  const handleQueueItemCompleted = (itemId, resultStatus, errorMsg = '') => {
    const nextQueue = queueRef.current.map((q) =>
      q.id === itemId
        ? {
            ...q,
            status: resultStatus,
            progress: resultStatus === 'success' ? 100 : q.progress,
            text: resultStatus === 'success' ? '✓ Berhasil diupload' : `Gagal: ${errorMsg}`,
          }
        : q
    )
    setQueue(nextQueue)
    syncQueueToBackend(nextQueue)
    setActiveQueueId(null)

    // Check if there are more waiting items
    if (isQueueRunningRef.current) {
      const remaining = nextQueue.filter((q) => q.id !== itemId && q.status === 'waiting')
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

  // Ringkasan statistik antrean upload
  const queueSummary = useMemo(() => {
    const total = queue.length
    const waiting = queue.filter((q) => q.status === 'waiting').length
    const processing = queue.filter((q) => q.status === 'processing').length
    const success = queue.filter((q) => q.status === 'success').length
    const error = queue.filter((q) => q.status === 'error').length
    return { total, waiting, processing, success, error }
  }, [queue])

  const isBusy = processState.status === 'processing' || processState.status === 'paused' || isQueueRunning
  const isConfigIncomplete = !selectedFolder || !targetWorkspace || (uploadMode === 'update' && !selectedGame)

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
          <span className={`h-2 w-2 rounded-full ${isElectron ? 'bg-emerald-400' : 'bg-emerald-400'}`} />
          <span>{isElectron ? 'Desktop Electron Mode' : 'Web Hub Mode'}</span>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          TAB 1: ⚡ STUDIO CONSOLE (3-STEP PIPELINE WITH MULTI-UPLOAD QUEUE)
      ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'console' && (
        <div className="space-y-6 animate-in fade-in duration-200 relative pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 📁 STEP 1: PILIH & KELOLA GAME DI PC (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-black">
                  1
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">Pilih Game di PC</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCreateFolderOpen(true)}
                  className="flex items-center gap-1 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black px-2 py-1 text-[10px] font-bold transition-all border border-[var(--primary)]/20 cursor-pointer"
                  title="Buat folder game baru di direktori staging"
                >
                  <FolderPlus size={11} />
                  <span>+ Folder</span>
                </button>
                <button
                  type="button"
                  onClick={handleChangeStagingPath}
                  className="flex items-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-[var(--text)] px-2 py-1 text-[10px] font-bold text-[var(--text-3)] transition-all border border-white/10 cursor-pointer"
                  title="Ganti direktori staging di PC"
                >
                  <FolderOpen size={11} />
                  <span>Ganti Path</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchScan(data.path)}
                  disabled={loading}
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text)] transition-all border border-white/5 cursor-pointer disabled:opacity-50"
                  title="Segarkan daftar folder lokal"
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Notification Banner / Toast */}
            {crudMessage && (
              <div className={`mb-3 flex items-center justify-between rounded-xl p-2.5 text-[11px] font-bold animate-in fade-in slide-in-from-top-1 border ${
                crudMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  {crudMessage.type === 'success' ? <CheckCircle2 size={13} className="shrink-0" /> : <AlertCircle size={13} className="shrink-0" />}
                  <span className="truncate">{crudMessage.text}</span>
                </div>
                <button onClick={() => setCrudMessage(null)} className="opacity-60 hover:opacity-100 ml-1.5 text-xs">✕</button>
              </div>
            )}

            {/* Staging Path Breadcrumb & Search Bar */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 text-[10px] text-[var(--text-3)] font-mono border border-white/5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <HardDrive size={12} className="text-[var(--primary)] shrink-0" />
                  <span className="truncate" title={data.path || 'D:\\Game\\Shopee\\GameUpload'}>
                    📁 {data.path || 'D:\\Game\\Shopee\\GameUpload'}
                  </span>
                </div>
                <span className="font-bold text-[var(--primary)] text-[9px] bg-[var(--primary)]/10 px-2 py-0.5 rounded border border-[var(--primary)]/20 shrink-0">
                  {filteredFolders.length} Folder
                </span>
              </div>

              <input
                type="text"
                placeholder="Cari folder / game di staging..."
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
                  <p className="text-[10px] text-[var(--text-4)] mt-1">Letakkan folder game pada direktori staging:</p>
                  <p className="text-[9px] font-mono text-[var(--primary)] mt-1 break-all">{data.path || 'D:\\Game\\Shopee\\GameUpload'}</p>
                </div>
              ) : (
                filteredFolders.map((folder) => {
                  const isSelected = selectedFolder?.name === folder.name
                  return (
                    <div
                      key={folder.name + (folder.path || '')}
                      onClick={() => {
                        setSelectedFolder(folder)
                        setStageTab('inspector')
                        const cleaned = cleanReleaseName(folder.name)
                        setCustomCatalogTitle(cleaned)

                        // Auto check if this game already exists in catalog
                        const rawLower = folder.name.toLowerCase()
                        const cleanLower = cleaned.toLowerCase()
                        const match = existingGames.find(
                          (g) => g.name.toLowerCase() === rawLower || g.name.toLowerCase() === cleanLower
                        )
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
                      className={`group w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] shadow-md'
                          : 'border border-transparent bg-black/20 text-[var(--text-2)] hover:bg-white/5'
                      }`}
                    >
                      <div className="flex flex-col items-start min-w-0 pr-2">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text)]'}`}>
                          {folder.name}
                        </span>
                        {folder.isArchiveFile ? (
                          <span className="mt-1 flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-blue-400 border border-blue-500/20">
                            📦 File Arsip ({folder.archiveParts} Part • {folder.formattedSize || 'Siap'})
                          </span>
                        ) : folder.hasArchive ? (
                          <span className="mt-1 flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/20">
                            ✓ Siap Upload ({folder.archiveParts} Part)
                          </span>
                        ) : (
                          <span className="mt-0.5 text-[9px] text-[var(--text-4)]">📂 Folder Mentah (Butuh Arsip)</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Tombol CRUD Cepat */}
                        <div
                          className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* 1. Ubah Nama (Rename) */}
                          <button
                            type="button"
                            onClick={() => setRenameModal({ open: true, item: folder, newName: folder.name, loading: false, error: null })}
                            className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-amber-400 hover:bg-white/10 transition-colors"
                            title="Ubah nama folder & part arsip"
                          >
                            <Pencil size={12} />
                          </button>

                          {/* 2. Bersihkan Part RAR Saja (hanya jika ada arsip part) */}
                          {folder.hasArchive && (
                            <button
                              type="button"
                              onClick={() => handleCleanParts(folder)}
                              className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-blue-400 hover:bg-white/10 transition-colors"
                              title="Bersihkan file .part.rar sementara (hemat disk)"
                            >
                              <Eraser size={12} />
                            </button>
                          )}

                          {/* 3. Hapus Total */}
                          <button
                            type="button"
                            onClick={() => handleDeleteAll(folder)}
                            className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-red-400 hover:bg-white/10 transition-colors"
                            title="Hapus game dari disk PC"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {isSelected && <ChevronRight size={16} className="text-[var(--primary)] shrink-0 ml-1" />}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* 🚀 PANEL KANAN: DETAIL STAGE & ACTION CENTER (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 sm:p-5 shadow-xl min-h-[620px]">
            {/* 🧭 Sub-Navigasi 2 Tab di Header Panel Kanan */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {/* Tab 1: ⚙️ Konfigurasi & Aksi Game */}
                <button
                  type="button"
                  onClick={() => setStageTab('inspector')}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer ${
                    stageTab === 'inspector'
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                      : 'text-[var(--text-3)] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Settings2 size={14} />
                  <span>Konfigurasi & Aksi Game</span>
                  {selectedFolder && (
                    <span className={`hidden sm:inline-block max-w-[140px] truncate text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      stageTab === 'inspector' ? 'bg-black/20 text-black border-black/20' : 'bg-black/40 text-amber-300 border-amber-500/20'
                    }`}>
                      {selectedFolder.name}
                    </span>
                  )}
                </button>

                {/* Tab 2: 🚀 Antrean & Live Monitor */}
                <button
                  type="button"
                  onClick={() => setStageTab('queue_monitor')}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer relative ${
                    stageTab === 'queue_monitor'
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                      : 'text-[var(--text-3)] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Zap size={14} />
                  <span>Antrean & Live Monitor</span>
                  {queueSummary.total > 0 && (
                    <span className={`flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-mono font-black ${
                      stageTab === 'queue_monitor' ? 'bg-black text-emerald-400' : 'bg-emerald-500 text-black'
                    }`}>
                      {queueSummary.total}
                    </span>
                  )}
                  {isBusy && (
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
                  )}
                </button>
              </div>

              {/* Sub-Header Quick Action Links */}
              <div className="flex items-center gap-2">
                {stageTab === 'inspector' && (
                  <button
                    type="button"
                    onClick={() => setStageTab('queue_monitor')}
                    className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-3)] hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <span>Buka Live Monitor</span>
                    <ArrowRight size={13} />
                  </button>
                )}
                {stageTab === 'queue_monitor' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStageTab('inspector')}
                      className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-3)] hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <ArrowRight size={13} className="rotate-180" />
                      <span>Kembali ke Konfigurasi</span>
                    </button>
                    {processState.status !== 'idle' && processState.status !== 'processing' && (
                      <button
                        type="button"
                        onClick={resetMonitorState}
                        className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-4)] hover:text-[var(--text)] ml-2 pl-2 border-l border-white/10"
                        title="Reset monitor ke status netral"
                      >
                        <RotateCcw size={11} /> Reset
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                SUB-TAB 1: ⚙️ INSPECTOR (KONFIGURASI TARGET, MODE & PUSAT AKSI)
            ═════════════════════════════════════════════════════════════════ */}
            {stageTab === 'inspector' && (
              <div className="flex-1 flex flex-col justify-between space-y-4 animate-in fade-in duration-200">
                {!selectedFolder ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--text-3)] p-6 my-auto">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/20 mb-4 shadow-inner">
                      <UploadCloud size={36} />
                    </div>
                    <h4 className="text-sm font-black text-[var(--text)]">Pilih Game di Master Explorer untuk Memulai</h4>
                    <p className="text-xs text-[var(--text-3)] mt-1.5 max-w-md">
                      Klik salah satu folder game dari daftar direktori PC di sebelah kiri untuk melihat konfigurasi rilis, opsi part, dan eksekusi upload.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 max-w-xl w-full text-left">
                      <div className="p-3.5 rounded-xl border border-white/5 bg-black/30">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold block mb-1">Langkah 1</span>
                        <p className="text-xs text-[var(--text-2)] font-semibold">Pilih atau buat folder game di PC lokal</p>
                      </div>
                      <div className="p-3.5 rounded-xl border border-white/5 bg-black/30">
                        <span className="text-[10px] font-mono text-amber-400 font-bold block mb-1">Langkah 2</span>
                        <p className="text-xs text-[var(--text-2)] font-semibold">Tentukan mode: Game Baru vs Update Versi</p>
                      </div>
                      <div className="p-3.5 rounded-xl border border-white/5 bg-black/30">
                        <span className="text-[10px] font-mono text-blue-400 font-bold block mb-1">Langkah 3</span>
                        <p className="text-xs text-[var(--text-2)] font-semibold">Eksekusi langsung atau antrekan ke batch</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                  {/* Selected Local Folder Pill */}
                  <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-4)]">Folder Lokal Terpilih:</span>
                      <p className="text-xs font-bold text-[var(--text)] truncate">{selectedFolder.name}</p>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[var(--text-3)] shrink-0">
                      {selectedFolder.isArchiveFile
                        ? `${selectedFolder.archiveParts} Part Arsip`
                        : selectedFolder.hasArchive
                        ? `${selectedFolder.archiveParts} Part Siap`
                        : 'Folder Mentah'}
                    </span>
                  </div>

                  {/* 🌟 vs 🔄 The 2 High-Contrast Interactive Mode Cards */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-2">
                      Pilih Alur Penerbitan:
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Kartu 1: Game Baru */}
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode('new')
                          setSelectedGame(null)
                          if (!customCatalogTitle) {
                            setCustomCatalogTitle(cleanReleaseName(selectedFolder.name))
                          }
                        }}
                        className={`text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between ${
                          uploadMode === 'new'
                            ? 'border-emerald-500/80 bg-gradient-to-b from-emerald-500/15 to-emerald-950/20 shadow-lg shadow-emerald-950/40'
                            : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/5 opacity-75'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                              <Sparkles size={14} className="text-emerald-400" />
                              Game Baru
                            </span>
                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                              uploadMode === 'new'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-white/5 text-[var(--text-4)] border-white/10'
                            }`}>
                              Baru
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--text-3)] leading-tight mt-1">
                            Buat folder baru di Drive & entri baru di katalog web.
                          </p>
                        </div>
                        {uploadMode === 'new' && (
                          <div className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                            <CheckCircle2 size={11} /> Mode Aktif
                          </div>
                        )}
                      </button>

                      {/* Kartu 2: Update Versi */}
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode('update')
                          const cleaned = cleanReleaseName(selectedFolder.name).toLowerCase()
                          const rawLower = selectedFolder.name.toLowerCase()
                          const match = existingGames.find(
                            (g) => g.name.toLowerCase() === rawLower || g.name.toLowerCase() === cleanLower
                          )
                          if (match) {
                            setSelectedGame(match)
                            const primaryOwner = match.ownerEmail?.split(',')[0]?.trim()
                            const matchedWs = workspaces.find((w) => w.email === primaryOwner)
                            if (matchedWs) setTargetWorkspace(matchedWs)
                          }
                        }}
                        className={`text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between ${
                          uploadMode === 'update'
                            ? 'border-amber-500/80 bg-gradient-to-b from-amber-500/15 to-amber-950/20 shadow-lg shadow-amber-950/40'
                            : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/5 opacity-75'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                              <RefreshCw size={14} className="text-amber-400" />
                              Update Versi
                            </span>
                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                              uploadMode === 'update'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-white/5 text-[var(--text-4)] border-white/10'
                            }`}>
                              Link Aman
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--text-3)] leading-tight mt-1">
                            Perbarui file di folder Drive lama. Link pembeli tidak berubah!
                          </p>
                        </div>
                        {uploadMode === 'update' && (
                          <div className="mt-2 pt-2 border-t border-amber-500/20 flex items-center gap-1 text-[9px] font-bold text-amber-400">
                            <CheckCircle2 size={11} /> Mode Aktif
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* KONTEN DINAMIS: MODE GAME BARU */}
                  {uploadMode === 'new' && (
                    <div className="space-y-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs animate-in fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Judul Game di Katalog / Etalase */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                              Judul Game di Katalog / Etalase:
                            </label>
                            <button
                              type="button"
                              onClick={() => setCustomCatalogTitle(cleanReleaseName(selectedFolder.name))}
                              className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                              title="Bersihkan tag repacker otomatis"
                            >
                              <Sparkles size={10} /> Auto-Clean
                            </button>
                          </div>
                          <input
                            type="text"
                            value={customCatalogTitle}
                            onChange={(e) => setCustomCatalogTitle(e.target.value)}
                            placeholder="Contoh: Red Dead Redemption 2"
                            className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-xs font-bold text-[var(--text)] focus:border-emerald-400 focus:outline-none"
                          />
                          <p className="text-[9px] text-[var(--text-4)] mt-1">
                            Folder baru di Google Drive akan dinamai persis sesuai judul ini.
                          </p>
                        </div>

                        {/* Workspace Target Picker */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1.5">
                            Target Workspace Google Drive:
                          </label>
                          <select
                            value={targetWorkspace?.email || ''}
                            onChange={(e) => {
                              const ws = workspaces.find((w) => w.email === e.target.value)
                              if (ws) setTargetWorkspace(ws)
                            }}
                            className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-xs font-bold text-[var(--text)] focus:border-emerald-400 focus:outline-none"
                          >
                            {workspaces.map((ws) => (
                              <option key={ws.email} value={ws.email}>
                                {ws.email} ({ws.storage?.usageGB || '0'} / {ws.storage?.limitGB || '1024'} GB)
                              </option>
                            ))}
                          </select>
                          <p className="text-[9px] text-[var(--text-4)] mt-1">
                            File game akan diunggah ke kuota workspace Google Drive ini.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* KONTEN DINAMIS: MODE UPDATE VERSI */}
                  {uploadMode === 'update' && (
                    <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs animate-in fade-in">
                      {/* Search & Select Game Lama */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                            Pilih Game di Katalog yang Ingin Diperbarui:
                          </label>
                          <span className="text-[9px] font-mono text-[var(--text-4)]">{existingGames.length} di Katalog</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                          <input
                            type="text"
                            placeholder="🔍 Filter judul game katalog..."
                            value={catalogSearch}
                            onChange={(e) => setCatalogSearch(e.target.value)}
                            className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-amber-400 focus:outline-none"
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
                            className="rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-xs font-bold text-[var(--text)] focus:border-amber-400 focus:outline-none"
                          >
                            <option value="">-- Pilih Judul Game di Katalog --</option>
                            {filteredCatalogGames.map((g) => (
                              <option key={g.folderId} value={g.folderId}>
                                {g.name} ({g.ownerEmail} • {g.fileCount} part)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Security Shield Card: Jaminan Link Pembeli Tetap Sama */}
                      {selectedGame ? (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                            <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
                            <span>Link Pembeli Dijamin Aman 100%</span>
                          </div>
                          <p className="text-[11px] opacity-90 leading-relaxed">
                            Target: <span className="font-bold text-white">{selectedGame.name}</span> (Folder ID: <code className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-emerald-300 font-bold">{selectedGame.folderId}</code>). File versi baru akan masuk ke folder yang sama sehingga pembeli lama tidak terganggu.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                          ⚠️ Silakan pilih game target di atas untuk mengaktifkan sinkronisasi ke folder yang sudah ada.
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {/* Opsi Manajemen Part di Google Drive */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-2">
                            Metode Pembaruan Part di Drive:
                          </label>
                          <div className="space-y-2">
                            <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              cleanReplace
                                ? 'border-amber-400/40 bg-amber-400/10 text-white'
                                : 'border-white/5 bg-black/20 text-[var(--text-3)] hover:bg-white/5'
                            }`}>
                              <input
                                type="radio"
                                name="cleanReplaceRadio"
                                checked={cleanReplace}
                                onChange={() => setCleanReplace(true)}
                                className="accent-amber-400 mt-0.5"
                              />
                              <div>
                                <span className="text-xs font-bold block text-amber-300">
                                  🧹 Clean Replace (Direkomendasikan)
                                </span>
                                <span className="text-[10px] text-[var(--text-3)] block leading-tight mt-0.5">
                                  Hapus part lama di Drive sebelum upload part baru agar tidak bercampur.
                                </span>
                              </div>
                            </label>

                            <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              !cleanReplace
                                ? 'border-amber-400/40 bg-amber-400/10 text-white'
                                : 'border-white/5 bg-black/20 text-[var(--text-3)] hover:bg-white/5'
                            }`}>
                              <input
                                type="radio"
                                name="cleanReplaceRadio"
                                checked={!cleanReplace}
                                onChange={() => setCleanReplace(false)}
                                className="accent-amber-400 mt-0.5"
                              />
                              <div>
                                <span className="text-xs font-bold block text-[var(--text)]">
                                  ➕ Additive (Simpan File Lama)
                                </span>
                                <span className="text-[10px] text-[var(--text-3)] block leading-tight mt-0.5">
                                  Upload part baru tanpa menghapus file lama di Drive.
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Workspace & Auto Propagate */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-2">
                              Target Workspace Google Drive:
                            </label>
                            <select
                              value={targetWorkspace?.email || ''}
                              onChange={(e) => {
                                const ws = workspaces.find((w) => w.email === e.target.value)
                                if (ws) setTargetWorkspace(ws)
                              }}
                              className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-xs font-bold text-[var(--text)] focus:border-amber-400 focus:outline-none"
                            >
                              {workspaces.map((ws) => (
                                <option key={ws.email} value={ws.email}>
                                  {ws.email} ({ws.storage?.usageGB || '0'} / {ws.storage?.limitGB || '1024'} GB)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-start gap-2 pt-2 border-t border-amber-500/10">
                            <input
                              type="checkbox"
                              id="autoPropagateTab1"
                              checked={autoPropagate}
                              onChange={(e) => setAutoPropagate(e.target.checked)}
                              className="accent-amber-400 mt-0.5"
                            />
                            <label htmlFor="autoPropagateTab1" className="text-xs font-semibold text-[var(--text-2)] cursor-pointer">
                              Otomatis sinkronkan update ke workspace cadangan (Safe Waterfall)
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 📋 Live Action Summary Box & WinRAR Settings in Responsive Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                    {/* Summary Box (7 Cols) */}
                    <div className="md:col-span-7 rounded-xl border border-white/10 bg-black/40 p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[var(--text-4)]">
                        <span className="font-bold uppercase tracking-wider text-[9px]">Ringkasan Tindakan:</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {uploadMode === 'new' ? '🌟 Game Baru' : '🔄 Update Versi'}
                        </span>
                      </div>
                      <div className="text-[var(--text-2)] leading-relaxed text-[11px]">
                        {uploadMode === 'new' ? (
                          <>
                            Target: Folder baru <strong className="text-white">&quot;{customCatalogTitle || selectedFolder.name}&quot;</strong> di <span className="text-emerald-400">{targetWorkspace?.email || 'pilih workspace'}</span>
                          </>
                        ) : (
                          <>
                            Target: Game <strong className="text-white">&quot;{selectedGame?.name || 'Belum dipilih'}&quot;</strong> • {cleanReplace ? '🧹 Clean Replace' : '➕ Additive'} di <span className="text-amber-400">{targetWorkspace?.email || 'pilih workspace'}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Advanced WinRAR Settings Trigger & Panel (5 Cols) */}
                    <div className="md:col-span-5 rounded-xl border border-white/5 bg-black/20 p-2.5">
                      <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className="flex items-center justify-between w-full text-xs font-bold text-[var(--text-3)] hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Settings2 size={13} />
                          <span>Pengaturan WinRAR</span>
                        </span>
                        <ChevronDown size={14} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                      </button>

                      {showSettings && (
                        <div className="mt-2.5 space-y-2 pt-2 border-t border-white/5 text-xs animate-in fade-in">
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
                            <span className="text-[10px] text-red-400 font-semibold">Auto-Delete Folder Asli:</span>
                            <input
                              type="checkbox"
                              checked={rarConfig.autoDelete}
                              onChange={(e) => setRarConfig({ ...rarConfig, autoDelete: e.target.checked })}
                              className="accent-red-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 🎯 Pusat Pilihan Aksi Game Terpilih (Action Hub) */}
                  <div className="pt-4 border-t border-white/10 rounded-2xl bg-black/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
                        <Zap size={14} className="text-[var(--primary)]" />
                        <span>Pusat Aksi untuk Game Ini:</span>
                      </span>
                      {isBusy && (
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                          ⚡ Proses Aktif di Monitor
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      {/* JALUR 1: Eksekusi Langsung Sekarang (7 Cols) */}
                      <div className="md:col-span-7 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] block">
                          Jalur 1: Eksekusi Langsung Sekarang
                        </span>
                        {selectedFolder?.isArchiveFile ? (
                          <div className="space-y-2">
                            {/* Tombol Utama: Ekstrak lalu Upload */}
                            <button
                              type="button"
                              onClick={() => startProcessing('extract_and_upload')}
                              disabled={isConfigIncomplete || isBusy}
                              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 px-4 text-xs font-black text-white hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Sparkles size={16} />
                              <span>🚀 Ekstrak lalu Upload ke GDrive</span>
                            </button>

                            {/* Sub-Aksi Cepat (Grid 2 Kolom) */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => startProcessing('extract')}
                                disabled={isBusy}
                                className="rounded-xl border border-white/10 bg-white/5 py-2 px-2 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] disabled:opacity-40 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                                title="Hanya ekstrak file arsip di PC tanpa upload"
                              >
                                <FileArchive size={13} className="text-blue-400" />
                                <span>Ekstrak Saja</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => startProcessing('upload')}
                                disabled={isConfigIncomplete || isBusy}
                                className="rounded-xl border border-white/10 bg-white/5 py-2 px-2 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] disabled:opacity-40 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                                title="Upload file arsip asli ke Drive tanpa ekstrak"
                              >
                                <UploadCloud size={13} className="text-emerald-400" />
                                <span>Upload Arsip Asli</span>
                              </button>
                            </div>
                          </div>
                        ) : selectedFolder?.hasArchive ? (
                          <div className="space-y-2">
                            {/* Tombol Utama: Upload Part yang Sudah Siap */}
                            <button
                              type="button"
                              onClick={() => startProcessing('upload')}
                              disabled={isConfigIncomplete || isBusy}
                              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 px-4 text-xs font-black text-white hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <UploadCloud size={16} />
                              <span>{uploadMode === 'update' ? '🔄 Upload Update Versi ke GDrive' : '☁️ Upload Part RAR ke GDrive'}</span>
                            </button>

                            {/* Sub-Aksi: Re-archive */}
                            <button
                              type="button"
                              onClick={() => startProcessing('archive')}
                              disabled={isBusy}
                              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <FileArchive size={13} className="text-amber-400" />
                              <span>Re-Archive Ulang (WinRAR Saja)</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Tombol Utama: Kompresi & Upload Langsung */}
                            <button
                              type="button"
                              onClick={() => startProcessing('upload')}
                              disabled={isConfigIncomplete || isBusy}
                              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 px-4 text-xs font-black text-white hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Zap size={16} />
                              <span>{uploadMode === 'update' ? '⚡ Kompresi & Upload Update' : '⚡ Kompresi & Upload Langsung'}</span>
                            </button>

                            {/* Sub-Aksi: Arsip Lokal Saja */}
                            <button
                              type="button"
                              onClick={() => startProcessing('archive')}
                              disabled={isBusy}
                              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <FileArchive size={13} className="text-amber-400" />
                              <span>Arsip WinRAR Saja (Lokal PC)</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Divider / ATAU (1 Col) */}
                      <div className="hidden md:flex md:col-span-1 flex-col items-center justify-center h-full">
                        <div className="h-10 w-px bg-white/10"></div>
                        <span className="my-2 text-[9px] font-black uppercase text-[var(--text-4)] tracking-wider">ATAU</span>
                        <div className="h-10 w-px bg-white/10"></div>
                      </div>

                      {/* JALUR 2: Masukkan ke Antrean Batch (4 Cols) */}
                      <div className="md:col-span-4 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/90 block">
                          Jalur 2: Antrean Multi-Upload
                        </span>
                        <button
                          type="button"
                          onClick={addToQueue}
                          disabled={isConfigIncomplete}
                          className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 py-3 px-4 text-xs font-black text-amber-400 hover:bg-amber-400 hover:text-black disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md"
                        >
                          <ListPlus size={16} />
                          <span>➕ Masukkan Antrean</span>
                        </button>
                        <p className="text-[10px] text-[var(--text-4)] leading-tight">
                          Simpan ke antrean untuk upload otomatis bersama game lain tanpa ditunggu.
                        </p>
                        {queue.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setStageTab('queue_monitor')}
                            className="text-[10px] font-mono font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                          >
                            <span>Lihat Antrean ({queue.length} game di antrean)</span>
                            <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

            {/* ═════════════════════════════════════════════════════════════════
                SUB-TAB 2: 🚀 QUEUE & LIVE MONITOR (LIVE STATUS, LOGS & BOARD)
            ═════════════════════════════════════════════════════════════════ */}
            {stageTab === 'queue_monitor' && (
              <div className="flex-1 flex flex-col justify-between space-y-4 animate-in fade-in duration-200">

            {/* Live Progress Bar Panel / Diagnostic Error Card */}
            {processState.status === 'error' ? (
              <div className="rounded-2xl border border-red-500/40 bg-gradient-to-b from-red-950/40 to-black/60 p-4 text-xs mb-4 shadow-xl shadow-red-950/30 animate-in fade-in duration-300">
                {/* Header: Kategori Error & Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                      <AlertTriangle size={15} />
                    </span>
                    <div>
                      <span className="inline-block rounded-md bg-red-500/20 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-red-300 border border-red-500/30">
                        {processState.errorDetail?.category || 'PROSES_GAGAL'}
                      </span>
                      <h4 className="font-black text-sm text-red-200 mt-0.5">
                        {processState.errorDetail?.title || 'Terjadi Masalah pada Studio'}
                      </h4>
                    </div>
                  </div>
                  <button
                    onClick={resetMonitorState}
                    className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-[var(--text-4)] hover:bg-white/10 hover:text-white transition-colors"
                    title="Tutup Peringatan"
                  >
                    <XCircle size={14} />
                  </button>
                </div>

                {/* Bagian 1: Apa Masalahnya? */}
                <div className="rounded-xl border border-red-500/20 bg-black/40 p-3 mb-3">
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-red-400/80 mb-1">
                    🔍 Penyebab Masalah:
                  </span>
                  <p className="text-[11px] leading-relaxed text-red-100 font-medium">
                    {processState.errorDetail?.cause || processState.text || 'Operasi tidak dapat diselesaikan.'}
                  </p>
                </div>

                {/* Bagian 2: Langkah Solusi Konkret */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-3 text-amber-200">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                      💡 Tindakan yang Harus Dilakukan:
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed font-semibold text-amber-100">
                    {processState.errorDetail?.solution || 'Periksa koneksi internet, pastikan file arsip lengkap, lalu coba ulangi proses.'}
                  </p>
                  {processState.errorDetail?.actionLink && (
                    <Link
                      href={processState.errorDetail.actionLink}
                      className="inline-flex items-center gap-1.5 mt-2.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[10px] font-black text-black hover:brightness-110 shadow-md transition-all"
                    >
                      <ExternalLink size={11} /> {processState.errorDetail.actionLabel || 'Selesaikan Masalah'}
                    </Link>
                  )}
                </div>

                {/* Tombol Aksi Langsung */}
                <div className="flex items-center gap-2 mb-2">
                  {selectedFolder && (
                    <button
                      type="button"
                      onClick={() => startProcessing('upload')}
                      className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2 text-xs font-black text-white hover:brightness-110 shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw size={13} /> Coba Ulangi Proses
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetMonitorState}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[var(--text-3)] hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Reset Status
                  </button>
                </div>

                {/* Bagian 3: Detail Teknis & Log Mesin (Collapsible) */}
                <div className="pt-2 border-t border-red-500/20">
                  <button
                    type="button"
                    onClick={() => setShowTechDetails(!showTechDetails)}
                    className="flex items-center justify-between w-full text-[10px] font-mono text-red-300/70 hover:text-red-200 transition-colors py-1"
                  >
                    <span className="flex items-center gap-1">
                      <Terminal size={11} /> Detail Teknis & Log Mesin
                    </span>
                    {showTechDetails ? <ChevronDown size={12} className="rotate-180 transition-transform" /> : <ChevronDown size={12} />}
                  </button>

                  {showTechDetails && (
                    <div className="mt-2 space-y-2 rounded-xl bg-black/80 border border-white/10 p-2.5 font-mono text-[9px] text-[var(--text-3)]">
                      {processState.errorDetail?.technical && (
                        <div>
                          <span className="text-[var(--text-4)] uppercase text-[8px] font-bold">Pesan Error Asli:</span>
                          <p className="text-red-400 break-all bg-red-950/30 p-1.5 rounded border border-red-500/20 mt-0.5">
                            {processState.errorDetail.technical}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-[var(--text-4)] uppercase text-[8px] font-bold">Log Eksekusi Terakhir:</span>
                        <div className="max-h-32 overflow-y-auto space-y-0.5 mt-0.5 scrollbar-thin text-[8.5px] text-zinc-400">
                          {processState.logs && processState.logs.length > 0 ? (
                            processState.logs.map((log, i) => (
                              <div key={i} className="leading-tight truncate">
                                {log}
                              </div>
                            ))
                          ) : (
                            <span className="text-[var(--text-4)]">Tidak ada log tercatat.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Live Progress Bar Panel (Processing / Paused / Cancelled / Success / Idle) */
              <div
                className={`rounded-2xl p-4 text-xs transition-all duration-500 border mb-4 ${
                  processState.status === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : processState.status === 'paused'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : processState.status === 'cancelled'
                    ? 'border-zinc-700 bg-zinc-900/60 text-zinc-300'
                    : processState.status === 'processing'
                    ? 'border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-white/5 bg-black/20 text-[var(--text-4)]'
                }`}
              >
                <div className="flex items-center justify-between font-black text-xs mb-2">
                  <span className="flex items-center gap-2">
                    {processState.status === 'processing' && <Loader2 size={13} className="animate-spin text-[var(--primary)]" />}
                    {processState.status === 'paused' && <Pause size={13} className="text-amber-400 animate-pulse" />}
                    {processState.status === 'cancelled' && <XCircle size={13} className="text-zinc-400" />}
                    {processState.status === 'processing'
                      ? 'SEDANG BERJALAN...'
                      : processState.status === 'paused'
                      ? 'DIJEDA OLEH PENGGUNA'
                      : processState.status === 'cancelled'
                      ? 'PROSES DIBATALKAN'
                      : processState.status === 'success'
                      ? 'PROSES SELESAI'
                      : 'SIAP EKSEKUSI (NETRAL)'}
                  </span>
                  <span className="font-mono text-sm">{processState.progress || 0}%</span>
                </div>

                <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      processState.status === 'success'
                        ? 'bg-emerald-500'
                        : processState.status === 'paused'
                        ? 'bg-amber-400'
                        : processState.status === 'cancelled'
                        ? 'bg-zinc-600'
                        : processState.status === 'processing'
                        ? 'bg-gradient-to-r from-[var(--primary)] to-amber-300'
                        : 'bg-transparent'
                    }`}
                    style={{ width: `${processState.progress || 0}%` }}
                  />
                </div>
                <p className="text-[10px] font-medium truncate opacity-90 mb-2">
                  {processState.status === 'idle'
                    ? 'Belum ada proses berjalan. Siap mengeksekusi upload.'
                    : processState.status === 'cancelled'
                    ? 'Operasi dihentikan dan dibatalkan atas permintaan pengguna.'
                    : processState.text || 'Memproses berkas...'}
                </p>

                {/* 🎮 Tombol Kontrol Langsung: Pause, Resume, Cancel */}
                {processState.status === 'processing' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => handleProcessControl('pause')}
                      className="flex-1 rounded-xl bg-amber-500/20 border border-amber-500/30 py-1.5 px-3 text-[11px] font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-1.5"
                      title="Jeda sementara proses yang sedang berjalan"
                    >
                      <Pause size={12} /> Jeda Proses
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProcessControl('cancel')}
                      className="rounded-xl bg-red-500/10 border border-red-500/20 py-1.5 px-3 text-[11px] font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1.5"
                      title="Hentikan dan batalkan proses sekarang"
                    >
                      <XCircle size={12} /> Batalkan
                    </button>
                  </div>
                )}

                {processState.status === 'paused' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20">
                    <button
                      type="button"
                      onClick={() => handleProcessControl('resume')}
                      className="flex-1 rounded-xl bg-emerald-500 py-1.5 px-3 text-[11px] font-black text-black hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                      title="Lanjutkan kembali proses yang dijeda"
                    >
                      <Play size={12} /> Lanjutkan Proses
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProcessControl('cancel')}
                      className="rounded-xl bg-red-500/10 border border-red-500/20 py-1.5 px-3 text-[11px] font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1.5"
                      title="Hentikan dan batalkan proses sekarang"
                    >
                      <XCircle size={12} /> Batalkan
                    </button>
                  </div>
                )}

                {processState.status === 'cancelled' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={resetMonitorState}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 py-1.5 px-3 text-[11px] font-bold text-[var(--text-3)] hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw size={12} /> Reset Monitor
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 📋 Multi-Upload Queue Board */}
            <div className="flex-1 flex flex-col justify-between space-y-3">
              <div className="flex flex-col flex-1 min-h-[280px] max-h-[460px] rounded-xl border border-white/5 bg-black/30 p-3">
                {/* Header Board */}
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5 gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-1.5">
                      <Layers size={12} className="text-amber-400" />
                      <span>Antrean Upload ({queueSummary.total})</span>
                    </span>
                    {queueSummary.waiting > 0 && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[8.5px] font-mono font-bold text-amber-300 border border-amber-500/30">
                        {queueSummary.waiting} antre
                      </span>
                    )}
                    {queueSummary.processing > 0 && (
                      <span className="rounded-full bg-blue-500/20 px-1.5 py-0.2 text-[8.5px] font-mono font-bold text-blue-300 border border-blue-500/30">
                        {queueSummary.processing} aktif
                      </span>
                    )}
                    {queueSummary.success > 0 && (
                      <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[8.5px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                        {queueSummary.success} sukses
                      </span>
                    )}
                    {queueSummary.error > 0 && (
                      <span className="rounded-full bg-red-500/20 px-1.5 py-0.2 text-[8.5px] font-mono font-bold text-red-300 border border-red-500/30">
                        {queueSummary.error} gagal
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {queueSummary.error > 0 && (
                      <button
                        type="button"
                        onClick={retryAllFailed}
                        className="text-[9px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold transition-colors cursor-pointer"
                        title="Ulangi semua game yang gagal"
                      >
                        <RotateCcw size={10} /> Ulangi Gagal
                      </button>
                    )}
                    {queueSummary.success > 0 && (
                      <button
                        type="button"
                        onClick={clearCompletedQueue}
                        className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold transition-colors cursor-pointer"
                        title="Hapus game yang sukses dari antrean"
                      >
                        <Eraser size={10} /> Bersihkan Selesai
                      </button>
                    )}
                    {queueSummary.total > 0 && !isQueueRunning && (
                      <button
                        type="button"
                        onClick={handleClearAllQueue}
                        className="text-[9px] text-[var(--text-4)] hover:text-red-400 flex items-center gap-1 font-bold transition-colors cursor-pointer"
                        title="Kosongkan seluruh antrean"
                      >
                        <Trash2 size={10} /> Kosongkan
                      </button>
                    )}
                  </div>
                </div>

                {/* Queue Items List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10 text-[var(--text-4)]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 mb-2.5">
                        <Layers size={22} className="opacity-40 text-amber-400" />
                      </div>
                      <p className="text-xs font-bold text-[var(--text-2)]">Antrean upload batch masih kosong</p>
                      <p className="text-[10px] text-[var(--text-4)] mt-1 max-w-xs leading-relaxed">
                        Pilih game di Master Explorer, tentukan opsi upload di tab Konfigurasi, lalu klik &quot;➕ Masukkan Antrean&quot;.
                      </p>
                      <button
                        type="button"
                        onClick={() => setStageTab('inspector')}
                        className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-white transition-all cursor-pointer shadow-sm"
                      >
                        <Settings2 size={13} className="text-amber-400" />
                        <span>Ke Konfigurasi Game</span>
                      </button>
                    </div>
                  ) : (
                    queue.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`rounded-lg p-2.5 text-xs border transition-all flex items-center gap-2 ${
                          item.status === 'processing'
                            ? 'border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/20'
                            : item.status === 'success'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : item.status === 'error'
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : 'border-white/5 bg-black/40 text-[var(--text-2)] hover:border-white/10'
                        }`}
                      >
                        {/* 1. Urutan & Tombol Reorder Up / Down */}
                        <div className="flex flex-col items-center justify-center shrink-0 pr-1.5 border-r border-white/5">
                          <button
                            type="button"
                            onClick={() => reorderQueue(idx, idx - 1)}
                            disabled={idx === 0 || item.status === 'processing' || isQueueRunning}
                            className="p-0.5 rounded text-[var(--text-4)] hover:text-white disabled:opacity-20 hover:bg-white/10 transition-colors"
                            title="Naikkan urutan prioritas"
                          >
                            <ChevronUp size={11} />
                          </button>
                          <span className="font-mono text-[9px] font-bold text-[var(--text-3)] leading-none my-0.5">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => reorderQueue(idx, idx + 1)}
                            disabled={idx === queue.length - 1 || item.status === 'processing' || isQueueRunning}
                            className="p-0.5 rounded text-[var(--text-4)] hover:text-white disabled:opacity-20 hover:bg-white/10 transition-colors"
                            title="Turunkan urutan prioritas"
                          >
                            <ChevronDown size={11} />
                          </button>
                        </div>

                        {/* 2. Detail Konten Game */}
                        <div className="flex-1 min-w-0 px-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[11px] text-[var(--text)] truncate max-w-[280px] sm:max-w-md" title={item.customTitle || item.folder?.name}>
                              {item.customTitle || item.folder?.name}
                            </span>
                            {item.mode === 'update' ? (
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[8px] font-bold text-amber-300 border border-amber-500/30">
                                UPDATE
                              </span>
                            ) : (
                              <span className="rounded bg-blue-500/20 px-1.5 py-0.2 text-[8px] font-bold text-blue-300 border border-blue-500/30">
                                BARU
                              </span>
                            )}
                            {item.mode === 'update' && (
                              <span className={`rounded px-1.5 py-0.2 text-[8px] font-semibold border ${item.cleanReplace ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                {item.cleanReplace ? 'Clean' : 'Additive'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-4)] mt-0.5 truncate">
                            {item.customTitle && item.customTitle !== item.folder?.name && (
                              <span className="truncate max-w-[140px] opacity-75">📁 {item.folder?.name} •</span>
                            )}
                            <span className="truncate">☁️ {item.workspace?.email}</span>
                          </div>

                          {item.status === 'error' && (
                            <p className="text-[9px] text-red-400 mt-1 truncate font-mono">
                              ⚠️ {item.text || 'Gagal diproses'}
                            </p>
                          )}
                        </div>

                        {/* 3. Status Badge & Actions */}
                        <div className="flex items-center gap-1 shrink-0 pl-1">
                          {item.status === 'processing' && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              <Loader2 size={10} className="animate-spin" /> {item.progress || 0}%
                            </span>
                          )}
                          {item.status === 'success' && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                              ✓ Selesai
                            </span>
                          )}
                          {item.status === 'waiting' && (
                            <span className="text-[9px] text-[var(--text-4)] bg-white/5 px-1.5 py-0.5 rounded font-mono">
                              Antre
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded font-mono">
                              Gagal
                            </span>
                          )}

                          {/* Tombol Retry per item */}
                          {item.status === 'error' && (
                            <button
                              type="button"
                              onClick={() => retryQueueItem(item.id)}
                              className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
                              title="Coba lagi item ini"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}

                          {/* Tombol Hapus */}
                          {item.status !== 'processing' && (
                            <button
                              type="button"
                              onClick={() => removeFromQueue(item.id)}
                              className="p-1 rounded text-[var(--text-4)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Hapus dari antrean"
                            >
                              <XCircle size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 🚀 Pusat Kontrol Antrean Batch (Runner Footer) */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                {queue.length > 0 ? (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={isQueueRunning ? pauseQueueRunner : startQueueRunner}
                      disabled={processState.status === 'processing' && !isQueueRunning}
                      className={`w-full rounded-xl py-3 text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:cursor-not-allowed ${
                        isQueueRunning
                          ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20 animate-pulse'
                          : 'bg-gradient-to-r from-[var(--primary)] to-amber-400 text-black hover:brightness-110 shadow-[0_0_20px_rgba(255,209,0,0.3)] disabled:opacity-40'
                      }`}
                    >
                      {isQueueRunning ? <Pause size={15} /> : <Play size={15} />}
                      <span>
                        {isQueueRunning
                          ? `⏸️ Jeda Antrean (${queueSummary.waiting} Menunggu)`
                          : `🚀 Jalankan Seluruh Antrean (${queueSummary.waiting} Game Menunggu)`}
                      </span>
                    </button>
                    <p className="text-[9px] text-[var(--text-4)] text-center font-mono">
                      {isQueueRunning
                        ? '⚡ Runner aktif: upload dieksekusi sekuensial satu per satu.'
                        : queueSummary.waiting > 0
                        ? 'Tekan tombol di atas untuk mengeksekusi antrean secara berurutan.'
                        : 'Semua item antrean telah selesai atau memerlukan coba lagi.'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-center">
                    <p className="text-[10px] font-bold text-[var(--text-3)]">💡 Mode Antrean Batch Siap</p>
                    <p className="text-[9px] text-[var(--text-4)] mt-0.5">
                      Tambahkan game dari Step 2 melalui tombol &quot;➕ Masukkan ke Antrean Batch&quot; untuk upload banyak game otomatis.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>

        {/* 🌟 Floating Bottom Mini-Status Bar (Saat Upload Berjalan di Background) */}
        {isBusy && stageTab !== 'queue_monitor' && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl border border-emerald-500/40 bg-zinc-950/95 backdrop-blur-md px-5 py-3 shadow-2xl shadow-emerald-950/60 max-w-xl w-[92%] sm:w-auto animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {processState.status === 'paused' ? (
                  <Pause size={16} className="text-amber-400 animate-pulse" />
                ) : (
                  <Loader2 size={16} className="animate-spin text-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    {processState.status === 'paused' ? 'Dijeda' : 'Proses Berjalan'}
                  </span>
                  <span className="text-xs font-mono font-black text-white">{processState.progress || 0}%</span>
                </div>
                <p className="text-xs font-medium text-[var(--text-2)] truncate max-w-[200px] sm:max-w-xs">
                  {processState.text || 'Memproses berkas...'}
                </p>
              </div>
            </div>

            {/* Quick Controls: Pause / Resume / Cancel */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-3 border-l border-white/10">
              {processState.status === 'processing' && (
                <button
                  type="button"
                  onClick={() => handleProcessControl('pause')}
                  className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-black transition-colors cursor-pointer"
                  title="Jeda Sementara"
                >
                  <Pause size={14} />
                </button>
              )}
              {processState.status === 'paused' && (
                <button
                  type="button"
                  onClick={() => handleProcessControl('resume')}
                  className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-black transition-colors cursor-pointer"
                  title="Lanjutkan Proses"
                >
                  <Play size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleProcessControl('cancel')}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                title="Batalkan Proses"
              >
                <XCircle size={14} />
              </button>

              {/* Buka Live Monitor */}
              <button
                type="button"
                onClick={() => setStageTab('queue_monitor')}
                className="ml-1 flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-black hover:bg-emerald-400 shadow transition-all cursor-pointer"
              >
                <span>Buka Monitor</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        )}
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

      {/* ── Dialog Konfirmasi CRUD (Hapus Game / Bersihkan Part) ── */}
      <ConfirmDialog
        open={!!confirmAction}
        {...confirmAction}
        onClose={() => setConfirmAction(null)}
      />

      {/* ── Modal Buat Folder Baru ── */}
      {createFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2 text-[var(--primary)]">
                <FolderPlus size={18} />
                <h3 className="text-sm font-bold text-[var(--text)]">Buat Folder Game Baru</h3>
              </div>
              <button
                onClick={() => setCreateFolderOpen(false)}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-3)] block mb-1.5">
                  Nama Folder di Staging ({data.path || 'D:\\Game\\Shopee\\GameUpload'})
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Contoh: God of War Ragnarok"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCreateFolderOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="px-4 py-2 rounded-xl bg-[var(--primary)] text-black text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-[var(--primary)]/20"
                >
                  {creatingFolder && <Loader2 size={12} className="animate-spin" />}
                  <span>Buat Folder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Ubah Nama (Rename Game & Part Arsip) ── */}
      {renameModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2 text-amber-400">
                <Pencil size={18} />
                <h3 className="text-sm font-bold text-[var(--text)]">Ubah Nama Game & Part Arsip</h3>
              </div>
              <button
                onClick={() => setRenameModal({ open: false, item: null, newName: '', loading: false, error: null })}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {renameModal.error && (
              <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 p-2.5 text-[11px] text-red-400 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{renameModal.error}</span>
              </div>
            )}
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-3)] block mb-1.5">
                  Nama Baru Game di Disk
                </label>
                <input
                  type="text"
                  autoFocus
                  value={renameModal.newName}
                  onChange={(e) => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-[var(--text)] focus:border-amber-400 focus:outline-none"
                />
              </div>

              {renameModal.item?.hasArchive && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Sparkles size={12} /> Auto-Sync Part Arsip
                  </p>
                  <p className="text-[10px] opacity-90 leading-relaxed">
                    Game ini memiliki {renameModal.item.archiveParts} part arsip. Sistem akan otomatis memperbarui nama seluruh file .part.rar di disk agar tetap konsisten.
                  </p>
                </div>
              )}

              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModal({ open: false, item: null, newName: '', loading: false, error: null })}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={renameModal.loading || !renameModal.newName.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  {renameModal.loading && <Loader2 size={12} className="animate-spin" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Ganti Direktori Staging (Web Hub Fallback) ── */}
      {stagingPathModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2 text-[var(--primary)]">
                <FolderOpen size={18} />
                <h3 className="text-sm font-bold text-[var(--text)]">Ganti Direktori Staging</h3>
              </div>
              <button
                onClick={() => setStagingPathModal({ open: false, path: '', loading: false, error: null })}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {stagingPathModal.error && (
              <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 p-2.5 text-[11px] text-red-400 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{stagingPathModal.error}</span>
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); saveAndSwitchStaging(stagingPathModal.path); }} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-3)] block mb-1.5">
                  Path Direktori di PC
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Contoh: D:\Game\Shopee\GameUpload atau E:\Games"
                  value={stagingPathModal.path}
                  onChange={(e) => setStagingPathModal(prev => ({ ...prev, path: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-mono text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStagingPathModal({ open: false, path: '', loading: false, error: null })}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={stagingPathModal.loading || !stagingPathModal.path.trim()}
                  className="px-4 py-2 rounded-xl bg-[var(--primary)] text-black text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-[var(--primary)]/20"
                >
                  {stagingPathModal.loading && <Loader2 size={12} className="animate-spin" />}
                  <span>Terapkan Path</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

