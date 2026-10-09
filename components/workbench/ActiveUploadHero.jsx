'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  UploadCloud, Loader2, Play, Pause, XCircle, ExternalLink,
  Zap, Clock, Layers, HardDrive, Terminal, ChevronDown,
  ChevronUp, CheckCircle2, AlertTriangle, Eye, EyeOff,
  Sparkles, Trash2, Tag, RotateCcw, Package, Cpu
} from 'lucide-react'
import { formatBytes, cleanReleaseName } from '@/lib/utils'

function formatETA(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return 'Menghitung...'
  if (seconds < 60) return `${seconds} dtk`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hours}j ${remMins}m`
}

export default function ActiveUploadHero({
  processState = {},
  selectedFolder = null,
  targetWorkspace = null,
  onProcessControl,
  onToggleSecondaryView,
  showSecondaryView = false,
  onResetProcessState,
  onCleanParts,
  fileVersion: fileVersionProp = '',
  onProceedToUpload,
}) {
  const [showTerminal, setShowTerminal] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const logContainerRef = useRef(null)

  const status = processState?.status || 'idle'
  const phase = processState?.phase || ''
  const action = processState?.action || ''

  const isArchiving = phase === 'archiving' || action === 'archive'
  const isSuccess = status === 'success' || phase === 'done'
  const isArchiveSuccess = isSuccess && (action === 'archive' || (!processState?.driveFolderId && !processState?.totalBytesUploaded && isArchiving))
  const isError = status === 'error'
  const isPaused = status === 'paused'
  const isUploading = !isArchiving && status === 'processing' && !isPaused && !isSuccess

  const gameTitle = processState?.gameName || selectedFolder?.name || 'Mengunggah Berkas...'
  const cleanTitle = cleanReleaseName(gameTitle)
  const targetEmail = processState?.targetEmail || targetWorkspace?.email || ''
  const driveFolderId = processState?.driveFolderId
  const finalVersion = processState?.fileVersion || fileVersionProp || ''
  const isUpdate = !!processState?.isUpdate

  const currentPart = processState?.currentPart || 1
  const totalParts = processState?.totalParts || 1
  const currentPartName = processState?.currentPartName || ''
  const partProgress = processState?.progress || 0
  const overallProgress = processState?.overallProgress ?? partProgress

  const speedMBps = processState?.speedMBps || 0
  const etaSeconds = processState?.etaSeconds
  const totalBytesProcessed = processState?.totalBytesProcessed || 0
  const totalBytesUploaded = processState?.totalBytesUploaded || 0
  const totalBytesNeeded = processState?.totalBytesNeeded || 0

  const logs = Array.isArray(processState?.logs) ? processState.logs : []

  // Auto-scroll terminal log to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs.length])

  // Border & Glow theme
  const getContainerStyle = () => {
    if (isSuccess) return 'border-emerald-500/30 bg-zinc-950/90 shadow-emerald-500/5'
    if (isError) return 'border-rose-500/30 bg-zinc-950/90 shadow-rose-500/5'
    if (isPaused) return 'border-amber-400/30 bg-zinc-950/90 shadow-amber-500/5'
    if (isArchiving) return 'border-cyan-500/30 bg-zinc-950/90 shadow-cyan-500/5'
    return 'border-emerald-500/30 bg-zinc-950/90 shadow-emerald-500/5'
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-xl transition-all duration-300 w-full min-w-0 space-y-4 ${getContainerStyle()}`}>
      {/* ── 1. HEADER IDENTITAS (MINIMALIST & CLEAN) ── */}
      <div className="relative flex items-start gap-3.5 pb-3.5 border-b border-white/5 min-w-0">
        {/* Animated Icon Avatar */}
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
          isSuccess
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            : isError
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
            : isPaused
            ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
            : isArchiving
            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-md shadow-cyan-500/10'
            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-md shadow-emerald-500/10'
        }`}>
          {isSuccess ? (
            <CheckCircle2 size={22} />
          ) : isError ? (
            <AlertTriangle size={22} />
          ) : isPaused ? (
            <Pause size={20} />
          ) : isArchiving ? (
            <Package size={20} className="animate-pulse" />
          ) : (
            <UploadCloud size={20} className="animate-pulse" />
          )}
        </div>

        {/* Title, Badge & Subtitle */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isSuccess
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : isError
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                : isPaused
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                : isArchiving
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            }`}>
              {isSuccess
                ? isArchiveSuccess
                  ? '📦 Kompresi Arsip Sukses — Siap Diunggah'
                  : isUpdate
                  ? '🎉 Update Versi Sukses Diterapkan'
                  : '✅ Unggah Selesai — Siap Dijual'
                : isError
                ? isArchiving ? '❌ Gangguan Kompresi' : '❌ Gangguan Unggah'
                : isPaused
                ? isArchiving ? '⏸️ Kompresi Dijeda' : '⏸️ Unggah Dijeda'
                : isArchiving
                ? '📦 Kompresi WinRAR (Split 4.1 GB)'
                : '🚀 Unggah Google Drive (Aktif)'}
            </span>

            {finalVersion && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-[var(--text-2)] border border-white/10">
                <Tag size={10} className="text-emerald-400" />
                <span>v{finalVersion}</span>
              </span>
            )}

            {driveFolderId && (
              <a
                href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors ml-auto sm:ml-0"
              >
                <span>Buka di Google Drive</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-black text-white tracking-wide truncate mt-1" title={gameTitle}>
            {gameTitle}
          </h2>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-3)] mt-0.5">
            {isSuccess && isArchiveSuccess ? (
              <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span>{totalParts} Berkas Part RAR lengkap di harddisk PC lokal (Siap Diunggah ke Google Drive)</span>
              </span>
            ) : isArchiving ? (
              <span className="flex items-center gap-1 text-cyan-300/90 font-mono text-[11px]">
                <Cpu size={12} className="text-cyan-400" />
                <span>Format RAR5 Solid • Split Part 4.1 GB • Harddisk Lokal PC</span>
              </span>
            ) : (
              <>
                <span className="text-[var(--text-4)]">Tujuan:</span>
                <span className="text-[var(--text)] font-semibold truncate max-w-[200px] sm:max-w-xs">
                  {targetEmail || 'Google Drive Workspace'}
                </span>
                {!isSuccess && currentPartName && (
                  <>
                    <span className="text-[var(--text-4)] hidden sm:inline">•</span>
                    <span className="text-amber-300 font-mono text-[11px] truncate">{currentPartName}</span>
                  </>
                )}
                {isSuccess && (
                  <>
                    <span className="text-[var(--text-4)] hidden sm:inline">•</span>
                    <span className="text-emerald-400 font-medium">Tersimpan di Katalog MongoDB</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. TOOLBAR KONTROL AKSI ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 py-2 px-3 sm:px-3.5 rounded-xl border border-white/5 bg-black/40">
        <div className="flex flex-wrap items-center gap-2">
          {/* Kondisi 1: Selesai Sukses */}
          {isSuccess && (
            <>
              {isArchiveSuccess ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (onProceedToUpload) {
                        onProceedToUpload()
                      } else if (onResetProcessState) {
                        onResetProcessState()
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-1.5 text-xs font-black text-black hover:brightness-110 shadow-sm transition-all cursor-pointer"
                    title="Buka Cockpit Upload untuk mengirim file ke Google Drive"
                  >
                    <UploadCloud size={14} className="fill-current" />
                    <span>Lanjut Upload ke Google Drive</span>
                  </button>

                  {onResetProcessState && (
                    <button
                      type="button"
                      onClick={onResetProcessState}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      <span>Selesai (Tutup)</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Link
                    href={`/scout?prefill=${encodeURIComponent(cleanTitle)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-1.5 text-xs font-black text-black hover:brightness-110 shadow-sm transition-all cursor-pointer"
                    title="Buka Shopee Listing Studio"
                  >
                    <Sparkles size={13} className="fill-current" />
                    <span>Buat Listing Shopee</span>
                  </Link>

                  {driveFolderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer"
                    >
                      <ExternalLink size={13} />
                      <span>Buka di Drive</span>
                    </a>
                  )}

                  {onCleanParts && (
                    <button
                      type="button"
                      onClick={onCleanParts}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Bersihkan Part PC</span>
                    </button>
                  )}

                  {onResetProcessState && (
                    <button
                      type="button"
                      onClick={onResetProcessState}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      <span>Selesai (Siap Game Lain)</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* Kondisi 2: Error */}
          {isError && (
            <>
              <button
                type="button"
                onClick={() => onProcessControl?.('resume')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-black text-black hover:brightness-110 transition-all cursor-pointer"
              >
                <Play size={13} className="fill-current" />
                <span>Coba Lanjutkan</span>
              </button>

              {onResetProcessState && (
                <button
                  type="button"
                  onClick={onResetProcessState}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Reset Status</span>
                </button>
              )}
            </>
          )}

          {/* Kondisi 3: Berjalan (Archiving atau Uploading) */}
          {!isSuccess && !isError && (
            <>
              {isPaused ? (
                <button
                  type="button"
                  onClick={() => onProcessControl?.('resume')}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-black text-black hover:brightness-110 transition-all cursor-pointer ${
                    isArchiving ? 'bg-cyan-400' : 'bg-emerald-400'
                  }`}
                >
                  <Play size={13} className="fill-current" />
                  <span>{isArchiving ? 'Lanjutkan Kompresi' : 'Lanjutkan Unggah'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onProcessControl?.('pause')}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
                >
                  <Pause size={13} />
                  <span>{isArchiving ? 'Jeda Kompresi' : 'Jeda Unggah'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                <XCircle size={13} />
                <span>{isArchiving ? 'Batalkan Kompresi' : 'Batalkan Unggah'}</span>
              </button>
            </>
          )}
        </div>

        {onToggleSecondaryView && (
          <button
            type="button"
            onClick={onToggleSecondaryView}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/10 transition-all cursor-pointer ml-auto"
            title={showSecondaryView ? 'Sembunyikan Berkas' : 'Tampilkan Berkas'}
          >
            {showSecondaryView ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showSecondaryView ? 'Tutup Berkas' : 'Lihat Berkas'}</span>
          </button>
        )}
      </div>

      {/* ── 3. 4 KARTU TELEMETRI (MINIMALIST & PRESISI) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Card 1: Kecepatan / Status */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3 space-y-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-4)]">
            <span>
              {isSuccess
                ? isArchiveSuccess ? 'Status Arsip' : 'Status Katalog'
                : isArchiving ? 'Kecepatan Kompresi' : 'Kecepatan Unggah'}
            </span>
            {isSuccess ? (
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            ) : isArchiving ? (
              <Zap size={13} className="text-cyan-400 shrink-0" />
            ) : (
              <Zap size={13} className="text-emerald-400 shrink-0" />
            )}
          </div>
          <div className="text-base font-black font-mono text-white truncate">
            {isSuccess
              ? isArchiveSuccess ? 'Siap Diunggah' : isUpdate ? 'Versi Diperbarui' : 'Tersimpan Aktif'
              : speedMBps > 0
              ? `${speedMBps} MB/s`
              : isPaused
              ? '0 MB/s (Dijeda)'
              : 'Menghitung...'}
          </div>
          <div className="text-[10px] text-[var(--text-4)] truncate">
            {isSuccess
              ? isArchiveSuccess ? 'Part RAR Tersusun Rapi' : 'Mongoose GameCatalog OK'
              : isArchiving
              ? 'I/O Disk Lokal PC'
              : 'Koneksi Google Drive'}
          </div>
        </div>

        {/* Card 2: Estimasi Sisa Waktu (ETA) */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3 space-y-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-4)]">
            <span>{isSuccess ? 'Hasil Integritas' : 'Sisa Waktu (ETA)'}</span>
            {isSuccess ? (
              <Sparkles size={13} className="text-cyan-400 shrink-0" />
            ) : (
              <Clock size={13} className="text-cyan-400 shrink-0" />
            )}
          </div>
          <div className="text-base font-black font-mono text-white truncate">
            {isSuccess ? '100% Terverifikasi' : isPaused ? 'Dijeda' : formatETA(etaSeconds)}
          </div>
          <div className="text-[10px] text-[var(--text-4)] truncate">
            {isSuccess
              ? isArchiveSuccess ? 'Semua part siap diunggah' : 'Semua part siap unduh'
              : totalBytesNeeded > 0
              ? `${formatBytes(Math.max(0, totalBytesNeeded - (isArchiving ? totalBytesProcessed : totalBytesUploaded)))} tersisa`
              : 'Berdasarkan kecepatan aktif'}
          </div>
        </div>

        {/* Card 3: Part Aktif / Diproses */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3 space-y-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-4)]">
            <span>
              {isSuccess
                ? isArchiveSuccess ? 'Total Part Dihasilkan' : 'Total File Part'
                : isArchiving ? 'Part Diproses' : 'Part Aktif'}
            </span>
            <Layers size={13} className={isArchiving ? 'text-cyan-400 shrink-0' : 'text-emerald-400 shrink-0'} />
          </div>
          <div className="text-base font-black font-mono text-[var(--primary)] truncate">
            {isSuccess ? (
              `${totalParts} Part`
            ) : (
              <>
                Part {currentPart} <span className="text-xs text-[var(--text-3)] font-normal">/ {totalParts}</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-[var(--text-4)] truncate">
            {isSuccess
              ? isArchiveSuccess ? 'Tersimpan di Harddisk PC' : 'Lengkap di Google Drive'
              : isArchiving
              ? 'Split 4.1 GB per part'
              : `${Math.max(0, totalParts - currentPart)} part antre`}
          </div>
        </div>

        {/* Card 4: Ukuran / Kapasitas */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3 space-y-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-4)]">
            <span>
              {isSuccess
                ? isArchiveSuccess ? 'Ukuran Total Arsip' : 'Versi Terdaftar'
                : isArchiving ? 'Ukuran Diproses' : 'Total Ditransfer'}
            </span>
            <HardDrive size={13} className="text-purple-400 shrink-0" />
          </div>
          <div className="text-base font-black font-mono text-white truncate">
            {isSuccess
              ? isArchiveSuccess
                ? formatBytes(totalBytesProcessed || totalBytesNeeded)
                : finalVersion || 'v1.0 (Default)'
              : formatBytes(isArchiving ? totalBytesProcessed : totalBytesUploaded)}
          </div>
          <div className="text-[10px] text-[var(--text-4)] truncate">
            {isSuccess
              ? isArchiveSuccess
                ? `Total ${totalParts} file split RAR`
                : `Ukuran: ${formatBytes(totalBytesUploaded || totalBytesProcessed)}`
              : totalBytesNeeded > 0
              ? `dari total ${formatBytes(totalBytesNeeded)}`
              : isArchiving ? 'Memproses berkas' : 'Mengunggah bertahap'}
          </div>
        </div>
      </div>

      {/* ── 4. PROGRESS BAR TUNGGAL (UNIFIED & SLEEK) ── */}
      <div className="rounded-xl border border-white/5 bg-black/40 p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-[var(--text-3)] font-semibold shrink-0">
              {isSuccess
                ? isArchiveSuccess
                  ? 'Arsip Berhasil Dibuat:'
                  : 'Unggah Berhasil Diselesaikan:'
                : isArchiving
                ? 'Memproses Arsip:'
                : 'Mengunggah Part:'}
            </span>
            <span className="text-white font-mono text-[11px] truncate" title={isSuccess ? (isArchiveSuccess ? `${cleanTitle} (${totalParts} Part RAR)` : cleanTitle) : currentPartName}>
              {isSuccess
                ? isArchiveSuccess
                  ? `${cleanTitle} (${totalParts} Part RAR)`
                  : `${cleanTitle} (${totalParts} Part)`
                : currentPartName || `Part ${currentPart}`}
            </span>
          </div>
          <span className="font-mono text-sm font-black text-[var(--primary)] shrink-0">
            {isSuccess ? 100 : overallProgress}%
          </span>
        </div>

        {/* Bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/70 p-0.5 border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-300 shadow-sm ${
              isSuccess
                ? 'bg-emerald-400'
                : isArchiving
                ? 'bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500'
                : 'bg-gradient-to-r from-[var(--primary)] via-emerald-400 to-teal-400'
            }`}
            style={{ width: `${isSuccess ? 100 : Math.max(2, Math.min(100, overallProgress))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--text-4)] font-mono pt-0.5">
          <span>
            {isSuccess
              ? isArchiveSuccess
                ? `Total ${formatBytes(totalBytesProcessed || totalBytesNeeded)} siap diunggah ke Google Drive`
                : `Total ${formatBytes(totalBytesUploaded || totalBytesProcessed)} tersimpan aman di Google Drive`
              : totalBytesNeeded > 0
              ? `${formatBytes(isArchiving ? totalBytesProcessed : totalBytesUploaded)} dari ${formatBytes(totalBytesNeeded)}`
              : processState.text || 'Memproses berkas...'}
          </span>
          <span>{isSuccess ? `${totalParts} Part Selesai` : `Estimasi ~${totalParts} Part`}</span>
        </div>
      </div>

      {/* ── 5. LIVE TERMINAL LOG STREAM (COMPACT & COLLAPSIBLE) ── */}
      <div className="rounded-xl border border-white/5 bg-black/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTerminal((prev) => !prev)}
          className="flex w-full items-center justify-between px-3.5 py-2 bg-black/60 text-xs font-bold text-[var(--text-3)] hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Terminal size={13} className={isArchiving ? 'text-cyan-400' : 'text-emerald-400'} />
            <span className="font-mono uppercase tracking-wider text-[11px]">
              Live Terminal Log ({logs.length})
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-4)]">
            <span>{showTerminal ? 'Sembunyikan' : 'Buka Log'}</span>
            {showTerminal ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </button>

        {showTerminal && (
          <div
            ref={logContainerRef}
            className="max-h-40 overflow-y-auto p-3 space-y-1 text-[11px] font-mono text-zinc-300 select-text bg-black/70 border-t border-white/5"
          >
            {logs.length === 0 ? (
              <p className="text-[var(--text-4)] italic">Menunggu log pertama dari worker...</p>
            ) : (
              logs.map((log, idx) => {
                const isLogSuccess =
                  log.includes('Selesai') || log.includes('berhasil') || log.includes('100%')
                const isWarn = log.includes('checkpoint') || log.includes('Mencoba')
                const isLogError = log.includes('ERROR') || log.includes('Gagal')
                return (
                  <div
                    key={idx}
                    className={`leading-relaxed py-0.5 ${
                      isLogError
                        ? 'text-rose-400 font-bold'
                        : isWarn
                        ? 'text-amber-300'
                        : isLogSuccess
                        ? 'text-emerald-300'
                        : 'text-zinc-400'
                    }`}
                  >
                    {log}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* ── MODAL KONFIRMASI BATALKAN ── */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-[var(--surface)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-[var(--text)]">
                  {isArchiving ? 'Batalkan Kompresi WinRAR?' : 'Batalkan Unggah Google Drive?'}
                </h4>
                <p className="text-xs text-[var(--text-4)]">
                  {isArchiving
                    ? 'Proses kompresi lokal akan dihentikan.'
                    : 'Proses upload part akan dihentikan seketika.'}
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-3)] leading-relaxed">
              {isArchiving
                ? 'Part WinRAR yang belum selesai akan dihentikan. Anda dapat memulai kompresi ulang kapan saja.'
                : 'File part yang sudah selesai 100% sebelumnya aman tersimpan di Google Drive.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="rounded-xl border border-white/10 px-3.5 py-1.5 text-xs font-bold text-[var(--text)] hover:bg-white/10 transition-colors cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirm(false)
                  onProcessControl?.('cancel')
                }}
                className="rounded-xl bg-rose-500 px-3.5 py-1.5 text-xs font-black text-white hover:bg-rose-600 transition-colors cursor-pointer"
              >
                {isArchiving ? 'Ya, Hentikan Kompresi' : 'Ya, Batalkan Unggah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
