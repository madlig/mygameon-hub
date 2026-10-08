'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  X, Folder, FolderOpen, FileArchive, Disc, Play, CheckCircle2,
  AlertTriangle, Loader2, HardDrive, Search, Copy, Check,
  ExternalLink, Zap, Package, RefreshCw, FileText, FileCode,
  ShieldCheck, ArrowRight, Layers
} from 'lucide-react'

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export default function LocalFolderInspectModal({
  isOpen,
  onClose,
  folderPath,
  folderName,
  type = 'download', // 'download' | 'upload'
  onLaunchWizard,
  onHandoff
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all') // 'all' | 'rar_part' | 'iso' | 'executable' | 'subfolder'
  const [copied, setCopied] = useState(false)
  const [openingExplorer, setOpeningExplorer] = useState(false)

  // 1. Fetch data isi folder
  const fetchFolderContent = async () => {
    if (!isOpen || (!folderPath && !folderName)) return
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (folderPath) params.set('path', folderPath)
      if (folderName) params.set('folderName', folderName)
      if (type) params.set('type', type)

      const res = await fetch(`/api/system/inspect-folder?${params.toString()}`)
      const json = await res.json()

      if (json.success) {
        setData(json)
      } else {
        setError(json.error || 'Gagal memindai folder lokal')
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan jaringan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setData(null)
      setSearchQuery('')
      setFilterCategory('all')
      fetchFolderContent()
    }
  }, [isOpen, folderPath, folderName, type])

  // Salin path ke clipboard
  const handleCopyPath = () => {
    const p = data?.folder?.path || folderPath
    if (!p) return
    navigator.clipboard.writeText(p)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Buka di Windows Explorer (via backend API)
  const handleOpenExplorer = async () => {
    const p = data?.folder?.path || folderPath
    setOpeningExplorer(true)
    try {
      await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_folder', targetPath: p })
      })
    } catch (_) {} finally {
      setTimeout(() => setOpeningExplorer(false), 1000)
    }
  }

  // Filter daftar file berdasarkan search & category
  const filteredFiles = useMemo(() => {
    if (!data?.files) return []
    let list = data.files

    if (filterCategory === 'rar_part') {
      list = list.filter((f) => f.category === 'rar_part')
    } else if (filterCategory === 'iso') {
      list = list.filter((f) => f.category === 'iso')
    } else if (filterCategory === 'executable') {
      list = list.filter((f) => f.category === 'executable' || f.category === 'setup')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.relPath.toLowerCase().includes(q))
    }

    return list
  }, [data?.files, filterCategory, searchQuery])

  // Hitung jumlah file per filter
  const filterCounts = useMemo(() => {
    if (!data?.files) return { all: 0, rar_part: 0, iso: 0, executable: 0, subfolders: 0 }
    return {
      all: data.files.length,
      rar_part: data.files.filter((f) => f.category === 'rar_part').length,
      iso: data.files.filter((f) => f.category === 'iso').length,
      executable: data.files.filter((f) => f.category === 'executable' || f.category === 'setup').length,
      subfolders: data.subfolders?.length || 0
    }
  }, [data])

  if (!isOpen) return null

  const summary = data?.packageSummary
  const rarStats = summary?.rarStats
  const folder = data?.folder

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl border border-[var(--border-strong)] bg-[#0d0e12] shadow-2xl overflow-hidden">
        
        {/* ── HEADER MODAL ── */}
        <div className="flex items-center justify-between border-b border-white/5 bg-[#08090c] px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {summary?.hasIso ? (
                <Disc size={20} className="text-cyan-400" />
              ) : summary?.hasRarParts ? (
                <FileArchive size={20} className="text-amber-400" />
              ) : (
                <FolderOpen size={20} className="text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm sm:text-base font-black text-white" title={folder?.name || folderName}>
                  {folder?.name || folderName || 'Inspeksi Folder'}
                </h2>
                {summary && (
                  <span className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold border ${
                    summary.packageType === 'ISO'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : summary.packageType === 'MULTI_PART_RAR'
                      ? rarStats?.isSequential
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  }`}>
                    {summary.badgeText}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-4)] mt-0.5">
                <span className="truncate max-w-[200px] sm:max-w-md">{folder?.path || folderPath}</span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="hover:text-amber-300 transition-colors cursor-pointer shrink-0"
                  title="Salin path folder"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchFolderContent}
              disabled={loading}
              className="p-2 text-[var(--text-4)] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="Segarkan data isi folder"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[var(--text-3)] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── BODY MODAL ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-3)] space-y-3">
              <Loader2 size={32} className="animate-spin text-amber-400" />
              <p className="text-xs font-semibold text-white">Membuka & membaca seluruh berkas folder...</p>
              <p className="text-[10px] text-[var(--text-4)]">Mendeteksi part WinRAR, file ISO, dan integritas urutan paket</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle size={24} />
              </div>
              <p className="text-sm font-bold text-white">Gagal Membuka Folder</p>
              <p className="text-xs text-rose-400 max-w-md font-mono bg-rose-500/5 p-2.5 rounded-xl border border-rose-500/20">
                {error}
              </p>
            </div>
          ) : data ? (
            <>
              {/* ── BANNER STATUS PAKET ── */}
              {summary?.hasIso && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/30 to-blue-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <Disc size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                        Format Disc Image (.ISO) Terdeteksi ({summary.isoFiles?.length} Berkas)
                      </h4>
                      <p className="text-[11px] text-[var(--text-2)] mt-0.5">
                        File ISO siap dimount dan diinstal menjadi game Plug & Play (Pre-Installed) yang siap diunggah.
                      </p>
                    </div>
                  </div>
                  {onLaunchWizard && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onLaunchWizard(folder?.name || folderName)
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-3.5 py-2 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer shrink-0"
                    >
                      <Play size={12} />
                      <span>💿 Pasang ISO (Wizard)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Status RAR Parts Banner */}
              {summary?.hasRarParts && (
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 ${
                  rarStats?.isSequential
                    ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-950/20 text-amber-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      rarStats?.isSequential
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}>
                      {rarStats?.isSequential ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        {rarStats?.isSequential
                          ? `Part File WinRAR Lengkap (${rarStats?.partsCount} Part)`
                          : `Perhatian: Urutan Part RAR Belum Lengkap!`}
                      </h4>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        {rarStats?.isSequential
                          ? `Total ${rarStats?.partsCount} part (${rarStats?.totalRarSizeFormatted}) berurutan sempurna tanpa part yang terputus.`
                          : `Part yang hilang/belum selesai: Part ${rarStats?.missingParts?.join(', ')}`}
                      </p>
                    </div>
                  </div>
                  {rarStats?.activeDownloadingParts > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-300 shrink-0">
                      <Loader2 size={11} className="animate-spin" />
                      <span>{rarStats.activeDownloadingParts} part sedang didownload</span>
                    </span>
                  )}
                </div>
              )}

              {/* ── STATS CARDS BAR ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Kapasitas Total</span>
                  <p className="text-sm font-black text-amber-400 mt-0.5">{folder?.totalSizeFormatted}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Jumlah File</span>
                  <p className="text-sm font-black text-white mt-0.5">{folder?.totalFileCount} Berkas</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Subfolder</span>
                  <p className="text-sm font-black text-white mt-0.5">{folder?.subfoldersCount} Folder</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Format Paket</span>
                  <p className="text-sm font-black text-emerald-400 mt-0.5 truncate">{summary?.packageType}</p>
                </div>
              </div>

              {/* ── SEARCH & FILTER CONTROLS ── */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama berkas di dalam folder..."
                      className="w-full rounded-xl border border-white/10 bg-black/50 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[var(--text-4)] focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  {/* Filter category pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setFilterCategory('all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                        filterCategory === 'all'
                          ? 'bg-white/20 text-white font-bold'
                          : 'bg-black/30 text-[var(--text-4)] hover:text-white'
                      }`}
                    >
                      Semua ({filterCounts.all})
                    </button>
                    {filterCounts.rar_part > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterCategory('rar_part')}
                        className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                          filterCategory === 'rar_part'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-black/30 text-[var(--text-4)] hover:text-white'
                        }`}
                      >
                        📦 Part RAR ({filterCounts.rar_part})
                      </button>
                    )}
                    {filterCounts.iso > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterCategory('iso')}
                        className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                          filterCategory === 'iso'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-black/30 text-[var(--text-4)] hover:text-white'
                        }`}
                      >
                        💿 File ISO ({filterCounts.iso})
                      </button>
                    )}
                    {filterCounts.executable > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterCategory('executable')}
                        className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                          filterCategory === 'executable'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-black/30 text-[var(--text-4)] hover:text-white'
                        }`}
                      >
                        ⚡ Exe / Setup ({filterCounts.executable})
                      </button>
                    )}
                  </div>
                </div>

                {/* ── FILE LIST TABLE ── */}
                <div className="rounded-xl border border-white/5 bg-black/40 overflow-hidden">
                  <div className="max-h-[300px] sm:max-h-[360px] overflow-y-auto divide-y divide-white/5 scrollbar-thin">
                    {filteredFiles.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[var(--text-4)] space-y-1">
                        <FileText size={20} className="mx-auto opacity-30" />
                        <p>Tidak ada berkas yang sesuai filter</p>
                      </div>
                    ) : (
                      filteredFiles.map((file, idx) => {
                        const isPart = file.category === 'rar_part'
                        const isIso = file.category === 'iso'
                        const isSetup = file.category === 'setup'
                        const isExe = file.category === 'executable'
                        const isJunk = file.category === 'junk'

                        return (
                          <div
                            key={file.relPath || idx}
                            className="flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.03] transition-colors gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {/* File Type Icon */}
                              <div className="shrink-0">
                                {isIso ? (
                                  <Disc size={15} className="text-cyan-400" />
                                ) : isPart ? (
                                  <FileArchive size={15} className="text-amber-400" />
                                ) : isSetup || isExe ? (
                                  <FileCode size={15} className="text-emerald-400" />
                                ) : isJunk ? (
                                  <FileText size={15} className="text-rose-400/60" />
                                ) : (
                                  <FileText size={15} className="text-[var(--text-4)]" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <span className={`font-mono block truncate ${
                                  isIso
                                    ? 'text-cyan-300 font-bold'
                                    : isPart
                                    ? 'text-amber-200'
                                    : isSetup
                                    ? 'text-emerald-300 font-bold'
                                    : isJunk
                                    ? 'text-[var(--text-4)] line-through'
                                    : 'text-[var(--text-2)]'
                                }`} title={file.relPath}>
                                  {file.name}
                                </span>
                                {file.relPath !== file.name && (
                                  <span className="text-[9px] font-mono text-[var(--text-4)] block truncate">
                                    📁 {file.relPath}
                                  </span>
                                )}
                              </div>

                              {/* Badges */}
                              {isPart && file.partNumber !== null && (
                                <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-mono font-bold text-amber-300 shrink-0">
                                  Part {file.partNumber}
                                  {file.isDownloading && ' (Unduh...)'}
                                </span>
                              )}
                              {isIso && (
                                <span className="rounded bg-cyan-500/20 border border-cyan-500/30 px-1.5 py-0.2 text-[9px] font-mono font-bold text-cyan-300 shrink-0">
                                  ISO DISC
                                </span>
                              )}
                              {isSetup && (
                                <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-mono font-bold text-emerald-300 shrink-0">
                                  SETUP
                                </span>
                              )}
                            </div>

                            {/* File Size */}
                            <span className="text-[11px] font-mono font-bold text-[var(--text-3)] shrink-0 ml-2">
                              {file.sizeFormatted}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {data.isTruncated && (
                  <p className="text-[10px] text-center text-[var(--text-4)] italic">
                    Menampilkan 500 berkas pertama. Total {folder?.totalFileCount} berkas ada di dalam folder.
                  </p>
                )}
              </div>

              {/* Subfolder preview if any */}
              {data.subfolders?.length > 0 && filterCategory === 'all' && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block">
                    Subfolder di dalam direktori ({data.subfolders.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.subfolders.map((sf) => (
                      <span
                        key={sf.relPath}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-black/30 px-2.5 py-1 text-[11px] font-mono text-[var(--text-3)]"
                      >
                        <Folder size={12} className="text-amber-400/80" />
                        <span>{sf.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-white/5 bg-[#08090c] px-4 sm:px-6 py-3 gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenExplorer}
              disabled={openingExplorer}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Buka langsung di Windows Explorer PC"
            >
              {openingExplorer ? <Loader2 size={13} className="animate-spin" /> : <FolderOpen size={13} className="text-amber-400" />}
              <span>Buka di Explorer PC</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            {summary?.hasIso && onLaunchWizard ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onLaunchWizard(folder?.name || folderName)
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Play size={13} />
                <span>💿 Pasang Game ke Studio</span>
              </button>
            ) : onHandoff ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onHandoff(folder?.name || folderName)
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Zap size={13} />
                <span>🚀 Oper ke Upload Studio</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-[var(--text-3)] hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-center"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
