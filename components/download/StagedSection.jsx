'use client'

import { useState } from 'react'
import { Package, Play, Trash2, ChevronDown, ChevronRight, Loader2, FileArchive } from 'lucide-react'

export default function StagedSection({
  stagedPackages = [],
  onStartPackage,
  onRemovePackage,
  onRemoveItem,
  onStartItem,
  onStartAll,
  isStartingAll = false,
  actionLoading = {} // { [keyOrId]: 'start' | 'remove' }
}) {
  // Default terbuka (true) agar daftar part/link langsung terlihat & bisa dipilih/dihapus sebelum mulai download
  const [collapsedKeys, setCollapsedKeys] = useState({})

  if (!stagedPackages || stagedPackages.length === 0) return null

  function toggleExpand(key) {
    setCollapsedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
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
              Tangkapan Baru Ditampung / Link Grabber ({stagedPackages.length} Paket)
            </h3>
            <p className="text-[10px] text-teal-300/80">
              Anda dapat menghapus link/part tertentu di bawah sebelum menekan &quot;Mulai Unduh&quot;.
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

      <div className="space-y-2.5">
        {stagedPackages.map((pkg) => {
          const isExpanded = !collapsedKeys[pkg.key]
          const isStarting = actionLoading[pkg.key] === 'start'
          const isRemoving = actionLoading[pkg.key] === 'remove'

          return (
            <div
              key={pkg.key}
              className="rounded-xl border border-white/10 bg-black/50 p-3 flex flex-col gap-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(pkg.key)}
                    className="text-zinc-400 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                    title={isExpanded ? 'Sembunyikan daftar part' : 'Tampilkan daftar part'}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <div className="truncate">
                    <span className="font-bold text-xs text-white block truncate">
                      {pkg.packageName}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {pkg.partsCount} File/Part
                      {pkg.totalBytesFormatted ? (
                        <>
                          {' '}• Total: <strong className="text-teal-300">{pkg.totalBytesFormatted}</strong>
                        </>
                      ) : null}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onStartPackage(pkg.key)}
                    disabled={isStarting || isRemoving}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-400 text-black px-3 py-1.5 text-[11px] font-black hover:brightness-110 cursor-pointer disabled:opacity-50"
                  >
                    {isStarting ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                    <span>Mulai Unduh Paket</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemovePackage(pkg.key)}
                    disabled={isRemoving || isStarting}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 cursor-pointer disabled:opacity-50"
                    title="Hapus seluruh paket dari penampungan"
                  >
                    {isRemoving ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    <span>Hapus Paket</span>
                  </button>
                </div>
              </div>

              {isExpanded && pkg.items && pkg.items.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-1.5 font-mono text-[11px]">
                  {pkg.items.map((it, i) => {
                    const itemLoading = actionLoading[it.id]
                    let hostLabel = ''
                    try {
                      if (it.url) hostLabel = new URL(it.url).hostname.replace(/^www\./, '')
                    } catch (_) {}

                    return (
                      <div
                        key={it.id || i}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5 hover:border-white/15 transition-colors"
                      >
                        <div className="min-w-0 flex items-center gap-2 truncate">
                          <FileArchive size={12} className="text-teal-400 shrink-0" />
                          <span className="text-zinc-500 shrink-0">#{i + 1}</span>
                          <span className="text-zinc-200 truncate" title={it.filename || it.cleanTitle}>
                            {it.filename || it.cleanTitle}
                          </span>
                          {hostLabel && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5 shrink-0">
                              {hostLabel}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {it.totalBytes > 0 && (
                            <span className="text-zinc-400 text-[10px]">{it.totalBytesFormatted}</span>
                          )}

                          {onStartItem && pkg.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onStartItem(it.id)}
                              disabled={Boolean(itemLoading)}
                              className="inline-flex items-center gap-1 rounded-md bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 px-2 py-0.5 text-[10px] font-bold text-teal-300 cursor-pointer disabled:opacity-50"
                              title="Unduh file/part ini saja"
                            >
                              {itemLoading === 'start' ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                              <span>Unduh</span>
                            </button>
                          )}

                          {onRemoveItem && (
                            <button
                              type="button"
                              onClick={() => onRemoveItem(it.id, it.filename || it.cleanTitle)}
                              disabled={Boolean(itemLoading)}
                              className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300 cursor-pointer disabled:opacity-50"
                              title="Hapus file/part ini dari penampungan sebelum download"
                            >
                              {itemLoading === 'remove' ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                              <span>Hapus</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

