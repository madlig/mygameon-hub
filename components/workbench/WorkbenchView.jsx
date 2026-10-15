'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { cleanReleaseName, formatBytes } from '@/lib/utils'
import StagingFolderList from './StagingFolderList'
import WorkbenchCockpit from './WorkbenchCockpit'
import ActiveUploadHero from './ActiveUploadHero'
import {
  Loader2, Pause, Play, XCircle, AlertTriangle, CheckCircle2,
  UploadCloud, FileArchive, Zap, Folder, ChevronRight, PanelLeftOpen
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function WorkbenchView({
  folders = [],
  selectedFolder = null,
  onSelectFolder,
  stagingPath = '',
  isScanning = false,
  onScan,
  workspaces = [],
  targetWorkspace,
  setTargetWorkspace,
  uploadMode = 'new',
  setUploadMode,
  customCatalogTitle,
  setCustomCatalogTitle,
  existingGames = [],
  selectedGame,
  setSelectedGame,
  cleanReplace = true,
  setCleanReplace,
  rarConfig,
  setRarConfig,
  autoCleanupLocal,
  setAutoCleanupLocal,
  fileVersion = '',
  setFileVersion,
  processState,
  startProcessing,
  handleProcessControl,
  onResetProcessState,
  onAddToQueue,
  onRenameFolder,
  onDeleteFolder,
  onCleanParts,
}) {
  const { toast } = useToast()

  // Inspect Data & File Explorer State
  const [inspectData, setInspectData] = useState(null)
  const [inspectLoading, setInspectLoading] = useState(false)
  const [inspectError, setInspectError] = useState(null)

  // Drive Pre-check & Resume Detection State
  const [driveCheck, setDriveCheck] = useState(null)
  const [isCheckingDrive, setIsCheckingDrive] = useState(false)
  const [resumeMode, setResumeMode] = useState(true)
  const [customTargetFolderId, setCustomTargetFolderId] = useState('')
  const [selectedPartNames, setSelectedPartNames] = useState([])
  const [showSecondaryView, setShowSecondaryView] = useState(false)
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  const [userMobileTab, setUserMobileTab] = useState(null) // 'folders' | 'cockpit' | null
  const isProcessing =
    processState?.status === 'processing' ||
    processState?.status === 'paused' ||
    processState?.status === 'success' ||
    processState?.status === 'error'
  const mobileTab = userMobileTab ?? (isProcessing ? 'cockpit' : 'folders')
  const setMobileTab = setUserMobileTab

  const selectedFolderPath = selectedFolder?.path
  const selectedFolderName = selectedFolder?.name

  // Fetch file & subfolder inspection
  const fetchFolderContent = useCallback(async () => {
    if (!selectedFolderPath && !selectedFolderName) {
      setInspectData(null)
      return
    }
    setInspectLoading(true)
    setInspectError(null)

    try {
      const params = new URLSearchParams()
      if (selectedFolderPath) params.set('path', selectedFolderPath)
      if (selectedFolderName) params.set('folderName', selectedFolderName)
      params.set('type', 'upload')

      const res = await fetch(`/api/system/inspect-folder?${params.toString()}`)
      const json = await res.json()

      if (json.success) {
        setInspectData(json)
      } else {
        setInspectError(json.error || 'Gagal membaca berkas di dalam folder')
      }
    } catch (err) {
      setInspectError(err.message || 'Gagal memuat isi folder')
    } finally {
      setInspectLoading(false)
    }
  }, [selectedFolderPath, selectedFolderName])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFolderContent()
    setCustomTargetFolderId('')
    setSelectedPartNames([])
  }, [fetchFolderContent])

  // Auto-refresh inspeksi berkas ketika proses kompresi / upload selesai
  useEffect(() => {
    if (processState?.status === 'success') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchFolderContent()
    }
  }, [processState?.status, fetchFolderContent])

  // Pengecekan Target Google Drive untuk Mendeteksi File yang Sudah Ada (Resume Detection)
  const checkTargetDrive = useCallback(async () => {
    if (!selectedFolder || !targetWorkspace?.email) {
      setDriveCheck(null)
      return
    }

    setIsCheckingDrive(true)
    try {
      const files = inspectData?.files || []
      const rarParts = files.filter((f) => f.category === 'rar_part' || f.isPart)
      const partsList = rarParts.map((f) => ({ name: f.name, size: f.size || 0 }))
      const folderName = customCatalogTitle || cleanReleaseName(selectedFolder.name)

      const res = await fetch('/api/studio/check-drive-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetWorkspace.email,
          folderName,
          partsList,
          targetFolderId: customTargetFolderId?.trim() || selectedGame?.folderId || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setDriveCheck(json)
      } else {
        setDriveCheck(null)
      }
    } catch (_) {
      setDriveCheck(null)
    } finally {
      setIsCheckingDrive(false)
    }
  }, [selectedFolder, targetWorkspace, customCatalogTitle, inspectData, selectedGame, customTargetFolderId])

  useEffect(() => {
    const timer = setTimeout(() => {
      checkTargetDrive()
    }, 400)
    return () => clearTimeout(timer)
  }, [checkTargetDrive])



  // Aksi Kompres WinRAR (Split Part 4GB Lokal)
  const handleArchiveFolder = async () => {
    if (!selectedFolder) return
    try {
      const pureSize = selectedFolder?.folderSize || selectedFolder?.size || inspectData?.folder?.totalSize || 0
      await startProcessing?.('archive', {
        config: { ...rarConfig, totalSize: pureSize },
      })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  // Aksi Mulai Upload ke Google Drive
  const handleStartUpload = () => {
    if (!selectedFolder) return
    const isUpdate = uploadMode === 'update'
    const shouldCleanReplace = isUpdate ? cleanReplace : (!resumeMode && driveCheck?.exists)
    const isResume = !isUpdate && resumeMode && driveCheck?.exists && driveCheck?.uploadedCount > 0

    const targetFolderId = isUpdate
      ? (selectedGame?.folderId || selectedGame?.targetId || driveCheck?.folderId || customTargetFolderId?.trim() || null)
      : (isResume ? (driveCheck?.folderId || customTargetFolderId?.trim() || null) : (customTargetFolderId?.trim() || null))

    const pureSize = selectedFolder?.folderSize || selectedFolder?.size || inspectData?.folder?.totalSize || 0

    startProcessing?.('upload', {
      mode: uploadMode,
      targetFolderId,
      resume: isResume,
      cleanReplace: shouldCleanReplace,
      forceWipeExisting: shouldCleanReplace,
      selectedParts: selectedPartNames && selectedPartNames.length > 0 ? selectedPartNames : null,
      fileVersion: fileVersion,
      customTitle: customCatalogTitle || selectedGame?.name || cleanReleaseName(selectedFolder.name),
      autoPropagate: true,
      config: { ...rarConfig, totalSize: pureSize },
    })
  }

  // Aksi Melanjutkan Upload / Kompresi yang Terputus / Error
  const handleResumeUpload = () => {
    if (processState?.action === 'archive' || processState?.phase === 'archiving') {
      handleArchiveFolder()
      return
    }

    const targetPath =
      selectedFolder?.path ||
      processState?.folderPath ||
      (processState?.gameName ? `D:\\Game\\Shopee\\GameUpload\\${processState.gameName}` : null)
    const email = targetWorkspace?.email || processState?.targetEmail

    if (startProcessing && targetPath && email) {
      startProcessing('upload', {
        folderPath: targetPath,
        targetEmail: email,
        targetFolderId: processState?.driveFolderId || driveCheck?.folderId || selectedGame?.folderId || null,
        resume: true,
        cleanReplace: false,
        forceWipeExisting: false,
        gameName: processState?.gameName || selectedFolder?.name,
        customTitle: processState?.gameName || selectedFolder?.name,
        fileVersion: processState?.fileVersion || fileVersion,
      })
    } else {
      handleProcessControl?.('resume')
    }
  }

  // Aksi Hapus File Tunggal
  const handleDeleteSingleFile = async (file) => {
    if (!file?.fullPath || !selectedFolder) return
    try {
      const res = await fetch('/api/studio/local-games', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'delete_single_file',
          targetFilePath: file.fullPath,
          itemName: selectedFolder.name,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast(`Berkas "${file.name}" berhasil dihapus (${json.formattedFreed || ''}).`, 'success')
        fetchFolderContent()
        onScan?.()
      } else {
        toast(json.error || 'Gagal menghapus berkas', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  // Aksi Sanitasi File Sampah (Thumbs.db, URL, iklan)
  const handleSanitizeJunk = async () => {
    if (!selectedFolder) return
    const files = inspectData?.files || []
    const junkFiles = files.filter((f) => {
      const name = f.name.toLowerCase()
      return (
        name.endsWith('.url') ||
        name.endsWith('.website') ||
        name === 'desktop.ini' ||
        name === 'thumbs.db' ||
        name.includes('ovagames') ||
        name.includes('steamrip') ||
        name.includes('fitgirl') ||
        name.includes('dodi')
      )
    })

    if (junkFiles.length === 0) {
      toast('Folder sudah bersih dari berkas iklan dan sampah pihak ketiga.', 'info')
      return
    }

    let deletedCount = 0
    for (const jf of junkFiles) {
      if (jf.fullPath) {
        try {
          await fetch('/api/studio/local-games', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'delete_single_file',
              targetFilePath: jf.fullPath,
              itemName: selectedFolder.name,
            }),
          })
          deletedCount++
        } catch (_) {}
      }
    }

    toast(`Sanitasi berhasil: ${deletedCount} berkas sampah dibersihkan.`, 'success')
    fetchFolderContent()
  }

  return (
    <div className="space-y-3.5">
      {/* 🧭 Tombol Buka Kembali Panel Kiri jika sedang dikolaps */}
      {isLeftPanelCollapsed && (
        <div className="flex items-center justify-between animate-in fade-in duration-150">
          <button
            type="button"
            onClick={() => setIsLeftPanelCollapsed(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)] hover:bg-white/5 transition-all shadow-md cursor-pointer"
            title="Buka kembali daftar folder game di PC"
          >
            <Folder size={14} className="text-amber-400" />
            <span>Tampilkan Daftar Folder PC ({folders.length})</span>
            <ChevronRight size={14} className="text-[var(--text-4)]" />
          </button>
        </div>
      )}

      {/* 📱 Mobile Tab Switcher (Khusus Layar HP / Tablet) */}
      <div className="flex lg:hidden items-center p-1 bg-black/40 rounded-xl border border-white/10 gap-1">
        <button
          type="button"
          onClick={() => setMobileTab('folders')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'folders'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
              : 'text-[var(--text-4)] hover:text-white'
          }`}
        >
          <Folder size={14} className={mobileTab === 'folders' ? 'text-amber-400' : ''} />
          <span>Folder Game ({folders.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cockpit')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'cockpit'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
              : 'text-[var(--text-4)] hover:text-white'
          }`}
        >
          <UploadCloud size={14} className={mobileTab === 'cockpit' ? 'text-amber-400' : ''} />
          <span>Cockpit &amp; Upload</span>
          {isProcessing && (
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── PANEL KIRI: DAFTAR GAME PC (4 Cols / Sembunyi jika Kolaps atau tab mobile cockpit) ── */}
        {!isLeftPanelCollapsed && (
          <div className={`lg:col-span-4 min-w-0 ${mobileTab === 'folders' ? 'block' : 'hidden lg:block'}`}>
            <StagingFolderList
              folders={folders}
              selectedFolder={selectedFolder}
              onSelectFolder={(folder) => {
                onSelectFolder(folder)
                setMobileTab('cockpit')
              }}
              isScanning={isScanning}
              onScan={onScan}
              onRename={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onCleanParts={onCleanParts}
              onToggleCollapse={() => setIsLeftPanelCollapsed(true)}
            />
          </div>
        )}

        {/* ── PANEL KANAN: WORKBENCH INSPECTOR & UPLOAD (8 Cols / 12 Cols jika Kolaps) ── */}
        <div className={`${isLeftPanelCollapsed ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-4 min-w-0 ${mobileTab === 'cockpit' ? 'block' : 'hidden lg:block'}`}>
          {/* Active Upload Hero Dashboard (Tampilan Utama Saat Upload Berjalan & Cockpit Pasca-Upload) */}
          {isProcessing && (
            <ActiveUploadHero
              processState={processState}
              selectedFolder={selectedFolder}
              targetWorkspace={targetWorkspace}
              onProcessControl={handleProcessControl}
              onResumeUpload={handleResumeUpload}
              onToggleSecondaryView={() => setShowSecondaryView((prev) => !prev)}
              showSecondaryView={showSecondaryView}
              onResetProcessState={onResetProcessState}
              onCleanParts={() => onCleanParts?.(selectedFolder)}
              fileVersion={fileVersion}
              onProceedToUpload={() => {
                onResetProcessState?.()
                onScan?.(true)
                fetchFolderContent?.()
                checkTargetDrive?.()
              }}
            />
          )}

        {/* Tampilan Penjelajah Berkas & Pengaturan:
            - Selalu tampil jika TIDAK sedang upload
            - Atau tampil di bawah Hero Dashboard jika operator mengklik 'Lihat Berkas'
        */}
        {(!isProcessing || showSecondaryView) && (
          <WorkbenchCockpit
            activeFolder={selectedFolder}
            inspectData={inspectData}
            inspectLoading={inspectLoading}
            inspectError={inspectError}
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
            driveCheck={driveCheck}
            isCheckingDrive={isCheckingDrive}
            onRefreshDriveCheck={checkTargetDrive}
            resumeMode={resumeMode}
            setResumeMode={setResumeMode}
            customTargetFolderId={customTargetFolderId}
            setCustomTargetFolderId={setCustomTargetFolderId}
            selectedPartNames={selectedPartNames}
            setSelectedPartNames={setSelectedPartNames}
            onStartUpload={handleStartUpload}
            onAddToQueue={() => {
              const isUpdate = uploadMode === 'update'
              const shouldCleanReplace = isUpdate ? cleanReplace : (!resumeMode && driveCheck?.exists)
              const isResume = !isUpdate && resumeMode && driveCheck?.exists && driveCheck?.uploadedCount > 0
              const targetFolderId = isUpdate
                ? (selectedGame?.folderId || selectedGame?.targetId || driveCheck?.folderId || customTargetFolderId?.trim() || null)
                : (isResume ? (driveCheck?.folderId || customTargetFolderId?.trim() || null) : (customTargetFolderId?.trim() || null))

              onAddToQueue?.({
                mode: uploadMode,
                targetFolderId,
                resume: isResume,
                cleanReplace: shouldCleanReplace,
                forceWipeExisting: shouldCleanReplace,
                remainingCount: isResume ? (selectedPartNames?.length || driveCheck.remainingCount) : null,
                selectedParts: selectedPartNames && selectedPartNames.length > 0 ? selectedPartNames : null,
                fileVersion: fileVersion,
                customTitle: customCatalogTitle || selectedGame?.name || cleanReleaseName(selectedFolder.name),
                autoPropagate: true,
              })
            }}
            onArchive={handleArchiveFolder}
            onCleanParts={async (folder, partNames) => {
              await onCleanParts?.(folder || selectedFolder, partNames)
              fetchFolderContent()
            }}
            onDeleteFolder={() => onDeleteFolder?.(selectedFolder)}
            onRefreshInspect={fetchFolderContent}
            onDeleteSingleFile={handleDeleteSingleFile}
            onSanitizeJunk={handleSanitizeJunk}
            isBusy={isProcessing}
            canUpload={!!selectedFolder && !inspectLoading}
          />
        )}
      </div>
    </div>
  </div>
)
}
