'use client'

import { useMemo, useState } from 'react'
import {
  UploadCloud, ListPlus, HardDrive, FileArchive, Check,
  Cloud, RefreshCw, AlertCircle, CheckCircle2, Play,
  ChevronDown, FolderPlus, X
} from 'lucide-react'
import WorkspaceDrivePicker from '@/components/studio/WorkspaceDrivePicker'
import ExistingGameSelector from './ExistingGameSelector'
import { formatBytes } from '@/lib/utils'

export default function UploadSettingsCard({
  activeFolder,
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
  rarConfig = { splitSize: 4100 },
  setRarConfig,
  autoCleanupLocal = false,
  setAutoCleanupLocal,
  driveCheck = null,
  isCheckingDrive = false,
  onRefreshDriveCheck,
  resumeMode = true,
  setResumeMode,
  customTargetFolderId = '',
  setCustomTargetFolderId,
  selectedPartNames = [],
  setSelectedPartNames,
  fileVersion = '',
  setFileVersion,
  onStartUpload,
  onAddToQueue,
  isProcessing = false,
  canUpload = true,
}) {
  const [showCustomFolderInput, setShowCustomFolderInput] = useState(false)
  const [showPartDetails, setShowPartDetails] = useState(false)

  // Estimasi ukuran lokal yang dibutuhkan
  const estimatedSize = activeFolder?.size || 0

  // Apakah mode resume aktif (ada part yang sudah terunggah di Drive dan operator memilih resume)
  const isResumeActive = driveCheck?.exists && (driveCheck?.uploadedCount > 0) && resumeMode

  // Filter seleksi part granular jika operator memilih part tertentu
  const remainingPartsList = useMemo(() => driveCheck?.remainingParts || [], [driveCheck?.remainingParts])
  const hasSelectiveParts = Array.isArray(selectedPartNames) && selectedPartNames.length > 0
  const activeRemainingParts = useMemo(() => {
    if (!hasSelectiveParts) return remainingPartsList
    return remainingPartsList.filter((p) => selectedPartNames.includes(p.name))
  }, [remainingPartsList, hasSelectiveParts, selectedPartNames])

  const activeRemainingBytes = useMemo(() => {
    if (!isResumeActive) return estimatedSize
    if (hasSelectiveParts) {
      return activeRemainingParts.reduce((sum, p) => sum + (p.size || 0), 0)
    }
    return driveCheck?.remainingBytes ?? estimatedSize
  }, [isResumeActive, hasSelectiveParts, activeRemainingParts, driveCheck?.remainingBytes, estimatedSize])

  const effectiveSizeNeeded = isResumeActive ? activeRemainingBytes : estimatedSize

  // Validasi Kuota Google Drive Sebelum Upload (Pre-Flight Quota Guard)
  const quotaCheck = useMemo(() => {
    if (!targetWorkspace || !effectiveSizeNeeded) return null
    if (targetWorkspace.isSharedDrive) {
      return { status: 'safe', message: 'Shared Drive Staging (Unlimited Pooled Storage)' }
    }
    let limitGB = parseFloat(targetWorkspace.storage?.limitGB ?? targetWorkspace.storageLimitGB ?? 1024)
    let usageGB = parseFloat(targetWorkspace.storage?.usageGB ?? targetWorkspace.storageUsageGB ?? 0)

    // Guard 1: Batasi kuota individual akun Google Drive (bukan pooled domain 100 TB)
    if (limitGB > 2048) {
      limitGB = 1024
    }

    // Guard 2: Jika usageGB melebihi kuota akun (> limitGB), itu adalah kebocoran pooled usage dari Shared Drive
    if (usageGB > limitGB) {
      const rawPct = parseFloat(targetWorkspace.storage?.percentage)
      if (!isNaN(rawPct) && rawPct > 0 && rawPct <= 100) {
        usageGB = parseFloat(((rawPct / 100) * limitGB).toFixed(1))
      } else {
        usageGB = 0
      }
    }

    const freeBytes = Math.max(0, (limitGB - usageGB) * 1024 * 1024 * 1024)

    if (effectiveSizeNeeded > freeBytes) {
      return {
        status: 'danger',
        message: `Kuota tidak mencukupi! Butuh ${formatBytes(effectiveSizeNeeded)}, sisa kuota hanya ${formatBytes(freeBytes)}.`
      }
    }
    if (freeBytes - effectiveSizeNeeded < 2 * 1024 * 1024 * 1024) {
      return {
        status: 'warning',
        message: `Sisa kuota akan menipis setelah upload (${formatBytes(freeBytes - effectiveSizeNeeded)} tersisa).`
      }
    }
    return {
      status: 'safe',
      message: `Kuota aman (${formatBytes(freeBytes)} ruang kosong tersedia).`
    }
  }, [targetWorkspace, effectiveSizeNeeded])

  const handleTogglePart = (partName) => {
    if (!setSelectedPartNames) return
    if (!hasSelectiveParts) {
      const allRemaining = remainingPartsList.map((p) => p.name)
      setSelectedPartNames(allRemaining.filter((n) => n !== partName))
    } else {
      if (selectedPartNames.includes(partName)) {
        setSelectedPartNames(selectedPartNames.filter((n) => n !== partName))
      } else {
        setSelectedPartNames([...selectedPartNames, partName])
      }
    }
  }

  const handleSelectAllRemaining = () => {
    if (!setSelectedPartNames) return
    setSelectedPartNames(remainingPartsList.map((p) => p.name))
  }

  const handleDeselectAllRemaining = () => {
    if (!setSelectedPartNames) return
    setSelectedPartNames([])
  }

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-xl space-y-4">
      {/* Header Pengaturan */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <UploadCloud size={16} className="text-[var(--primary)]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">
            Pengaturan Upload Google Drive
          </h3>
        </div>

        {/* Mode Selector Pill */}
        <div className="flex items-center rounded-xl bg-black/40 p-1 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setUploadMode('new')
              setSelectedGame(null)
            }}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              uploadMode === 'new'
                ? 'bg-[var(--primary)] text-black shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            ➕ Game Baru
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('update')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              uploadMode === 'update'
                ? 'bg-amber-400 text-black shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            🔄 Update Versi
          </button>
        </div>
      </div>

      {/* Judul Etalase / Katalog */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-[var(--text-3)]">
          Nama Judul Game di Katalog & Google Drive
        </label>
        <input
          type="text"
          value={customCatalogTitle}
          onChange={(e) => setCustomCatalogTitle(e.target.value)}
          placeholder="Judul game bersih..."
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-semibold text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
        />
      </div>

      {/* Input Versi Rilis Game */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-[var(--text-3)]">
            Versi Rilis Game {uploadMode === 'update' ? '(Pembaruan Versi)' : '(Opsional)'}
          </label>
          {selectedGame?.fileVersion && (
            <span className="text-[10px] font-mono text-[var(--text-4)]">
              Versi di GDrive: <b className="text-amber-300">{selectedGame.fileVersion}</b>
            </span>
          )}
        </div>
        <input
          type="text"
          value={fileVersion}
          onChange={(e) => setFileVersion?.(e.target.value)}
          placeholder={uploadMode === 'update' ? 'Contoh: v4.04 Next-Gen atau v1.2.0 + All DLC...' : 'Contoh: v1.0.0 atau Build 14205...'}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-semibold text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
        />
      </div>

      {/* Mode Update Versi: Custom Searchable Dropdown & Alert */}
      {uploadMode === 'update' && (
        <div className="space-y-3">
          {selectedGame && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <RefreshCw size={13} className="text-amber-400" />
                <span>Terdeteksi Update Versi: Game Sudah Ada di Google Drive</span>
              </div>
              <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
                Game <b className="text-[var(--text)]">{selectedGame.name}</b> terdaftar di akun <b className="text-[var(--text)]">{selectedGame.ownerEmail}</b>.
                {cleanReplace ? ' File part versi lama di Drive akan dibersihkan dan digantikan dengan versi baru.' : ' Part baru akan ditambahkan ke folder yang sama.'}
              </p>
            </div>
          )}
          <ExistingGameSelector
          existingGames={existingGames}
          selectedGame={selectedGame}
          onSelectGame={(game) => {
            setSelectedGame(game)
            const primaryOwner = game.ownerEmail?.split(',')[0]?.trim() || game.workspaceEmail
            const matchedWs = workspaces.find((w) => w.email === primaryOwner)
            if (matchedWs) setTargetWorkspace(matchedWs)
          }}
          workspaces={workspaces}
          cleanReplace={cleanReplace}
          setCleanReplace={setCleanReplace}
        />
        </div>
      )}

      {/* Target Workspace Drive */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold text-[var(--text-3)] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span>Pilih Akun Workspace Google Drive</span>
            {isCheckingDrive && (
              <RefreshCw size={11} className="animate-spin text-amber-400" />
            )}
          </div>
          {quotaCheck && (
            <span className={`text-[10px] font-mono font-bold ${
              quotaCheck.status === 'danger'
                ? 'text-rose-400'
                : quotaCheck.status === 'warning'
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {quotaCheck.message}
            </span>
          )}
        </div>

        <WorkspaceDrivePicker
          workspaces={workspaces}
          targetWorkspace={targetWorkspace}
          setTargetWorkspace={setTargetWorkspace}
        />

        {/* Target Folder GDrive Spesifik (Manual Link / ID) */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowCustomFolderInput((prev) => !prev)}
              className="text-[11px] font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 transition-colors"
            >
              <FolderPlus size={12} />
              <span>{showCustomFolderInput ? 'Tutup Target Folder Manual' : 'Targetkan Folder Google Drive Spesifik (Link / ID)?'}</span>
            </button>
            {customTargetFolderId && (
              <button
                type="button"
                onClick={() => {
                  setCustomTargetFolderId?.('')
                  setTimeout(() => onRefreshDriveCheck?.(), 50)
                }}
                className="text-[10px] text-rose-400 hover:underline flex items-center gap-0.5"
              >
                <X size={10} /> Reset ke Otomatis
              </button>
            )}
          </div>

          {showCustomFolderInput && (
            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="text"
                value={customTargetFolderId || ''}
                onChange={(e) => setCustomTargetFolderId?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onRefreshDriveCheck?.()
                  }
                }}
                placeholder="Tempel Link GDrive (https://drive.google.com/...) atau ID folder..."
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-mono text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={onRefreshDriveCheck}
                disabled={isCheckingDrive}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[var(--text)] hover:bg-white/10 transition-colors disabled:opacity-50 shrink-0"
              >
                {isCheckingDrive ? 'Memindai...' : 'Pindai'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── KARTU STATUS DETEKSI & RESUME UPLOAD GOOGLE DRIVE ── */}
      {driveCheck?.exists && (
        <div className={`rounded-xl border p-3.5 text-xs space-y-2.5 transition-all ${
          driveCheck.uploadedCount > 0
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-white/10 bg-black/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud size={15} className={driveCheck.uploadedCount > 0 ? 'text-emerald-400' : 'text-blue-400'} />
              <span className="font-bold text-[var(--text)]">
                {driveCheck.uploadedCount > 0
                  ? `Ditemukan di Drive: ${driveCheck.uploadedCount} dari ${driveCheck.totalParts || (driveCheck.uploadedCount + driveCheck.remainingCount)} Part Sudah Ada`
                  : `Folder '${driveCheck.folderName}' sudah ada di Drive`}
              </span>
            </div>

            <button
              type="button"
              onClick={onRefreshDriveCheck}
              disabled={isCheckingDrive}
              className="flex items-center gap-1 p-1 text-[10px] text-[var(--text-4)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
              title="Periksa ulang Google Drive"
            >
              <RefreshCw size={11} className={isCheckingDrive ? 'animate-spin text-amber-400' : ''} />
              <span className="hidden sm:inline">Cek Ulang</span>
            </button>
          </div>

          {driveCheck.uploadedCount > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <span className="text-emerald-300 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>Hemat {formatBytes(driveCheck.uploadedBytes || 0)} transfer</span>
                </span>
                <span className="text-amber-300 font-semibold">
                  ⏳ Sisa {activeRemainingParts.length} part ({formatBytes(activeRemainingBytes)})
                  {hasSelectiveParts && <span className="text-[10px] text-amber-400/80"> (Terpilih)</span>}
                </span>
              </div>

              {/* Accordion Rincian Status Part */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowPartDetails((prev) => !prev)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
                  >
                    <ChevronDown size={13} className={`transition-transform duration-200 ${showPartDetails ? 'rotate-180' : ''}`} />
                    <span>Rincian Part ({driveCheck.uploadedCount} Selesai, {activeRemainingParts.length} Siap Upload)</span>
                  </button>
                  {showPartDetails && remainingPartsList.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={handleSelectAllRemaining}
                        className="text-[var(--primary)] hover:underline"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-[var(--text-4)]">•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllRemaining}
                        className="text-[var(--text-4)] hover:text-[var(--text)]"
                      >
                        Batal Pilih
                      </button>
                    </div>
                  )}
                </div>

                {showPartDetails && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-white/5 bg-black/40 p-2 space-y-1 text-[10px] font-mono">
                    {/* Part yang sudah lengkap di Drive */}
                    {driveCheck.uploadedParts?.map((part) => (
                      <div key={part.name} className="flex items-center justify-between py-1 px-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Check size={11} className="text-emerald-400 shrink-0" />
                          <span className="truncate">{part.name}</span>
                        </div>
                        <span className="text-[9px] text-emerald-400/80 shrink-0">{formatBytes(part.size)} (Selesai di Drive)</span>
                      </div>
                    ))}

                    {/* Part yang belum ada / perlu diupload */}
                    {remainingPartsList.map((part) => {
                      const isSelected = !hasSelectiveParts || selectedPartNames.includes(part.name)
                      const isCorrupt = !!part.existingPartial
                      return (
                        <div
                          key={part.name}
                          onClick={() => handleTogglePart(part.name)}
                          className={`flex items-center justify-between py-1 px-2 rounded border cursor-pointer transition-colors ${
                            isCorrupt
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              : isSelected
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                              : 'bg-white/5 border-white/5 text-[var(--text-4)] opacity-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-3 w-3 rounded border-white/20 bg-black text-[var(--primary)] pointer-events-none shrink-0"
                            />
                            <span className="truncate">{part.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 text-[9px]">
                            {isCorrupt ? (
                              <span className="text-rose-400">Terpotong ({formatBytes(part.existingPartial.size)}) • Timpa</span>
                            ) : (
                              <span className="text-amber-400/80">{formatBytes(part.size)}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Toggle Lanjutkan (Skip) vs Mulai Ulang (Timpa) */}
              {setResumeMode && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                  <span className="text-[var(--text-3)] font-semibold">
                    Kebijakan Upload:
                  </span>
                  <div className="flex items-center rounded-lg bg-black/40 p-0.5 border border-white/10 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setResumeMode(true)}
                      className={`rounded-md px-2.5 py-1 transition-all ${
                        resumeMode
                          ? 'bg-emerald-500 text-black shadow-sm font-black'
                          : 'text-[var(--text-4)] hover:text-[var(--text)]'
                      }`}
                    >
                      Lanjutkan (Skip yang ada)
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeMode(false)}
                      className={`rounded-md px-2.5 py-1 transition-all ${
                        !resumeMode
                          ? 'bg-rose-500 text-white shadow-sm font-black'
                          : 'text-[var(--text-4)] hover:text-[var(--text)]'
                      }`}
                    >
                      Mulai Ulang (Timpa Semua)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pengaturan WinRAR & Disk Cleanup */}
      <div className="rounded-xl border border-white/5 bg-black/20 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-2)]">
            <FileArchive size={14} className="text-amber-400" />
            <span>Ukuran Part WinRAR</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
            <input
              type="number"
              min={500}
              max={10000}
              step={100}
              value={rarConfig.splitSize || 4100}
              onChange={(e) => setRarConfig({ ...rarConfig, splitSize: Number(e.target.value) })}
              className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-right text-xs font-mono text-[var(--text)] focus:border-amber-400 focus:outline-none"
            />
            <span className="text-[var(--text-4)]">MB</span>
          </div>
        </div>

        {/* Toggle Hapus Part Lokal Setelah Sukses Terunggah */}
        <label className="flex items-center justify-between pt-2 border-t border-white/5 cursor-pointer">
          <div className="flex flex-col pr-2">
            <span className="text-xs font-bold text-[var(--text)]">
              Bersihkan part WinRAR lokal setelah upload selesai
            </span>
            <span className="text-[10px] text-[var(--text-4)]">
              Hemat ruang harddisk PC segera setelah part terverifikasi 100% di Google Drive.
            </span>
          </div>
          <input
            type="checkbox"
            checked={autoCleanupLocal}
            onChange={(e) => setAutoCleanupLocal(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-black/40 text-[var(--primary)] focus:ring-0 cursor-pointer"
          />
        </label>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={onAddToQueue}
          disabled={!canUpload || isProcessing}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-[var(--text)] hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50"
        >
          <ListPlus size={15} />
          <span>Tambah Antrean</span>
        </button>

        <button
          type="button"
          onClick={onStartUpload}
          disabled={!canUpload || isProcessing || quotaCheck?.status === 'danger'}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] py-2.5 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-[var(--primary)]/20 transition-all disabled:opacity-50"
        >
          <UploadCloud size={15} />
          <span>
            {isResumeActive && activeRemainingParts.length > 0
              ? `Lanjutkan Upload (${activeRemainingParts.length} Part${hasSelectiveParts ? ' Terpilih' : ''})`
              : 'Upload Sekarang'}
          </span>
        </button>
      </div>
    </div>
  )
}
