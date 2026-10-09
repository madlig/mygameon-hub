'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import WorkbenchHeader from '@/components/workbench/WorkbenchHeader'
import WorkbenchView from '@/components/workbench/WorkbenchView'
import UploadHistoryTab from '@/components/workbench/UploadHistoryTab'
import QueueDrawer from '@/components/workbench/QueueDrawer'
import StagingModals from '@/components/workbench/StagingModals'
import { cleanReleaseName } from '@/lib/utils'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { useToast } from '@/components/ui/Toast'

export default function WorkbenchPage() {
  const { toast } = useToast()

  // ── Navigation & Tab State ──
  const [activeTab, setActiveTab] = useState('workbench') // 'workbench' | 'history'
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false)
  const [isElectron, setIsElectron] = useState(true)

  // ── Staging Local Folders Data ──
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ path: '', folders: [] })
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [targetWorkspace, setTargetWorkspace] = useState(null)

  // ── Mode Upload & Penamaan ──
  const [uploadMode, setUploadMode] = useState('new') // 'new' | 'update'
  const [existingGames, setExistingGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [customCatalogTitle, setCustomCatalogTitle] = useState('')
  const [cleanReplace, setCleanReplace] = useState(true)
  const [autoCleanupLocal, setAutoCleanupLocal] = useState(false)
  const [rarConfig, setRarConfig] = useState({ splitSize: 4100 })
  const [fileVersion, setFileVersion] = useState('')

  // ── Modals State ──
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [renameModal, setRenameModal] = useState({ open: false, item: null, newName: '' })
  const [stagingPathModal, setStagingPathModal] = useState({ open: false, path: '' })
  const [confirmAction, setConfirmAction] = useState(null)

  // ── History & Queue State ──
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [queue, setQueue] = useState([])
  const [isQueueRunning, setIsQueueRunning] = useState(false)
  const [activeQueueId, setActiveQueueId] = useState(null)
  const queueRef = useRef([])
  const isQueueRunningRef = useRef(false)
  queueRef.current = queue
  isQueueRunningRef.current = isQueueRunning

  // ── Process Execution State ──
  const [processState, setProcessState] = useState({ status: 'idle', progress: 0, text: '', logs: [] })
  const isUploading = processState?.status === 'processing' || processState?.status === 'uploading'
  useNavigationGuard(isUploading, 'Proses kompresi/upload ke Google Drive sedang berjalan. Tinggalkan halaman?')

  // ── 1. Fetch Workspaces & Catalog Existing Games ──
  const fetchWorkspacesAndCatalog = useCallback(async () => {
    try {
      // Workspaces
      const wsRes = await fetch('/api/files/workspaces')
      const wsJson = await wsRes.json()
      if (wsJson.success && Array.isArray(wsJson.workspaces)) {
        setWorkspaces(wsJson.workspaces)
        if (!targetWorkspace && wsJson.workspaces.length > 0) {
          setTargetWorkspace(wsJson.workspaces[0])
        }
      }

      // Existing Games di MongoDB GameCatalog
      const catRes = await fetch('/api/search?q=')
      const catJson = await catRes.json()
      if (catJson.games && Array.isArray(catJson.games)) {
        setExistingGames(catJson.games)
      }
    } catch (err) {
      console.error('Failed to load workspaces/catalog:', err)
    }
  }, [targetWorkspace])

  // ── 2. Handler Pilih Folder Game di PC ──
  const handleSelectFolder = useCallback((folder) => {
    setSelectedFolder(folder)
    if (!folder) return
    const cleaned = cleanReleaseName(folder.name)
    setCustomCatalogTitle(cleaned)

    // Cek apakah game sudah pernah ada di katalog (Auto-match mode Update)
    const rawLower = folder.name.toLowerCase()
    const cleanLower = cleaned.toLowerCase()
    const match = existingGames.find(
      (g) => (g.name || g.title || '').toLowerCase() === rawLower || (g.name || g.title || '').toLowerCase() === cleanLower
    )
    if (match) {
      setSelectedGame(match)
      setUploadMode('update')
      setFileVersion(match.fileVersion || '')
      const primaryOwner = match.ownerEmail?.split(',')[0]?.trim()
      const matchedWs = workspaces.find((w) => w.email === primaryOwner)
      if (matchedWs) setTargetWorkspace(matchedWs)
    } else {
      setSelectedGame(null)
      setUploadMode('new')
      setFileVersion('')
    }
  }, [existingGames, workspaces])

  const selectedFolderRef = useRef(selectedFolder)
  selectedFolderRef.current = selectedFolder

  // ── 3. Scan Folder PC Lokal ──
  const fetchScan = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/studio/scan')
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const json = await res.json()
      if (json.success) {
        setData({ path: json.path || '', folders: json.folders || [] })
        if (json.folders?.length > 0 && !selectedFolderRef.current) {
          handleSelectFolder(json.folders[0])
        }
      } else if (!silent) {
        toast(json.error || 'Gagal memindai folder lokal', 'error')
      }
    } catch (err) {
      if (!silent) toast(err.message || 'Gagal terhubung ke scanner folder', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [handleSelectFolder, toast])

  // ── 4. Fetch Riwayat Upload ──
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/studio/history')
      const json = await res.json()
      if (json.success && Array.isArray(json.history)) {
        setHistory(json.history)
      }
    } catch (_) {
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // ── 5. Fetch Queue ──
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/queue')
      const json = await res.json()
      if (json.success && Array.isArray(json.queue)) {
        setQueue(json.queue)
      }
    } catch (_) {}
  }, [])

  // Inisialisasi awal sekali saat mount
  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI)
    fetchWorkspacesAndCatalog()
    fetchScan()
    fetchHistory()
    fetchQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-Detect Handoff & Auto-Sync (Tanpa Reload Manual) ──
  useEffect(() => {
    const handleSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchScan(true)
        fetchQueue()
      }
    }

    window.addEventListener('focus', handleSync)
    document.addEventListener('visibilitychange', handleSync)

    // Polling berkala ringan setiap 10 detik saat tab aktif dan tidak sedang upload
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isUploading) {
        fetchScan(true)
        fetchQueue()
      }
    }, 10000)

    return () => {
      window.removeEventListener('focus', handleSync)
      document.removeEventListener('visibilitychange', handleSync)
      clearInterval(interval)
    }
  }, [fetchScan, fetchQueue, isUploading])

  // ── Polling Status Proses Eksekusi ──
  useEffect(() => {
    let timer
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/studio/status')
        const json = await res.json()
        const stateData = json.state || (json.status ? json : null)
        if (stateData) {
          setProcessState((prev) => {
            // Jika baru saja selesai sukses
            if (stateData.status === 'success' && prev?.status === 'processing') {
              toast('Pekerjaan upload berhasil selesai!', 'success')
              fetchHistory()
              fetchScan()

              // Jika toggle autoCleanupLocal aktif
              if (autoCleanupLocal && selectedFolder) {
                handleCleanParts(selectedFolder, true)
              }
            }
            return stateData
          })
        }
      } catch (_) {}
    }

    // Jalankan 1x saat mount untuk memulihkan proses yang sedang berjalan
    checkStatus()

    if (processState.status === 'processing' || processState.status === 'paused' || isQueueRunning) {
      timer = setInterval(checkStatus, 1500)
    }
    return () => clearInterval(timer)
  }, [processState.status, isQueueRunning, autoCleanupLocal, selectedFolder, fetchHistory, fetchScan])

  // ── Eksekusi Single Upload / Archive / Extract ──
  const startProcessing = async (action = 'upload', uploadOptions = {}) => {
    if (!selectedFolder) return
    const isUploadAction = action === 'upload' || action === 'extract_and_upload'
    if (isUploadAction && !targetWorkspace) {
      toast('Pilih akun Google Drive terlebih dahulu', 'error')
      return
    }

    try {
      const actionName =
        action === 'extract'
          ? 'ekstraksi arsip'
          : action === 'archive'
          ? 'kompresi WinRAR'
          : 'upload ke Google Drive'

      const res = await fetch('/api/studio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: selectedFolder.path,
          targetFilePath: uploadOptions.targetFilePath || null,
          targetEmail: targetWorkspace?.email || null,
          action,
          mode: uploadMode,
          customTitle: customCatalogTitle || cleanReleaseName(selectedFolder.name),
          cleanReplace: uploadOptions.cleanReplace ?? cleanReplace,
          config: uploadOptions.config || rarConfig,
          targetFolderId: uploadOptions.targetFolderId || null,
          resume: uploadOptions.resume ?? true,
          forceWipeExisting: uploadOptions.forceWipeExisting ?? false,
          selectedParts: uploadOptions.selectedParts || null,
          fileVersion: uploadOptions.fileVersion ?? fileVersion,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast(`Memulai proses ${actionName}...`, 'success')
        setProcessState({ status: 'processing', progress: 0, text: `Memulai ${actionName}...`, logs: [] })
      } else {
        toast(json.error || 'Gagal memulai pekerjaan', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  // ── Kontrol Siklus Hidup Proses (Pause, Resume, Cancel) ──
  const handleProcessControl = async (action) => {
    try {
      const res = await fetch('/api/studio/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.success) {
        toast(`Berhasil mengirim perintah: ${action}`, 'success')
      } else {
        toast(json.error || 'Gagal mengontrol proses', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  // ── Reset Status Selesai / Error ke Idle ──
  const handleResetProcessState = async () => {
    try {
      await fetch('/api/studio/status', { method: 'DELETE' })
      setProcessState({ status: 'idle', progress: 0, text: '', logs: [] })
    } catch (_) {
      setProcessState({ status: 'idle', progress: 0, text: '', logs: [] })
    }
  }

  // ── Queue Runner dengan Kebijakan Skip & Lanjut Saat Error ──
  const processNextQueueItem = async () => {
    if (!isQueueRunningRef.current) return
    const currentQ = queueRef.current
    const nextItem = currentQ.find((item) => item.status === 'waiting')

    if (!nextItem) {
      setIsQueueRunning(false)
      setActiveQueueId(null)
      toast('Seluruh antrean batch upload selesai diproses!', 'success')
      return
    }

    setActiveQueueId(nextItem.id)
    // Update status item jadi processing
    const updatedQueue = currentQ.map((q) =>
      q.id === nextItem.id ? { ...q, status: 'processing', progress: 0, text: 'Memulai...' } : q
    )
    setQueue(updatedQueue)
    saveQueueToBackend(updatedQueue)

    try {
      const res = await fetch('/api/studio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: nextItem.folder.path,
          targetEmail: nextItem.targetEmail,
          action: 'upload',
          mode: nextItem.mode || 'new',
          customTitle: nextItem.customTitle,
          cleanReplace: nextItem.cleanReplace ?? true,
          config: nextItem.config || { splitSize: 4100 },
          targetFolderId: nextItem.targetFolderId || null,
          resume: nextItem.resume ?? true,
          forceWipeExisting: nextItem.forceWipeExisting ?? false,
          selectedParts: nextItem.selectedParts || null,
        }),
      })
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || 'Gagal inisialisasi proses upload')
      }

      // Tunggu hingga proses selesai dipantau
      const success = await monitorJobUntilComplete(nextItem.id)

      if (success) {
        // Tandai item berhasil
        const finQueue = queueRef.current.map((q) =>
          q.id === nextItem.id ? { ...q, status: 'success', progress: 100, text: 'Selesai Terunggah' } : q
        )
        setQueue(finQueue)
        saveQueueToBackend(finQueue)

        // Bersihkan part lokal jika diminta
        if (nextItem.autoCleanupLocal) {
          handleCleanParts(nextItem.folder, true)
        }
      } else {
        throw new Error('Proses upload terhenti atau mengalami galat')
      }
    } catch (err) {
      // ⚠️ SKENARIO A4: SKIP & LANJUT SAAT ERROR
      console.error(`Queue item ${nextItem.id} failed:`, err)
      const failedQueue = queueRef.current.map((q) =>
        q.id === nextItem.id ? { ...q, status: 'failed', error: err.message, text: 'Gagal' } : q
      )
      setQueue(failedQueue)
      saveQueueToBackend(failedQueue)
      toast(`Item "${nextItem.customTitle}" gagal: ${err.message}. Otomatis lanjut ke item berikutnya.`, 'warning')
    }

    // Lanjut ke item berikutnya
    setTimeout(() => {
      if (isQueueRunningRef.current) {
        processNextQueueItem()
      }
    }, 1500)
  }

  const monitorJobUntilComplete = (itemId) => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        if (!isQueueRunningRef.current) {
          clearInterval(checkInterval)
          resolve(false)
          return
        }

        try {
          const res = await fetch('/api/studio/status')
          const json = await res.json()
          if (json.success && json.state) {
            setProcessState(json.state)

            if (json.state.status === 'success') {
              clearInterval(checkInterval)
              resolve(true)
            } else if (json.state.status === 'error' || json.state.status === 'cancelled') {
              clearInterval(checkInterval)
              resolve(false)
            }
          }
        } catch (_) {}
      }, 2500)
    })
  }

  const saveQueueToBackend = async (newQueue) => {
    try {
      await fetch('/api/studio/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: newQueue }),
      })
    } catch (_) {}
  }

  const handleAddToQueue = (queueOptions = {}) => {
    if (!selectedFolder) return
    if (!targetWorkspace) {
      toast('Pilih akun Google Drive tujuan', 'error')
      return
    }

    const newItem = {
      id: `q_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      folder: selectedFolder,
      targetEmail: targetWorkspace.email,
      customTitle: customCatalogTitle || cleanReleaseName(selectedFolder.name),
      mode: uploadMode,
      cleanReplace: queueOptions.cleanReplace ?? cleanReplace,
      config: rarConfig,
      autoCleanupLocal,
      status: 'waiting',
      addedAt: new Date().toISOString(),
      targetFolderId: queueOptions.targetFolderId || null,
      resume: queueOptions.resume ?? true,
      remainingCount: queueOptions.remainingCount ?? null,
      forceWipeExisting: queueOptions.forceWipeExisting ?? false,
    }

    const updated = [...queue, newItem]
    setQueue(updated)
    saveQueueToBackend(updated)
    toast(`"${newItem.customTitle}" ditambahkan ke antrean batch.`, 'success')
  }

  const handleStartQueue = () => {
    setIsQueueRunning(true)
    isQueueRunningRef.current = true
    processNextQueueItem()
  }

  const handlePauseQueue = () => {
    setIsQueueRunning(false)
    isQueueRunningRef.current = false
    handleProcessControl('pause')
    toast('Antrean batch dijeda.', 'info')
  }

  // ── Handlers CRUD Folder Staging ──
  const handleCreateFolder = async (name) => {
    const res = await fetch('/api/studio/local-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderName: name, stagingPath: data.path }),
    })
    const json = await res.json()
    if (json.success) {
      toast(`Folder "${name}" berhasil dibuat.`, 'success')
      fetchScan()
    } else {
      toast(json.error || 'Gagal membuat folder', 'error')
    }
  }

  const handleRenameFolder = async (folder, newName) => {
    const res = await fetch('/api/studio/local-games', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath: folder.path, newName, stagingPath: data.path }),
    })
    const json = await res.json()
    if (json.success) {
      toast(`Nama folder berhasil diubah.`, 'success')
      fetchScan()
    } else {
      toast(json.error || 'Gagal mengubah nama folder', 'error')
    }
  }

  const handleUpdateStagingPath = async (newPath) => {
    const res = await fetch('/api/studio/local-games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stagingPath: newPath }),
    })
    const json = await res.json()
    if (json.success) {
      toast(`Direktori staging PC berhasil diubah.`, 'success')
      fetchScan()
    } else {
      toast(json.error || 'Gagal mengubah direktori staging', 'error')
    }
  }

  const handleDeleteFolder = (folder) => {
    if (!folder) return
    setConfirmAction({
      title: 'Hapus Folder Game dari PC?',
      description: `PERINGATAN: Seluruh isi folder "${folder.name}" (${folder.formattedSize || ''}) akan dihapus permanen dari harddisk!`,
      confirmLabel: 'Hapus Permanen',
      tone: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/studio/local-games', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'delete_folder',
              folderPath: folder.path,
              itemName: folder.name,
              stagingPath: data.path,
              folderSize: folder.size || 0,
            }),
          })
          const json = await res.json()
          if (json.success) {
            toast(json.message || `Folder "${folder.name}" berhasil dihapus (${json.formattedFreed || ''} dibebaskan).`, 'success')
            if (selectedFolder?.name === folder.name) {
              setSelectedFolder(null)
            }
            fetchScan()
          } else {
            toast(json.error || 'Gagal menghapus folder', 'error')
          }
        } catch (err) {
          toast(err.message, 'error')
        } finally {
          setConfirmAction(null)
        }
      },
    })
  }

  const handleCleanParts = (folder, silent = false, partNames = []) => {
    const executeClean = async () => {
      try {
        const res = await fetch('/api/studio/local-games', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'clean_parts_only',
            folderPath: folder.path,
            itemName: folder.name,
            stagingPath: data.path,
            partNames: Array.isArray(partNames) ? partNames : [],
          }),
        })
        const json = await res.json()
        if (json.success) {
          if (json.deletedCount > 0) {
            toast(`File part WinRAR dibersihkan (${json.formattedFreed || ''} disk lega).`, 'success')
          } else {
            toast(json.message || 'Tidak ada file part arsip sementara yang ditemukan.', 'info')
          }
          fetchScan(true)
        } else if (!silent) {
          toast(json.error || 'Gagal membersihkan part RAR', 'error')
        }
      } catch (err) {
        if (!silent) toast(err.message, 'error')
      }
    }

    if (silent) {
      executeClean()
    } else {
      setConfirmAction({
        title: 'Bersihkan File Part WinRAR?',
        description: `Hapus semua berkas part .rar lokal untuk "${folder.name}" untuk menghemat disk space? Folder game utama tetap aman.`,
        confirmLabel: 'Bersihkan Part',
        tone: 'warning',
        onConfirm: async () => {
          try {
            await executeClean()
          } finally {
            setConfirmAction(null)
          }
        },
      })
    }
  }

  return (
    <div className="space-y-5 pb-12">
      <TopBar title="Workbench" />

      {/* 🧭 Header Navigasi & Aksi Global */}
      <WorkbenchHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyCount={history.length}
        queueCount={queue.length}
        isQueueRunning={isQueueRunning}
        isScanning={loading}
        isElectron={isElectron}
        stagingPath={data.path}
        onScan={fetchScan}
        onCreateFolder={() => setCreateFolderOpen(true)}
        onChangeStagingPath={() => setStagingPathModal({ open: true, path: data.path })}
        onOpenQueueDrawer={() => setQueueDrawerOpen(true)}
      />

      {/* ── TAB 1: MEJA KERJA GAME ── */}
      {activeTab === 'workbench' && (
        <WorkbenchView
          folders={data.folders}
          selectedFolder={selectedFolder}
          onSelectFolder={handleSelectFolder}
          stagingPath={data.path}
          isScanning={loading}
          onScan={fetchScan}
          workspaces={workspaces}
          targetWorkspace={targetWorkspace}
          setTargetWorkspace={setTargetWorkspace}
          uploadMode={uploadMode}
          setUploadMode={setUploadMode}
          customCatalogTitle={customCatalogTitle}
          setCustomCatalogTitle={setCustomCatalogTitle}
          existingGames={existingGames}
          selectedGame={selectedGame}
          setSelectedGame={setSelectedGame}
          cleanReplace={cleanReplace}
          setCleanReplace={setCleanReplace}
          rarConfig={rarConfig}
          setRarConfig={setRarConfig}
          autoCleanupLocal={autoCleanupLocal}
          setAutoCleanupLocal={setAutoCleanupLocal}
          fileVersion={fileVersion}
          setFileVersion={setFileVersion}
          processState={processState}
          startProcessing={startProcessing}
          handleProcessControl={handleProcessControl}
          onResetProcessState={handleResetProcessState}
          onAddToQueue={handleAddToQueue}
          onRenameFolder={(f) => setRenameModal({ open: true, item: f, newName: f.name })}
          onDeleteFolder={handleDeleteFolder}
          onCleanParts={(f, pNames) => handleCleanParts(f, false, pNames)}
        />
      )}

      {/* ── TAB 2: RIWAYAT UPLOAD ── */}
      {activeTab === 'history' && (
        <UploadHistoryTab
          history={history}
          loading={historyLoading}
          onRefresh={fetchHistory}
        />
      )}

      {/* ── Drawer Antrean Batch Upload ── */}
      <QueueDrawer
        isOpen={queueDrawerOpen}
        onClose={() => setQueueDrawerOpen(false)}
        queue={queue}
        isQueueRunning={isQueueRunning}
        activeQueueId={activeQueueId}
        processState={processState}
        onStartQueue={handleStartQueue}
        onPauseQueue={handlePauseQueue}
        onClearCompleted={() => {
          const filtered = queue.filter((q) => q.status !== 'success')
          setQueue(filtered)
          saveQueueToBackend(filtered)
        }}
        onClearAll={() => {
          setQueue([])
          saveQueueToBackend([])
        }}
        onRemoveItem={(id) => {
          const filtered = queue.filter((q) => q.id !== id)
          setQueue(filtered)
          saveQueueToBackend(filtered)
        }}
        onRetryItem={(id) => {
          const retried = queue.map((q) => (q.id === id ? { ...q, status: 'waiting', error: null } : q))
          setQueue(retried)
          saveQueueToBackend(retried)
          if (!isQueueRunning) handleStartQueue()
        }}
        onRetryAllFailed={() => {
          const retried = queue.map((q) => (q.status === 'failed' ? { ...q, status: 'waiting', error: null } : q))
          setQueue(retried)
          saveQueueToBackend(retried)
          if (!isQueueRunning) handleStartQueue()
        }}
      />

      {/* ── Modal Dialogs ── */}
      <StagingModals
        createFolderOpen={createFolderOpen}
        setCreateFolderOpen={setCreateFolderOpen}
        onCreateFolderSubmit={handleCreateFolder}
        renameModal={renameModal}
        setRenameModal={setRenameModal}
        onRenameSubmit={handleRenameFolder}
        stagingPathModal={stagingPathModal}
        setStagingPathModal={setStagingPathModal}
        onStagingPathSubmit={handleUpdateStagingPath}
        confirmAction={confirmAction}
        setConfirmAction={setConfirmAction}
      />
    </div>
  )
}
