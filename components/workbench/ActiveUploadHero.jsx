'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  UploadCloud, Loader2, Play, Pause, XCircle, ExternalLink,
  Zap, Clock, Layers, HardDrive, Terminal, ChevronDown,
  ChevronUp, CheckCircle2, AlertTriangle, Eye, EyeOff,
  Sparkles, Trash2, Tag, RotateCcw, Check
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
}) {
  const [showTerminal, setShowTerminal] = useState(true)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const logContainerRef = useRef(null)

  const status = processState?.status || 'idle'
  const isSuccess = status === 'success' || processState?.phase === 'done'
  const isError = status === 'error'
  const isPaused = status === 'paused'
  const isUploading = status === 'processing' && !isPaused && !isSuccess

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
  const currentPartBytes = processState?.currentPartBytes || 0
  const currentPartTotalBytes = processState?.currentPartTotalBytes || 0
  const totalBytesUploaded = processState?.totalBytesUploaded || 0
  const totalBytesNeeded = processState?.totalBytesNeeded || 0

  const logs = Array.isArray(processState?.logs) ? processState.logs : []

  // Auto-scroll terminal log to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs.length])

  return (
    <div className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 lg:p-6 shadow-2xl transition-all duration-300 w-full min-w-0 space-y-4 ${
      isSuccess
        ? 'border-emerald-500/40 bg-[var(--surface)] shadow-emerald-500/10'
        : isError
        ? 'border-rose-500/40 bg-[var(--surface)] shadow-rose-500/10'
        : isPaused
        ? 'border-amber-400/40 bg-[var(--surface)] shadow-amber-500/10'
        : 'border-[var(--primary)]/40 bg-[var(--surface)] shadow-[var(--primary)]/10'
    }`}>
      {/* Background Ambient Glow */}
      {isSuccess ? (
        <>
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        </>
      ) : isError ? (
        <>
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rose-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--primary)]/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        </>
      )}

      {/* ── 1. HEADER IDENTITAS UPLOAD / SELESAI ── */}
      <div className="relative flex items-start gap-3 sm:gap-4 pb-4 border-b border-white/5 min-w-0">
        {/* Animated Icon Container */}
        <div className={`flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl border transition-all ${
          isSuccess
            ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-lg shadow-emerald-500/20'
            : isError
            ? 'border-rose-500/50 bg-rose-500/20 text-rose-300 shadow-lg shadow-rose-500/20'
            : isPaused
            ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
            : 'border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)] shadow-lg shadow-[var(--primary)]/20'
        }`}>
          {isSuccess ? (
            <CheckCircle2 size={24} className="sm:w-7 sm:h-7" />
          ) : isError ? (
            <AlertTriangle size={24} className="sm:w-7 sm:h-7" />
          ) : isPaused ? (
            <Pause size={22} className="sm:w-6 sm:h-6" />
          ) : (
            <Loader2 size={22} className="animate-spin sm:w-6 sm:h-6" />
          )}
        </div>

        {/* Title & Target Metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : isError
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : isPaused
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                : 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 animate-pulse'
            }`}>
              {isSuccess
                ? isUpdate
                  ? '🎉 Update Versi Berhasil Diterapkan ke Google Drive'
                  : '✅ Upload 100% Sukses — Siap Dijual'
                : isError
                ? '❌ Terjadi Gangguan Upload'
                : isPaused
                ? '⏸️ Upload Dijeda'
                : '🚀 Upload Berjalan (Prioritas Utama)'}
            </span>

            {finalVersion && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Tag size={10} />
                <span>Versi: {finalVersion}</span>
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

          <h2 className="text-base sm:text-lg font-black text-[var(--text)] uppercase tracking-wide truncate mt-1" title={gameTitle}>
            {gameTitle}
          </h2>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono text-[var(--text-3)] mt-0.5">
            <span className="text-[var(--text-4)]">Tujuan:</span>
            <span className="text-[var(--text)] font-semibold truncate max-w-[200px] sm:max-w-xs">{targetEmail || 'Google Drive Workspace'}</span>
            {!isSuccess && currentPartName && (
              <>
                <span className="text-[var(--text-4)] hidden sm:inline">•</span>
                <span className="text-amber-300 font-semibold truncate max-w-full sm:max-w-xs">{currentPartName}</span>
              </>
            )}
            {isSuccess && (
              <>
                <span className="text-[var(--text-4)] hidden sm:inline">•</span>
                <span className="text-emerald-400 font-semibold">Tersimpan di Katalog MongoDB</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. TOOLBAR KONTROL AKSI (COCKPIT PASCA-UPLOAD / IN-PROGRESS CONTROL) ── */}
      <div className={`flex flex-wrap items-center justify-between gap-2.5 py-2.5 px-3.5 sm:px-4 rounded-2xl border ${
        isSuccess
          ? 'bg-black/50 border-emerald-500/20'
          : isError
          ? 'bg-black/50 border-rose-500/20'
          : 'bg-black/40 border-white/5'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Kondisi 1: Selesai Sukses (Next Best Actions) */}
          {isSuccess && (
            <>
              {/* 1. Buat Listing Shopee (Aksi Paling Utama) */}
              <Link
                href={`/scout?prefill=${encodeURIComponent(cleanTitle)}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-[var(--primary)]/20 transition-all cursor-pointer"
                title="Buka Shopee Listing Studio untuk meracik SEO dan render slide produk"
              >
                <Sparkles size={14} className="fill-current" />
                <span>Buat Listing Shopee</span>
              </Link>

              {/* 2. Buka Folder Google Drive */}
              {driveFolderId && (
                <a
                  href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer"
                  title="Buka folder game langsung di web browser Google Drive"
                >
                  <ExternalLink size={14} />
                  <span>Buka di Google Drive</span>
                </a>
              )}

              {/* 3. Bersihkan Part RAR di PC */}
              {onCleanParts && (
                <button
                  type="button"
                  onClick={onCleanParts}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
                  title="Hapus file part RAR di storage PC untuk hemat kapasitas disk"
                >
                  <Trash2 size={14} />
                  <span>Bersihkan Part RAR PC</span>
                </button>
              )}

              {/* 4. Selesai / Siap Upload Game Lain */}
              {onResetProcessState && (
                <button
                  type="button"
                  onClick={onResetProcessState}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Tutup cockpit ini dan kembali ke meja kerja bersih untuk game berikutnya"
                >
                  <CheckCircle2 size={14} />
                  <span>Selesai (Siap Game Lain)</span>
                </button>
              )}
            </>
          )}

          {/* Kondisi 2: Error (Retry / Reset) */}
          {isError && (
            <>
              <button
                type="button"
                onClick={() => onProcessControl?.('resume')}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Play size={14} className="fill-current" />
                <span>Coba Lanjutkan (Resume)</span>
              </button>

              {onResetProcessState && (
                <button
                  type="button"
                  onClick={onResetProcessState}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Tutup / Reset Status</span>
                </button>
              )}
            </>
          )}

          {/* Kondisi 3: Masih Berjalan (Pause / Resume / Cancel) */}
          {!isSuccess && !isError && (
            <>
              {isPaused ? (
                <button
                  type="button"
                  onClick={() => onProcessControl?.('resume')}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Play size={14} className="fill-current" />
                  <span>Lanjutkan Upload</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onProcessControl?.('pause')}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
                >
                  <Pause size={14} />
                  <span>Jeda Sementara</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                <XCircle size={14} />
                <span>Batalkan Upload</span>
              </button>
            </>
          )}
        </div>

        {onToggleSecondaryView && (
          <button
            type="button"
            onClick={onToggleSecondaryView}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/10 transition-all cursor-pointer"
            title={showSecondaryView ? 'Sembunyikan Penjelajah Berkas' : 'Tampilkan Penjelajah Berkas Lokal'}
          >
            {showSecondaryView ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showSecondaryView ? 'Tutup Berkas' : 'Lihat Berkas Lokal'}</span>
          </button>
        )}
      </div>

      {/* ── 3. 4 KARTU TELEMETRI REAL-TIME / RINGKASAN SELESAI ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Status Katalog / Kecepatan */}
        <div className="rounded-2xl border border-white/5 bg-black/30 p-3 sm:p-3.5 space-y-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-4)]">
            <span>{isSuccess ? 'Status Katalog' : 'Kecepatan'}</span>
            {isSuccess ? (
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            ) : (
              <Zap size={13} className="text-amber-400 shrink-0" />
            )}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-[var(--text)] truncate">
            {isSuccess
              ? isUpdate
                ? 'Versi Diperbarui'
                : 'Tersimpan Aktif'
              : speedMBps > 0
              ? `${speedMBps} MB/s`
              : isPaused
              ? '0 MB/s (Dijeda)'
              : 'Menghitung...'}
          </div>
          <div className="text-[10px] text-[var(--text-4)] truncate">
            {isSuccess
              ? 'Mongoose GameCatalog OK'
              : speedMBps > 0
              ? `~${(speedMBps * 8).toFixed(1)} Mbps bandwidth`
              : 'Koneksi langsung GDrive'}
          </div>
        </div>

        {/* Card 2: Hasil Integritas / Estimasi Waktu (ETA) */}
        <div className="rounded-2xl border border-white/5 bg-black/30 p-3 sm:p-3.5 space-y-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-4)]">
            <span>{isSuccess ? 'Hasil Integritas' : 'Sisa Waktu (ETA)'}</span>
            {isSuccess ? (
              <Sparkles size={13} className="text-cyan-400 shrink-0" />
            ) : (
              <Clock size={13} className="text-cyan-400 shrink-0" />
            )}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-[var(--text)] truncate">
            {isSuccess ? '100% Terverifikasi' : isPaused ? 'Dijeda' : formatETA(etaSeconds)}
          </div>
          <div className="text-[10px] text-[var(--text-4)] truncate">
            {isSuccess
              ? 'Semua part siap unduh'
              : totalBytesNeeded > 0
              ? `${formatBytes(Math.max(0, totalBytesNeeded - totalBytesUploaded))} tersisa`
              : 'Berdasarkan kecepatan aktif'}
          </div>
        </div>

        {/* Card 3: Total Part / Part Berjalan */}
        <div className="rounded-2xl border border-white/5 bg-black/30 p-3 sm:p-3.5 space-y-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-4)]">
            <span>{isSuccess ? 'Total File Part' : 'Part Aktif'}</span>
            <Layers size={13} className="text-emerald-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-[var(--primary)] truncate">
            {isSuccess ? (
              `${totalParts} Part`
            ) : (
              <>
                Part {currentPart} <span className="text-xs text-[var(--text-3)] font-normal">/ {totalParts}</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-[var(--text-4)] truncate">
            {isSuccess ? 'Lengkap di Google Drive' : `${Math.max(0, totalParts - currentPart)} part menunggu`}
          </div>
        </div>

        {/* Card 4: Versi Terdaftar / Ukuran Transfer */}
        <div className="rounded-2xl border border-white/5 bg-black/30 p-3 sm:p-3.5 space-y-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-4)]">
            <span>{isSuccess ? 'Versi Terdaftar' : 'Total Ditransfer'}</span>
            {isSuccess ? (
              <Tag size={13} className="text-purple-400 shrink-0" />
            ) : (
              <HardDrive size={13} className="text-purple-400 shrink-0" />
            )}
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-[var(--text)] truncate">
            {isSuccess ? finalVersion || 'v1.0 (Default)' : formatBytes(totalBytesUploaded)}
          </div>
          <div className="text-[10px] text-[var(--text-4)] truncate">
            {isSuccess
              ? `Ukuran: ${formatBytes(totalBytesUploaded)}`
              : totalBytesNeeded > 0
              ? `dari total ${formatBytes(totalBytesNeeded)}`
              : 'Mengunggah bertahap'}
          </div>
        </div>
      </div>

      {/* ── 4. PROGRESS BAR HERO ── */}
      <div className="space-y-3 rounded-2xl border border-white/5 bg-black/40 p-3.5 sm:p-4">
        {isSuccess ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Seluruh Berkas Part Berhasil Terunggah ke Google Drive</span>
              </span>
              <span className="font-mono text-sm font-black text-emerald-400">100% Selesai</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/60 p-0.5 border border-emerald-500/30">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/30" />
            </div>
            <p className="text-[11px] text-[var(--text-3)] font-medium">
              Berkas game telah disinkronkan ke katalog MongoDB. Anda dapat langsung melanjutkan ke pembuatan materi iklan Shopee atau membersihkan part RAR lokal untuk menghemat kapasitas disk PC.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. Progress Part yang Sedang Diunggah */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[var(--text-3)] shrink-0">Progress File Part Aktif:</span>
                  <span className="text-amber-300 font-mono truncate" title={currentPartName}>
                    {currentPartName || `Part ${currentPart}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono shrink-0">
                  {currentPartTotalBytes > 0 && (
                    <span className="text-[11px] text-[var(--text-4)]">
                      {formatBytes(currentPartBytes)} / {formatBytes(currentPartTotalBytes)}
                    </span>
                  )}
                  <span className="text-sm font-black text-[var(--primary)]">{partProgress}%</span>
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-black/60 p-0.5 border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-emerald-400 transition-all duration-300 shadow-md shadow-[var(--primary)]/30"
                  style={{ width: `${Math.max(2, Math.min(100, partProgress))}%` }}
                />
              </div>
            </div>

            {/* 2. Progress Akumulatif Seluruh Game */}
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[var(--text-3)]">
                <span>Akumulatif Total Seluruh Game:</span>
                <div className="flex items-center gap-2 font-mono shrink-0">
                  {totalBytesNeeded > 0 && (
                    <span>
                      {formatBytes(totalBytesUploaded)} / {formatBytes(totalBytesNeeded)}
                    </span>
                  )}
                  <span className="font-bold text-[var(--text)]">{overallProgress}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${Math.max(1, Math.min(100, overallProgress))}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. LIVE TERMINAL LOG STREAM ── */}
      <div className="rounded-2xl border border-white/5 bg-black/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTerminal((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-2.5 bg-black/80 text-xs font-bold text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Terminal size={14} className={isSuccess ? 'text-emerald-400' : 'text-[var(--primary)]'} />
            <span className="font-mono uppercase tracking-wider text-[11px]">
              Live Streaming Log Console ({logs.length})
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-4)]">
            <span>{showTerminal ? 'Sembunyikan' : 'Tampilkan Log'}</span>
            {showTerminal ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </button>

        {showTerminal && (
          <div
            ref={logContainerRef}
            className="max-h-52 overflow-y-auto p-3.5 space-y-1 text-[11px] font-mono text-zinc-300 select-text"
          >
            {logs.length === 0 ? (
              <p className="text-[var(--text-4)] italic">Menunggu log pertama dari worker...</p>
            ) : (
              logs.map((log, idx) => {
                const isLogSuccess =
                  log.includes('Selesai upload') || log.includes('berhasil') || log.includes('dilewati')
                const isWarn = log.includes('Koneksi tersendat') || log.includes('Mencoba ulang')
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
                        : 'text-zinc-300'
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
                <h4 className="text-sm font-black text-[var(--text)]">Batalkan Upload?</h4>
                <p className="text-xs text-[var(--text-4)]">Proses upload part akan dihentikan seketika.</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-3)] leading-relaxed">
              File part yang sudah selesai 100% sebelumnya aman tersimpan di Google Drive dan dapat dilanjutkan kapan saja.
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
                Ya, Batalkan Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
