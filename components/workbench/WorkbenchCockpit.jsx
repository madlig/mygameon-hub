'use client'

import { useState, useMemo } from 'react'
import {
  UploadCloud, ListPlus, HardDrive, FileArchive, Check,
  Cloud, RefreshCw, AlertCircle, CheckCircle2, Play,
  ChevronDown, ChevronUp, FolderPlus, X, Zap, Disc,
  Sparkles, Trash2, Package, Folder, Settings, Tag, ShieldCheck,
  AlertTriangle
} from 'lucide-react'
import WorkspaceDrivePicker from '@/components/studio/WorkspaceDrivePicker'
import ExistingGameSelector from './ExistingGameSelector'
import FolderInspector from './FolderInspector'
import { formatBytes, cleanReleaseName } from '@/lib/utils'

const THEME_STYLES = {
  amber: {
    border: 'border-amber-500/30 hover:border-amber-500/40',
    bg: 'bg-gradient-to-b from-amber-500/[0.08] via-[var(--surface)] to-[var(--surface)]',
    glow: 'bg-amber-500/10',
    iconBox: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    primaryBtn: 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md shadow-amber-500/20 hover:brightness-110',
    secondaryBtn: 'border-white/10 bg-white/5 text-amber-300 hover:border-amber-500/30 hover:bg-white/10',
  },
  blue: {
    border: 'border-cyan-500/30 hover:border-cyan-500/40',
    bg: 'bg-gradient-to-b from-cyan-500/[0.08] via-[var(--surface)] to-[var(--surface)]',
    glow: 'bg-cyan-500/10',
    iconBox: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-400',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    primaryBtn: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-md shadow-cyan-500/20 hover:brightness-110',
    secondaryBtn: 'border-white/10 bg-white/5 text-cyan-300 hover:border-cyan-500/30 hover:bg-white/10',
  },
  emerald: {
    border: 'border-emerald-500/30 hover:border-emerald-500/40',
    bg: 'bg-gradient-to-b from-emerald-500/[0.08] via-[var(--surface)] to-[var(--surface)]',
    glow: 'bg-emerald-500/10',
    iconBox: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    primaryBtn: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-black shadow-md shadow-emerald-500/20 hover:brightness-110',
    secondaryBtn: 'border-white/10 bg-white/5 text-emerald-300 hover:border-emerald-500/30 hover:bg-white/10',
  },
  rose: {
    border: 'border-rose-500/30 hover:border-rose-500/40',
    bg: 'bg-gradient-to-b from-rose-500/[0.08] via-[var(--surface)] to-[var(--surface)]',
    glow: 'bg-rose-500/10',
    iconBox: 'border-rose-500/30 bg-rose-500/15 text-rose-400',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    primaryBtn: 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20 hover:brightness-110',
    secondaryBtn: 'border-white/10 bg-white/5 text-rose-300 hover:border-rose-500/30 hover:bg-white/10',
  },
}

export default function WorkbenchCockpit({
  activeFolder,
  inspectData,
  inspectLoading = false,
  inspectError = null,
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
  onArchive,
  onCleanParts,
  onDeleteFolder,
  onRefreshInspect,
  onDeleteSingleFile,
  onSanitizeJunk,
  isBusy = false,
  canUpload = true,
}) {
  const [showExplorer, setShowExplorer] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // Evaluasi Skenario Cerdas
  const scenario = useMemo(() => {
    if (!activeFolder) return null

    const files = inspectData?.files || []
    const subfolders = inspectData?.subfolders || []
    const rarStats = inspectData?.packageSummary?.rarStats
    const missingParts = rarStats?.missingParts || []
    const hasMissingParts = missingParts.length > 0

    // Filter hanya berkas yang BENAR-BENAR berstatus part arsip WinRAR/7z (bukan berkas bonus soundtrack .zip atau aset internal game)
    const genuinePartFiles = files.filter((f) => f.category === 'rar_part' || f.isPart)
    const partsCountFromFiles = genuinePartFiles.length
    const partsSizeFromFiles = genuinePartFiles.reduce((acc, f) => acc + (f.size || 0), 0)

    const resolvedPartsCount = rarStats?.partsCount ?? (partsCountFromFiles || activeFolder.archiveParts || 0)
    const resolvedRarSize = rarStats?.totalRarSize ?? (partsSizeFromFiles || activeFolder.parentPartsSize || 0)

    const hasArchive = resolvedPartsCount > 0 && resolvedRarSize > 0
    const archivePartsCount = resolvedPartsCount

    const exeFiles = files.filter((f) => f.name.toLowerCase().endsWith('.exe') && !f.name.toLowerCase().includes('redist'))
    const hasExe = exeFiles.length > 0 || !!activeFolder.hasExe

    const hasExtractedFolder = subfolders.length > 0 || !!activeFolder.hasExtractedSubfolder
    const hasIso = !!(activeFolder.hasIso || activeFolder.isInstallerPackage || files.some((f) => f.name.toLowerCase().endsWith('.iso')))

    // 1. Part Bolong (Missing parts)
    if (hasArchive && hasMissingParts) {
      return {
        key: 'MISSING_PARTS',
        theme: 'rose',
        badge: 'Part Bolong',
        title: `Arsip Part Tidak Lengkap (${missingParts.length} Part Hilang)`,
        chips: [`${missingParts.length} Part Hilang`, `Daftar: Part ${missingParts.join(', ')}`],
        desc: `Ditemukan ketidaklengkapan file part WinRAR di harddisk lokal (${missingParts.map((p) => `Part ${p}`).join(', ')}). Pastikan file part lengkap sebelum diunggah ke Google Drive.`,
        icon: AlertTriangle,
        canUpload: false,
        canCleanParts: true,
        cleanLabel: 'Bersihkan Part Rusak',
      }
    }

    // 2. Skenario D: Redundansi Campuran (Folder Game Terpasang + Paket Part RAR)
    if (hasArchive && archivePartsCount > 0 && (hasExe || hasExtractedFolder)) {
      const folderSize = activeFolder.folderSize || activeFolder.size || 0
      const totalCombined = folderSize + resolvedRarSize

      return {
        key: 'MIXED_REDUNDANT',
        theme: 'amber',
        badge: 'Redundansi Ganda',
        title: 'Folder Game Terpasang + Paket Part RAR Terdeteksi',
        chips: [
          `📁 Game: ${formatBytes(folderSize)}`,
          `📦 ${archivePartsCount} Part: ${formatBytes(resolvedRarSize)}`,
          `💾 Total Disk: ~${formatBytes(totalCombined)}`,
        ],
        desc: `Harddisk memakan kuota ganda (~${formatBytes(totalCombined)}). Jika ${archivePartsCount} part RAR sudah terupload ke Google Drive, bersihkan part RAR lokal untuk menghemat kapasitas disk. Atau Anda dapat mengunggah part RAR yang sudah tersedia.`,
        icon: HardDrive,
        canUpload: true,
        uploadLabel: 'Upload Part RAR ke Drive',
        canCleanParts: true,
        cleanLabel: `Hapus Part RAR (Hemat ${formatBytes(resolvedRarSize)})`,
        partsCount: archivePartsCount,
      }
    }

    // 3. Skenario B: Paket Part WinRAR Siap Upload (Hanya arsip part yang ada)
    if (hasArchive && archivePartsCount > 0 && !hasExe && !hasExtractedFolder) {
      return {
        key: 'ARCHIVE_READY',
        theme: 'emerald',
        badge: `${archivePartsCount} Part RAR Siap`,
        title: `Paket Arsip Siap Upload ke Google Drive (${archivePartsCount} Part RAR)`,
        chips: [`📦 ${archivePartsCount} Part Lengkap`, `Ukuran: ${formatBytes(resolvedRarSize)}`],
        desc: `Seluruh file part WinRAR sudah selesai dibuat (${formatBytes(resolvedRarSize)}). File siap langsung diunggah ke Google Drive tanpa perlu kompresi ulang.`,
        icon: CheckCircle2,
        canUpload: true,
        uploadLabel: 'Upload ke Google Drive',
        canCleanParts: true,
        cleanLabel: 'Bersihkan Part RAR',
        partsCount: archivePartsCount,
      }
    }

    // 4. Skenario A: Default Ground State (Game Pre-Installed / Siap Main)
    // Semua folder game yang masuk ke Workbench (Dapur Bersih) berstatus Pre-Installed
    const folderSize = activeFolder.folderSize || activeFolder.size || 0
    return {
      key: 'PRE_INSTALLED',
      theme: 'blue',
      badge: 'Pre-Installed (Siap Main)',
      title: 'Game Siap Main — Belum Dipecah Part RAR',
      chips: [`📁 Ukuran: ${formatBytes(folderSize)}`, '🎮 Format: Plug & Play'],
      desc: `Struktur folder game terpasang bersih dan siap main (${formatBytes(folderSize)}). Pembeli Google Drive membutuhkan arsip WinRAR split 4.1GB agar stabil didownload. Pilih kompresi lokal terlebih dahulu atau langsung kompres & upload ke Google Drive.`,
      icon: Zap,
      canArchive: true,
      archiveLabel: 'Kompres WinRAR 4GB (Lokal)',
      canUpload: true,
      uploadLabel: 'Kompres & Upload ke Drive',
    }
  }, [activeFolder, inspectData])

  // Estimasi Ukuran yang Dibutuhkan untuk Upload
  const effectiveSizeNeeded = useMemo(() => {
    return activeFolder?.size || 0
  }, [activeFolder?.size])

  // Validasi Kuota Google Drive
  const quotaCheck = useMemo(() => {
    if (!targetWorkspace || !effectiveSizeNeeded) return null
    if (targetWorkspace.isSharedDrive) {
      return {
        status: 'safe',
        freeBytes: Infinity,
        remainingAfterBytes: Infinity,
        message: 'Shared Drive Staging (Unlimited)',
        isSharedDrive: true,
      }
    }
    let limitGB = parseFloat(targetWorkspace.storage?.limitGB ?? targetWorkspace.storageLimitGB ?? 1024)
    let usageGB = parseFloat(targetWorkspace.storage?.usageGB ?? targetWorkspace.storageUsageGB ?? 0)
    if (limitGB > 2048) limitGB = 1024
    if (usageGB > limitGB) {
      const rawPct = parseFloat(targetWorkspace.storage?.percentage)
      usageGB = !isNaN(rawPct) && rawPct > 0 && rawPct <= 100 ? parseFloat(((rawPct / 100) * limitGB).toFixed(1)) : 0
    }
    const freeBytes = Math.max(0, (limitGB - usageGB) * 1024 * 1024 * 1024)
    const remainingAfter = freeBytes - effectiveSizeNeeded
    const isSufficient = remainingAfter >= 0

    return {
      status: isSufficient ? 'safe' : 'danger',
      freeBytes,
      remainingAfterBytes: remainingAfter,
      message: isSufficient
        ? `Sisa ${formatBytes(remainingAfter)} setelah upload`
        : `Kurang ${formatBytes(Math.abs(remainingAfter))}! Kuota tidak cukup`,
      isSharedDrive: false,
    }
  }, [targetWorkspace, effectiveSizeNeeded])

  if (!activeFolder) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
        <Folder size={36} className="text-white/10 mb-3" />
        <h3 className="text-sm font-bold text-[var(--text-3)]">Pilih Folder Game di Panel Kiri</h3>
        <p className="text-xs text-[var(--text-4)] max-w-sm mt-1">
          Sistem akan otomatis mendeteksi status game (Pre-Installed, Part RAR, atau Redundan) dan menyiapkan aksi yang tepat.
        </p>
      </div>
    )
  }

  const theme = THEME_STYLES[scenario?.theme] || THEME_STYLES.amber
  const Icon = scenario?.icon || Package

  return (
    <div className="space-y-4">
      {/* ── 1. MASTER COCKPIT CARD (SINGLE CARD UTAMA) ── */}
      <div className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 shadow-2xl transition-all space-y-4 backdrop-blur-sm ${theme.border} ${theme.bg}`}>
        {/* Ambient Subtle Glow */}
        <div className={`pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full blur-3xl ${theme.glow}`} />

        {/* ── HEADER IDENTITAS & METRICS ── */}
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-3.5 border-b border-white/5">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-md ${theme.iconBox}`}>
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border whitespace-nowrap shadow-sm ${theme.badge}`}>
                  {scenario?.badge}
                </span>
                {fileVersion && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/5 text-[var(--text-3)] border border-white/10">
                    <Tag size={10} />
                    <span>Versi: {fileVersion}</span>
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-[var(--text)] tracking-wide truncate mt-1">
                {customCatalogTitle || cleanReleaseName(activeFolder.name)}
              </h2>
              <p className="text-[11px] font-mono text-[var(--text-4)] truncate max-w-md mt-0.5">
                {activeFolder.path}
              </p>
            </div>
          </div>

          {/* Metric Chips di Kanan */}
          {scenario?.chips && (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start sm:self-center">
              {scenario.chips.map((chip, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-white/10 bg-black/40 text-[10px] font-mono font-medium text-[var(--text-2)] shadow-sm"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── INSIGHT SKENARIO CERDAS (PENJELASAN SINGKAT & JELAS) ── */}
        <div className="rounded-2xl bg-black/30 border border-white/5 p-3.5 text-xs text-[var(--text-3)] leading-relaxed">
          {scenario?.desc}
        </div>

        {/* ── FORM INLINE GOOGLE DRIVE (HANYA DITAMPILKAN JIKA BISA DIUPLOAD) ── */}
        {scenario?.canUpload && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Workspace Picker Inline (7 Cols) */}
              <div className="md:col-span-7 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-3)]">
                  <span>Akun Google Drive Tujuan</span>
                  {quotaCheck && (
                    <span className={`text-[10px] font-mono font-bold ${
                      quotaCheck.status === 'danger' ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {quotaCheck.message}
                    </span>
                  )}
                </div>
                <WorkspaceDrivePicker
                  workspaces={workspaces}
                  targetWorkspace={targetWorkspace}
                  value={targetWorkspace?.email}
                  onSelect={(ws) => setTargetWorkspace?.(ws)}
                  placeholder="Pilih Akun Google Drive..."
                />
              </div>

              {/* Mode Upload Pill (5 Cols) */}
              <div className="md:col-span-5 space-y-1">
                <span className="text-[11px] font-bold text-[var(--text-3)] block">
                  Mode Publikasi
                </span>
                <div className="flex items-center rounded-xl bg-black/50 p-1 border border-white/10 h-[42px]">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMode?.('new')
                      setSelectedGame?.(null)
                    }}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      uploadMode === 'new'
                        ? 'bg-[var(--primary)] text-black shadow-sm'
                        : 'text-[var(--text-4)] hover:text-[var(--text)]'
                    }`}
                  >
                    ➕ Game Baru
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode?.('update')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      uploadMode === 'update'
                        ? 'bg-amber-400 text-black shadow-sm'
                        : 'text-[var(--text-4)] hover:text-[var(--text)]'
                    }`}
                  >
                    🔄 Update Versi
                  </button>
                </div>
              </div>
            </div>

            {/* Input Judul Katalog & Versi Rilis (2-Kolom Ringkas) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--text-4)]">
                  Judul di Katalog & GDrive
                </label>
                <input
                  type="text"
                  value={customCatalogTitle}
                  onChange={(e) => setCustomCatalogTitle?.(e.target.value)}
                  placeholder="Nama game bersih..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-semibold text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--text-4)]">
                  Versi Rilis Game {uploadMode === 'update' ? '(Wajib/Update)' : '(Opsional)'}
                </label>
                <input
                  type="text"
                  value={fileVersion}
                  onChange={(e) => setFileVersion?.(e.target.value)}
                  placeholder={uploadMode === 'update' ? 'Misal: v4.04 Next-Gen...' : 'Misal: v1.0.0...'}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-semibold text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Selector Game Terdaftar Jika Mode Update */}
            {uploadMode === 'update' && (
              <div className="pt-1">
                <ExistingGameSelector
                  existingGames={existingGames}
                  selectedGame={selectedGame}
                  onSelectGame={(game) => {
                    setSelectedGame?.(game)
                    const primaryOwner = game.ownerEmail?.split(',')[0]?.trim() || game.workspaceEmail
                    const matchedWs = workspaces.find((w) => w.email === primaryOwner)
                    if (matchedWs) setTargetWorkspace?.(matchedWs)
                  }}
                  workspaces={workspaces}
                  cleanReplace={cleanReplace}
                  setCleanReplace={setCleanReplace}
                />
              </div>
            )}
            {/* Visual Indikator Kapasitas & Early Warning Banner */}
            {quotaCheck && (
              quotaCheck.status === 'danger' ? (
                <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-rose-900/20 to-black/60 p-3.5 flex items-start gap-3 text-xs shadow-lg shadow-rose-950/30 animate-in fade-in duration-200">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-rose-300 text-xs">Peringatan: Kuota Google Drive Tidak Mencukupi!</span>
                      <span className="font-mono text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                        Kurang {formatBytes(Math.abs(quotaCheck.remainingAfterBytes))}
                      </span>
                    </div>
                    <p className="text-rose-200/80 leading-relaxed text-[11px]">
                      Game ini membutuhkan <span className="font-mono font-bold text-white">{formatBytes(effectiveSizeNeeded)}</span>, sedangkan sisa kuota pada akun <span className="font-mono text-rose-300">{targetWorkspace?.email}</span> hanya <span className="font-mono font-bold text-white">{formatBytes(quotaCheck.freeBytes)}</span>. Silakan pilih akun Google Drive lain atau gunakan Shared Drive.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-black/40 border border-white/5 text-[11px]">
                  <div className="flex items-center gap-2 text-[var(--text-3)] font-medium">
                    <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                    <span>Kapasitas Drive:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {quotaCheck.isSharedDrive ? 'Unlimited (Staging)' : `${formatBytes(quotaCheck.freeBytes)} sisa`}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-[var(--text-4)]">
                    {quotaCheck.isSharedDrive
                      ? 'Penyimpanan Bersama Multi-Workspace'
                      : `Estimasi tersisa ${formatBytes(quotaCheck.remainingAfterBytes)} setelah upload`}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* ── ACTION FOOTER ROW (KONTROL UTAMA PROPORSIONAL) ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            {/* Toggle Penjelajah Berkas */}
            <button
              type="button"
              onClick={() => setShowExplorer((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                showExplorer
                  ? 'border-white/30 bg-white/10 text-[var(--text)]'
                  : 'border-white/10 bg-black/40 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/5'
              }`}
            >
              <Folder size={13} className="text-amber-400" />
              <span>{showExplorer ? 'Tutup Berkas' : `Lihat Berkas (${inspectData?.files?.length || 0})`}</span>
              {showExplorer ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {/* Toggle Pengaturan Lanjutan */}
            <button
              type="button"
              onClick={() => setShowAdvancedSettings((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                showAdvancedSettings
                  ? 'border-white/30 bg-white/10 text-[var(--text)]'
                  : 'border-white/10 bg-black/40 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/5'
              }`}
            >
              <Settings size={13} className="text-cyan-400" />
              <span>{showAdvancedSettings ? 'Tutup Opsi' : 'Pengaturan Lanjutan'}</span>
              {showAdvancedSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {/* Hapus Folder Game dari PC */}
            {onDeleteFolder && (
              <button
                type="button"
                onClick={onDeleteFolder}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-white hover:bg-rose-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="Hapus folder game ini dan seluruh isinya permanen dari harddisk PC"
              >
                <Trash2 size={13} className="text-rose-400" />
                <span>Hapus Folder</span>
              </button>
            )}
          </div>

          {/* Tombol Aksi Sesuai Skenario di Kanan */}
          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            {/* Bersihkan Part RAR Lokal (Skenario D & B) */}
            {scenario?.canCleanParts && onCleanParts && (
              <button
                type="button"
                onClick={() => onCleanParts?.(activeFolder, genuinePartFiles.map((p) => p.name))}
                disabled={isBusy}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer ${theme.secondaryBtn}`}
                title="Hapus part RAR lokal untuk menghemat kapasitas disk"
              >
                <Trash2 size={13} />
                <span>{scenario.cleanLabel || 'Hapus Part RAR Lokal'}</span>
              </button>
            )}

            {/* Kompres WinRAR Lokal (Skenario A) */}
            {scenario?.canArchive && onArchive && (
              <button
                type="button"
                onClick={onArchive}
                disabled={isBusy}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer ${theme.secondaryBtn}`}
                title="Kompres folder game menjadi part WinRAR 4GB di PC"
              >
                <Package size={13} />
                <span>{scenario.archiveLabel || 'Kompres WinRAR 4GB'}</span>
              </button>
            )}

            {/* Tambah ke Antrean Batch (Opsional jika bisa upload) */}
            {scenario?.canUpload && onAddToQueue && (
              <button
                type="button"
                onClick={onAddToQueue}
                disabled={isBusy || !canUpload || quotaCheck?.status === 'danger'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-bold text-[var(--text-3)] hover:text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={
                  quotaCheck?.status === 'danger'
                    ? 'Kuota Drive tidak cukup'
                    : 'Tambahkan tugas ini ke antrean batch upload'
                }
              >
                <ListPlus size={14} />
                <span>Antrean</span>
              </button>
            )}

            {/* Tombol Utama: Upload ke Google Drive */}
            {scenario?.canUpload && onStartUpload && (
              <button
                type="button"
                onClick={onStartUpload}
                disabled={isBusy || !canUpload || quotaCheck?.status === 'danger'}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${theme.primaryBtn}`}
                title={
                  quotaCheck?.status === 'danger'
                    ? `Kuota Google Drive tidak mencukupi (Kurang ${formatBytes(Math.abs(quotaCheck.remainingAfterBytes))})`
                    : 'Mulai transfer file ke Google Drive'
                }
              >
                <UploadCloud size={14} />
                <span>{scenario.uploadLabel || 'Mulai Upload ke Drive'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. EXPANDABLE SECTION: MINI FILE EXPLORER (TERSEMBUNYI DEFAULT) ── */}
      {showExplorer && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <FolderInspector
            activeFolder={activeFolder}
            inspectData={inspectData}
            loading={inspectLoading}
            error={inspectError}
            onRefresh={onRefreshInspect}
            onDeleteSingleFile={onDeleteSingleFile}
            onDeleteFolder={onDeleteFolder}
            onCleanParts={() => onCleanParts?.(activeFolder)}
            onSanitizeJunk={onSanitizeJunk}
          />
        </div>
      )}

      {/* ── 3. EXPANDABLE SECTION: PENGATURAN LANJUTAN WINRAR (TERSEMBUNYI DEFAULT) ── */}
      {showAdvancedSettings && (
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text)]">
              <Settings size={14} className="text-cyan-400" />
              <span>Pengaturan Lanjutan Kompresi & Upload</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-4)]">
              Preset cerdas aktif otomatis
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Split Size WinRAR */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-3)]">
                <span>Ukuran Split Part WinRAR</span>
                <span className="font-mono text-cyan-400">{rarConfig?.splitSize || 4100} MB / Part</span>
              </div>
              <input
                type="range"
                min="500"
                max="8000"
                step="100"
                value={rarConfig?.splitSize || 4100}
                onChange={(e) => setRarConfig?.((prev) => ({ ...prev, splitSize: parseInt(e.target.value, 10) }))}
                className="w-full accent-cyan-400"
              />
              <p className="text-[10px] text-[var(--text-4)]">
                Default: 4100 MB (~4.1 GB). Pas untuk limit akun Google Drive standard & kestabilan download.
              </p>
            </div>

            {/* Toggle Sanitasi Otomatis & Replace */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-[var(--text-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCleanupLocal}
                  onChange={(e) => setAutoCleanupLocal?.(e.target.checked)}
                  className="rounded accent-[var(--primary)]"
                />
                <span>Hapus part RAR di PC otomatis setelah upload selesai 100%</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-[var(--text-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanReplace}
                  onChange={(e) => setCleanReplace?.(e.target.checked)}
                  className="rounded accent-amber-400"
                />
                <span>Hapus part versi lama di Drive saat mode Update (Clean Replace)</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
