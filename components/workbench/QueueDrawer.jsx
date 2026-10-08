'use client'

import { useState } from 'react'
import {
  X, Play, Pause, Trash2, RotateCcw, AlertTriangle, CheckCircle2,
  Clock, Loader2, CloudUpload, Sparkles, Folder, ChevronRight,
  ListOrdered, ShieldAlert
} from 'lucide-react'
import { formatBytes } from '@/lib/utils'

export default function QueueDrawer({
  isOpen = false,
  onClose,
  queue = [],
  isQueueRunning = false,
  activeQueueId = null,
  processState = null,
  onStartQueue,
  onPauseQueue,
  onClearCompleted,
  onClearAll,
  onRemoveItem,
  onRetryItem,
  onRetryAllFailed,
}) {
  if (!isOpen) return null

  const waitingItems = queue.filter((item) => item.status === 'waiting')
  const completedItems = queue.filter((item) => item.status === 'success')
  const failedItems = queue.filter((item) => item.status === 'failed')

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20">
              <ListOrdered size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">
                Antrean Upload Batch ({queue.length})
              </h3>
              <p className="text-[10px] text-[var(--text-4)]">
                {isQueueRunning ? 'Runner aktif (otomatis lanjut jika ada error)' : 'Runner dijeda'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            {isQueueRunning ? (
              <button
                type="button"
                onClick={onPauseQueue}
                className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/20 transition-all"
              >
                <Pause size={13} />
                <span>Jeda Runner</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartQueue}
                disabled={waitingItems.length === 0 && failedItems.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-1.5 text-xs font-black text-black hover:brightness-110 transition-all shadow-md disabled:opacity-50"
              >
                <Play size={13} />
                <span>Mulai Runner</span>
              </button>
            )}

            {failedItems.length > 0 && onRetryAllFailed && (
              <button
                type="button"
                onClick={onRetryAllFailed}
                className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all"
                title="Ulangi semua game yang gagal"
              >
                <RotateCcw size={12} />
                <span>Retry Semua Gagal ({failedItems.length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {completedItems.length > 0 && onClearCompleted && (
              <button
                type="button"
                onClick={onClearCompleted}
                className="p-1.5 rounded-lg text-[10px] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/5 transition-colors"
                title="Bersihkan item yang selesai"
              >
                Hapus Selesai
              </button>
            )}
            {queue.length > 0 && onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="p-1.5 rounded-lg text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                title="Hapus semua antrean"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 scrollbar-thin">
          {queue.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-[var(--text-4)]">
              <CloudUpload size={32} className="text-white/10 mb-2" />
              <span>Belum ada game di antrean upload.</span>
              <span className="text-[10px] opacity-70 mt-1">
                Pilih folder game lalu klik &quot;Tambah Antrean&quot;.
              </span>
            </div>
          ) : (
            queue.map((item, idx) => {
              const isActive = item.id === activeQueueId
              const isWaiting = item.status === 'waiting'
              const isSuccess = item.status === 'success'
              const isFailed = item.status === 'failed'

              return (
                <div
                  key={item.id}
                  className={`relative flex flex-col gap-2 rounded-xl border p-3 transition-all ${
                    isActive
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5 shadow-md'
                      : isFailed
                      ? 'border-rose-500/40 bg-rose-500/5'
                      : isSuccess
                      ? 'border-emerald-500/30 bg-emerald-500/5 opacity-85'
                      : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-[var(--text-4)] font-bold">
                        #{idx + 1}
                      </span>
                      <h4 className="text-xs font-bold text-[var(--text)] truncate">
                        {item.customTitle || item.folder?.name || 'Item Game'}
                      </h4>
                    </div>

                    {/* Status Pill */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isActive && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-[9px] font-bold text-[var(--primary)] animate-pulse">
                          <Loader2 size={10} className="animate-spin" />
                          <span>Proses ({processState?.progress || 0}%)</span>
                        </span>
                      )}
                      {isWaiting && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-mono text-[var(--text-4)]">
                          Menunggu
                        </span>
                      )}
                      {isSuccess && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                          <CheckCircle2 size={10} />
                          <span>Selesai</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] font-bold text-rose-300">
                          <AlertTriangle size={10} />
                          <span>Gagal</span>
                        </span>
                      )}

                      {/* Remove item button */}
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => onRemoveItem?.(item.id)}
                          className="p-1 rounded text-[var(--text-4)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                          title="Hapus dari antrean"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metadata: Workspace & Size */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-4)] pl-5">
                    <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                      <span className="truncate" title={item.targetEmail}>
                        {item.targetEmail || 'Drive'}
                      </span>
                      {item.remainingCount && (
                        <span className="shrink-0 rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-bold text-emerald-300">
                          Resume ({item.remainingCount} part)
                        </span>
                      )}
                    </div>
                    <span>{formatBytes(item.folder?.size || 0)}</span>
                  </div>

                  {/* Active Progress Bar */}
                  {isActive && processState && (
                    <div className="space-y-1 pt-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-[var(--primary)] transition-all duration-300"
                          style={{ width: `${processState.progress || 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-mono text-[var(--text-3)] truncate">
                        {processState.text || 'Sedang mengunggah...'}
                      </p>
                    </div>
                  )}

                  {/* Failed Error Message & Retry Button */}
                  {isFailed && (
                    <div className="flex items-center justify-between rounded-lg bg-rose-500/10 p-2 text-[10px] text-rose-300">
                      <span className="truncate max-w-xs">{item.error || 'Terjadi kesalahan pada item ini'}</span>
                      {onRetryItem && (
                        <button
                          type="button"
                          onClick={() => onRetryItem(item.id)}
                          className="flex items-center gap-1 underline hover:no-underline font-bold shrink-0 ml-2"
                        >
                          <RotateCcw size={10} />
                          <span>Coba Lagi</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
