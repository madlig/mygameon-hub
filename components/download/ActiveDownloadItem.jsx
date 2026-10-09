'use client'

import { useState } from 'react'
import { DownloadCloud, Pause, Play, Square, ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react'

export default function ActiveDownloadItem({
  group,
  isExpanded = false,
  onToggleExpand,
  onPause,
  onResume,
  onCancel,
  actionLoading = null // 'pause' | 'resume' | 'cancel' | null
}) {
  const isDownloading = group.status === 'downloading'
  const isPaused = group.status === 'paused'
  const isQueued = group.status === 'queued'
  const isError = group.status === 'error'

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 transition-all shadow-md space-y-3">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0 flex items-center gap-2">
          {group.isPackage && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
              title={isExpanded ? 'Tutup daftar part' : 'Lihat rincian part'}
            >
              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-white truncate max-w-sm sm:max-w-md">
                {group.cleanTitle || group.packageName}
              </h4>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                isDownloading
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                  : isPaused
                  ? 'bg-zinc-700/30 text-zinc-300 border-white/10'
                  : isQueued
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}>
                {group.statusText}
              </span>
              {group.isPackage && (
                <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  {group.partsCount} Part
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isDownloading ? (
            <button
              type="button"
              onClick={onPause}
              disabled={actionLoading === 'pause'}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 transition-all cursor-pointer disabled:opacity-50"
              title="Jeda unduhan ini"
            >
              {actionLoading === 'pause' ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />}
              <span>Jeda</span>
            </button>
          ) : isPaused ? (
            <button
              type="button"
              onClick={onResume}
              disabled={actionLoading === 'resume'}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 text-black hover:brightness-110 px-3 py-1.5 text-xs font-black transition-all cursor-pointer disabled:opacity-50"
              title="Lanjutkan unduhan ini"
            >
              {actionLoading === 'resume' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              <span>Lanjut</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onCancel}
            disabled={actionLoading === 'cancel'}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 text-xs font-bold text-rose-300 transition-all cursor-pointer disabled:opacity-50"
            title="Batalkan dan hapus dari antrean"
          >
            {actionLoading === 'cancel' ? <Loader2 size={12} className="animate-spin" /> : <Square size={11} />}
            <span>Batal</span>
          </button>
        </div>
      </div>

      {/* Progress Bar & Metrics */}
      <div className="space-y-1.5">
        <div className="w-full h-2 rounded-full bg-black/60 border border-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isDownloading
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                : isPaused
                ? 'bg-zinc-600'
                : 'bg-blue-400'
            }`}
            style={{ width: `${Math.max(group.progressPercent || 0, 1)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-4)]">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">{group.progressPercent || 0}%</span>
            <span>•</span>
            <span>{group.downloadedBytesFormatted || '0 B'} / {group.totalBytesFormatted || '0 B'}</span>
          </div>

          <div className="flex items-center gap-3">
            {group.downloadSpeedFormatted && (
              <span className="text-emerald-300 font-bold">{group.downloadSpeedFormatted}</span>
            )}
            {group.etaFormatted && (
              <span className="text-zinc-400">{group.etaFormatted}</span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Parts List */}
      {isExpanded && group.items && group.items.length > 0 && (
        <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs">
          {group.items.map((sub, idx) => (
            <div
              key={sub.id || idx}
              className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5 font-mono text-[11px]"
            >
              <div className="truncate max-w-xs sm:max-w-md text-zinc-300">
                <span className="text-zinc-500 mr-2">Part {idx + 1}</span>
                {sub.folderName || sub.cleanTitle}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-zinc-400">{sub.totalSizeFormatted}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  sub.status === 'downloading'
                    ? 'text-amber-300 bg-amber-500/10 font-bold'
                    : sub.status === 'completed'
                    ? 'text-emerald-300 bg-emerald-500/10'
                    : 'text-zinc-400'
                }`}>
                  {sub.statusText || sub.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
