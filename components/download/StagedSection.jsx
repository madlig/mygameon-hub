'use client'

import { useState } from 'react'
import { Package, Play, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

export default function StagedSection({
  stagedPackages = [],
  onStartPackage,
  onRemovePackage,
  onStartAll,
  isStartingAll = false,
  actionLoading = {} // { [key]: 'start' | 'remove' }
}) {
  const [expandedKeys, setExpandedKeys] = useState({})

  if (!stagedPackages || stagedPackages.length === 0) return null

  function toggleExpand(key) {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="rounded-2xl border border-teal-500/30 bg-teal-950/20 p-4 space-y-3 shadow-md animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-teal-500/20">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
            <Package size={15} />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Tangkapan Baru Ditampung ({stagedPackages.length} Paket)
            </h3>
            <p className="text-[10px] text-teal-300/80">
              Paket link dari browser siap diunduh. Tekan &quot;Mulai Unduh&quot; untuk memasukkan ke antrean.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartAll}
          disabled={isStartingAll}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 px-3.5 py-1.5 text-xs font-black text-black hover:brightness-110 shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isStartingAll ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          <span>Mulai Semua Paket</span>
        </button>
      </div>

      <div className="space-y-2">
        {stagedPackages.map((pkg) => {
          const isExpanded = !!expandedKeys[pkg.key]
          const isStarting = actionLoading[pkg.key] === 'start'
          const isRemoving = actionLoading[pkg.key] === 'remove'

          return (
            <div
              key={pkg.key}
              className="rounded-xl border border-white/5 bg-black/40 p-3 flex flex-col gap-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(pkg.key)}
                    className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <div className="truncate">
                    <span className="font-bold text-xs text-white block truncate">
                      {pkg.packageName}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {pkg.partsCount} Bagian • Total: <strong className="text-teal-300">{pkg.totalBytesFormatted || 'Menghitung...'}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onStartPackage(pkg.key)}
                    disabled={isStarting}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-400 text-black px-2.5 py-1 text-[11px] font-black hover:brightness-110 cursor-pointer disabled:opacity-50"
                  >
                    {isStarting ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                    <span>Mulai Unduh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemovePackage(pkg.key)}
                    disabled={isRemoving}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 text-[11px] font-bold text-rose-300 cursor-pointer disabled:opacity-50"
                  >
                    {isRemoving ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  </button>
                </div>
              </div>

              {isExpanded && pkg.items && (
                <div className="pt-2 border-t border-white/5 space-y-1 font-mono text-[10px] text-zinc-400 pl-6">
                  {pkg.items.map((it, i) => (
                    <div key={it.id || i} className="flex justify-between truncate">
                      <span className="truncate">{it.filename || it.cleanTitle}</span>
                      <span className="shrink-0 ml-2">{it.totalBytesFormatted || '-'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
