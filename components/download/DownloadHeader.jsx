'use client'

import { HardDrive, Plus, RefreshCw, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react'

export default function DownloadHeader({
  targetDir,
  diskSpace,
  cnlStatus,
  totalSpeedFormatted,
  activeCount = 0,
  stagedCount = 0,
  readyCount = 0,
  refreshing = false,
  onRefresh,
  onOpenAddModal,
  onOpenTargetFolder,
  onTakeoverPort,
  isTakingOver = false,
  onOpenGameSource
}) {
  return (
    <div className="space-y-4">
      {/* ── Top Header Strip ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase flex items-center gap-2">
              <span>Download Hub</span>
            </h1>
            <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Pipeline Otomatis
            </span>
          </div>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Unduh game berkecepatan tinggi, ekstrak multi-part UnRAR, dan pasang silent ke Pre-Installed siap kirim.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {totalSpeedFormatted && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-300">
                {totalSpeedFormatted}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-3.5 py-2 text-xs font-black text-black hover:brightness-110 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>+ Tambah Tautan</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Segarkan data unduhan"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── System Status & Quick Bar Strip ── */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        {/* Left: Disk D: Indicator & Port Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Disk D: Space */}
          {diskSpace && (
            <div className="flex items-center gap-2.5 font-mono text-[11px] bg-black/50 border border-white/10 px-3 py-1.5 rounded-xl">
              <HardDrive size={13} className="text-cyan-400 shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--text-4)]">Disk D:</span>
                <span className="text-cyan-300 font-bold">{diskSpace.freeFormatted} Sisa</span>
                <span className="text-zinc-500">/ {diskSpace.totalFormatted}</span>
              </div>
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    diskSpace.usedPercent > 90
                      ? 'bg-rose-500'
                      : diskSpace.usedPercent > 75
                      ? 'bg-amber-400'
                      : 'bg-cyan-400'
                  }`}
                  style={{ width: `${diskSpace.usedPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Click'n'Load Port Status */}
          {cnlStatus?.running ? (
            <div className="flex items-center gap-1.5 font-mono text-[11px] bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>CNL Port 9666 Siap</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-mono text-[11px] bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>CNL 9666 Terpakai</span>
              <button
                type="button"
                onClick={onTakeoverPort}
                disabled={isTakingOver}
                className="bg-amber-400 text-black px-2 py-0.5 rounded text-[10px] font-bold hover:brightness-110 cursor-pointer disabled:opacity-50"
              >
                Ambil Alih
              </button>
            </div>
          )}

          {/* Folder Target Button */}
          {targetDir && (
            <button
              type="button"
              onClick={() => onOpenTargetFolder(targetDir)}
              className="text-[11px] font-mono text-[var(--text-4)] hover:text-white hover:underline cursor-pointer"
              title="Buka folder unduhan di Windows Explorer"
            >
              Buka Folder Download
            </button>
          )}
        </div>

        {/* Right: Quick Source Site Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono uppercase text-[var(--text-4)] mr-1">Sumber Game:</span>
          <a
            href="https://www.ovagames.com"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => onOpenGameSource(e, 'https://www.ovagames.com', 'OvaGames')}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[var(--text-2)] hover:text-amber-300 hover:border-amber-400/40 transition-all cursor-pointer"
          >
            <span>🎮 OvaGames</span>
            <ExternalLink size={10} className="opacity-50" />
          </a>
          <a
            href="https://steamrip.com"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => onOpenGameSource(e, 'https://steamrip.com', 'SteamRIP')}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[var(--text-2)] hover:text-blue-300 hover:border-blue-400/40 transition-all cursor-pointer"
          >
            <span>⚡ SteamRIP</span>
            <ExternalLink size={10} className="opacity-50" />
          </a>
          <a
            href="https://fitgirl-repacks.site"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => onOpenGameSource(e, 'https://fitgirl-repacks.site', 'FitGirl Repacks')}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[var(--text-2)] hover:text-purple-300 hover:border-purple-400/40 transition-all cursor-pointer"
          >
            <span>📦 FitGirl</span>
            <ExternalLink size={10} className="opacity-50" />
          </a>
          <a
            href="https://dodi-repacks.site"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => onOpenGameSource(e, 'https://dodi-repacks.site', 'DODI Repacks')}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[var(--text-2)] hover:text-pink-300 hover:border-pink-400/40 transition-all cursor-pointer"
          >
            <span>🚀 DODI</span>
            <ExternalLink size={10} className="opacity-50" />
          </a>
        </div>
      </div>
    </div>
  )
}
