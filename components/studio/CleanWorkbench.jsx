'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  FolderOpen, Loader2, CheckCircle2, FileArchive, Trash2,
  RefreshCw, Sparkles, Zap, Play, Pause, ExternalLink,
  FolderPlus, Image as ImageIcon, Download, Search, AlertCircle,
  HelpCircle, Eye, Settings, ArrowRight, ShieldCheck, Eraser,
  CloudUpload, ListPlus, ListOrdered, ChevronUp, ChevronDown, X,
  RotateCcw, Clock
} from 'lucide-react'
import { cleanReleaseName } from '@/lib/utils'
import LocalFolderInspectModal from '@/components/files/LocalFolderInspectModal'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function CleanWorkbench({
  folders = [],
  selectedFolder,
  setSelectedFolder,
  stagingPath,
  fetchScan,
  isScanning,
  workspaces = [],
  targetWorkspace,
  setTargetWorkspace,
  uploadMode,
  setUploadMode,
  customCatalogTitle,
  setCustomCatalogTitle,
  existingGames = [],
  selectedGame,
  setSelectedGame,
  processState,
  startProcessing,
  handleProcessControl,
  setWizardFolder,
  setCreateFolderOpen,
  handleChangeStagingPath,
  handleDeleteAll,
  handleCleanParts,
  rarConfig,
  setRarConfig,
  queue = [],
  isQueueRunning = false,
  activeQueueId = null,
  addToQueue,
  removeFromQueue,
  startQueueRunner,
  pauseQueueRunner,
  clearCompletedQueue,
  handleClearAllQueue,
  retryQueueItem,
  retryAllFailed,
}) {
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'iso' | 'raw' | 'archive'
  const [showWebSources, setShowWebSources] = useState(false)
  const [inspectTarget, setInspectTarget] = useState(null) // { folderName, folderPath, type: 'upload' }

  // Queue Drawer State & Computed Metrics
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false)
  const waitingQueueItems = useMemo(() => (queue || []).filter((q) => q.status === 'waiting'), [queue])
  const completedQueueItems = useMemo(() => (queue || []).filter((q) => q.status === 'success'), [queue])
  const failedQueueItems = useMemo(() => (queue || []).filter((q) => q.status === 'error'), [queue])
  const activeQueueItem = useMemo(
    () => (queue || []).find((q) => q.id === activeQueueId || q.status === 'processing'),
    [queue, activeQueueId]
  )

  // Otomatis pilih akun Google Drive pertama jika belum dipilih
  useEffect(() => {
    if (!targetWorkspace && workspaces.length > 0) {
      setTargetWorkspace(workspaces[0])
    }
  }, [targetWorkspace, workspaces, setTargetWorkspace])

  // Filter daftar folder di PC
  const filteredList = useMemo(() => {
    let list = folders || []
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    if (filterType === 'iso') {
      list = list.filter((f) => f.hasIso || f.isInstallerPackage)
    } else if (filterType === 'raw') {
      list = list.filter((f) => !f.hasArchive && !f.hasIso && !f.isInstallerPackage)
    } else if (filterType === 'archive') {
      list = list.filter((f) => f.hasArchive)
    }
    return list
  }, [folders, searchQuery, filterType])

  // Hitung jumlah untuk chip filter
  const counts = useMemo(() => {
    const all = folders.length
    const iso = folders.filter((f) => f.hasIso || f.isInstallerPackage).length
    const raw = folders.filter((f) => !f.hasArchive && !f.hasIso && !f.isInstallerPackage).length
    const archive = folders.filter((f) => f.hasArchive).length
    return { all, iso, raw, archive }
  }, [folders])

  // Buka Game Browser Aman
  const openWeb = (url, title) => {
    setShowWebSources(false)
    if (typeof window !== 'undefined' && window.electronAPI?.openGameBrowser) {
      window.electronAPI.openGameBrowser(url, title)
    } else {
      window.open(url, '_blank')
    }
  }

  const cleanName = selectedFolder ? cleanReleaseName(selectedFolder.name) : ''
  const isProcessing = processState?.status === 'processing'

  return (
    <div className="space-y-4">
      {/* ── TOP UTILITY BAR (BERSIH & TENANG) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
        <div>
          <span className="text-xs font-bold text-white block">Pusat Alur Kerja Game Lokal ke Cloud Drive</span>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">
            Pasang installer ISO, pecah WinRAR part, dan kirim ke Google Drive dalam 1 meja kerja bersih.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap relative">
          {/* Tombol Cari Game di Web (Dropdown) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowWebSources(!showWebSources)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-300 transition-colors cursor-pointer"
            >
              <ExternalLink size={13} />
              <span>Cari Game di Web</span>
            </button>

            {showWebSources && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-white/10 bg-[var(--surface)] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-0.5">
                <button
                  type="button"
                  onClick={() => openWeb('https://www.ovagames.com', 'OvaGames')}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text)] hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>🎮 OvaGames</span>
                  <span className="text-[9px] text-[var(--text-4)]">ElAmigos/GOG</span>
                </button>
                <button
                  type="button"
                  onClick={() => openWeb('https://steamrip.com', 'SteamRIP')}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text)] hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>⚡ SteamRIP</span>
                  <span className="text-[9px] text-[var(--text-4)]">Direct Play</span>
                </button>
                <button
                  type="button"
                  onClick={() => openWeb('https://fitgirl-repacks.site', 'FitGirl')}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text)] hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>📦 FitGirl Repacks</span>
                  <span className="text-[9px] text-[var(--text-4)]">Hemat Kuota</span>
                </button>
                <button
                  type="button"
                  onClick={() => openWeb('https://dodi-repacks.site', 'DODI')}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text)] hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>🚀 DODI Repacks</span>
                  <span className="text-[9px] text-[var(--text-4)]">Installer</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCreateFolderOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-[var(--text-2)] transition-colors cursor-pointer"
            title="Buat folder baru di direktori kerja"
          >
            <FolderPlus size={13} />
            <span>+ Folder</span>
          </button>

          <button
            type="button"
            onClick={() => fetchScan(stagingPath)}
            disabled={isScanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-[var(--text-2)] transition-colors cursor-pointer disabled:opacity-50"
            title="Segarkan daftar folder PC"
          >
            <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {/* ── 2-COLUMN MAIN LAYOUT ── */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 ${queue && queue.length > 0 ? 'pb-24' : ''}`}>
        
        {/* ── KOLOM KIRI: DAFTAR GAME DI PC (5 COLS) ── */}
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[var(--surface)] p-4 space-y-3 shadow-lg flex flex-col h-[380px] sm:h-[450px] lg:h-[calc(100vh-175px)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Daftar Game di PC ({folders.length})
            </span>
            <button
              type="button"
              onClick={handleChangeStagingPath}
              className="text-[10px] font-mono text-[var(--text-4)] hover:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              title="Ganti direktori kerja di PC"
            >
              <FolderOpen size={10} />
              <span className="truncate max-w-[140px]">{stagingPath || 'D:\\Game\\Shopee\\GameUpload'}</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari game di PC..."
              className="w-full rounded-xl border border-white/10 bg-black/40 pl-8 pr-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-white/30 focus:outline-none"
            />
          </div>

          {/* Simple Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterType === 'all' ? 'bg-white/20 text-white' : 'bg-black/30 text-[var(--text-4)] hover:text-white'
              }`}
            >
              Semua ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('iso')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterType === 'iso' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-black/30 text-[var(--text-4)] hover:text-white'
              }`}
            >
              💿 Masih ISO ({counts.iso})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('raw')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterType === 'raw' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-black/30 text-[var(--text-4)] hover:text-white'
              }`}
            >
              📁 Siap RAR ({counts.raw})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('archive')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                filterType === 'archive' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-black/30 text-[var(--text-4)] hover:text-white'
              }`}
            >
              📦 Siap Upload ({counts.archive})
            </button>
          </div>

          {/* Folder List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {isScanning ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--text-4)] space-y-2">
                <Loader2 size={20} className="animate-spin text-amber-400" />
                <span className="text-xs">Memindai folder di PC...</span>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-4)] space-y-1">
                <FileArchive size={24} className="mx-auto opacity-30" />
                <p className="text-xs">Tidak ada game yang cocok</p>
              </div>
            ) : (
              filteredList.map((f) => {
                const isSelected = selectedFolder?.name === f.name
                const hasIso = f.hasIso || f.isInstallerPackage
                const hasArchive = f.hasArchive
                const queuedItem = (queue || []).find(
                  (q) => q.folder?.path === f.path || q.folder?.name === f.name
                )

                return (
                  <div
                    key={f.name}
                    onClick={() => {
                      setSelectedFolder(f)
                      const cleaned = cleanReleaseName(f.name)
                      setCustomCatalogTitle(cleaned)
                      const rawLower = f.name.toLowerCase()
                      const cleanLower = cleaned.toLowerCase()
                      const match = existingGames.find(
                        (g) => g.name.toLowerCase() === rawLower || g.name.toLowerCase() === cleanLower
                      )
                      if (match) {
                        if (setSelectedGame) setSelectedGame(match)
                        setUploadMode('update')
                        const primaryOwner = match.ownerEmail?.split(',')[0]?.trim()
                        const matchedWs = workspaces.find((w) => w.email === primaryOwner)
                        if (matchedWs) setTargetWorkspace(matchedWs)
                      } else {
                        if (setSelectedGame) setSelectedGame(null)
                        setUploadMode('new')
                      }
                    }}
                    className={`group w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-amber-400/50 bg-amber-500/10 shadow-sm'
                        : 'border-transparent bg-black/20 hover:bg-white/5 hover:border-white/5 text-[var(--text-2)]'
                    }`}
                  >
                    <div className="min-w-0 pr-2 space-y-1">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                        {cleanReleaseName(f.name) || f.name}
                      </p>
                      
                      <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
                        {hasIso ? (
                          <span className="text-amber-400 flex items-center gap-1">
                            <span>💿 Masih ISO</span>
                          </span>
                        ) : hasArchive ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <span>📦 {f.archiveParts} Part RAR</span>
                          </span>
                        ) : (
                          <span className="text-blue-400 flex items-center gap-1">
                            <span>📁 Folder Siap RAR</span>
                          </span>
                        )}
                        <span className="text-[var(--text-4)]">•</span>
                        <span className="text-[var(--text-4)]">{f.formattedSize || formatBytes(f.size)}</span>

                        {queuedItem && (
                          <>
                            <span className="text-[var(--text-4)]">•</span>
                            {queuedItem.status === 'processing' ? (
                              <span className="text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold animate-pulse flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" />
                                <span>Sedang Upload</span>
                              </span>
                            ) : queuedItem.status === 'success' ? (
                              <span className="text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                <CheckCircle2 size={10} />
                                <span>✓ Selesai</span>
                              </span>
                            ) : queuedItem.status === 'error' ? (
                              <span className="text-red-400 bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">
                                ✕ Gagal
                              </span>
                            ) : (
                              <span className="text-blue-300 bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                <Clock size={10} />
                                <span>Antrean</span>
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions (Hover) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setInspectTarget({ folderName: f.name, folderPath: f.path, type: 'upload' })
                        }}
                        className="p-1.5 text-[var(--text-4)] hover:text-amber-400 transition-colors cursor-pointer"
                        title="Buka & jelajahi isi berkas folder (RAR, ISO, file)"
                      >
                        <FolderOpen size={12} />
                      </button>
                      {f.hasArchive && handleCleanParts && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCleanParts(f)
                          }}
                          className="p-1.5 text-[var(--text-4)] hover:text-amber-400 transition-colors cursor-pointer"
                          title="Hapus part RAR sementara (hemat disk)"
                        >
                          <Eraser size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteAll(f)
                        }}
                        className="p-1.5 text-[var(--text-4)] hover:text-red-400 transition-colors cursor-pointer"
                        title="Hapus folder game dari disk"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── KOLOM KANAN: MEJA KERJA GAME TERPILIH (7 COLS) ── */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {!selectedFolder ? (
            <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-12 text-center text-[var(--text-4)] space-y-2 h-[calc(100vh-175px)] flex flex-col items-center justify-center">
              <FileArchive size={36} className="mx-auto opacity-20" />
              <p className="text-sm font-bold text-white">Belum Ada Game Dipilih</p>
              <p className="text-xs max-w-sm leading-relaxed">
                Klik salah satu game di kolom sebelah kiri untuk memasang ISO, memecah file WinRAR, upload ke Drive, atau menyalin materi Shopee.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* 1. KARTU HEADER & SATU AKSI UTAMA */}
              <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5 space-y-4 shadow-xl">
                
                {/* Header Game */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-white">{cleanName}</h3>
                    <p className="text-[11px] font-mono text-[var(--text-4)] mt-0.5 truncate max-w-lg">
                      {selectedFolder.path}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setInspectTarget({ folderName: selectedFolder.name, folderPath: selectedFolder.path, type: 'upload' })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-300 transition-colors cursor-pointer shadow-sm"
                      title="Buka & jelajahi berkas di dalam folder ini"
                    >
                      <FolderOpen size={13} />
                      <span>Buka Isi Folder</span>
                    </button>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 shrink-0">
                      {selectedFolder.formattedSize || formatBytes(selectedFolder.size)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar (Jika Ada Proses Berjalan) */}
                {isProcessing && (
                  <div className="rounded-xl border border-amber-500/30 bg-black/40 p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-amber-300 flex items-center gap-1.5 min-w-0">
                        <Loader2 size={14} className="animate-spin shrink-0" />
                        <span className="truncate">{processState.text}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-white">{processState.progress}%</span>
                        {handleProcessControl && (
                          <div className="flex items-center gap-1 ml-2">
                            {processState.status === 'processing' && (
                              <button
                                type="button"
                                onClick={() => handleProcessControl('pause')}
                                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-amber-300 font-bold transition-colors cursor-pointer"
                              >
                                Jeda
                              </button>
                            )}
                            {processState.status === 'paused' && (
                              <button
                                type="button"
                                onClick={() => handleProcessControl('resume')}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] text-emerald-300 font-bold transition-colors cursor-pointer"
                              >
                                Lanjut
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleProcessControl('cancel')}
                              className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-[10px] text-red-400 font-bold transition-colors cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-300"
                        style={{ width: `${processState.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* ── ADAPTIVE ACTION (HANYA 1 TOMBOL SESUAI KONDISI) ── */}
                <div className="pt-2 border-t border-white/10">
                  {/* KONDISI A: MASIH ISO */}
                  {(selectedFolder.hasIso || selectedFolder.isInstallerPackage) ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-amber-300 block">Game Masih Berupa File ISO Mentah</span>
                        <p className="text-[11px] text-[var(--text-3)]">
                          Pasang game ke format siap main (Plug & Play) dan bersihkan ISO secara otomatis.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWizardFolder(selectedFolder.name)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2.5 text-xs font-black text-black hover:brightness-110 shadow-md transition-all cursor-pointer shrink-0"
                      >
                        <Zap size={14} />
                        <span>Pasang Game (1-Klik)</span>
                      </button>
                    </div>
                  ) : selectedFolder.hasArchive ? (
                    /* KONDISI C: PART WINRAR SUDAH JADI -> SIAP UPLOAD */
                    <div className="space-y-3.5 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                          <span>File Arsip Siap ({selectedFolder.archiveParts} Part RAR)</span>
                        </span>
                        {handleCleanParts && (
                          <button
                            type="button"
                            onClick={() => handleCleanParts(selectedFolder)}
                            className="text-[10px] font-mono text-[var(--text-3)] hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Hapus part RAR sementara setelah upload selesai untuk hemat disk"
                          >
                            <Eraser size={11} />
                            <span>Bersihkan Part RAR</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Pilihan Akun Drive */}
                        <div>
                          <label className="text-[10px] font-bold text-[var(--text-4)] block mb-1">
                            Akun Google Drive Tujuan:
                          </label>
                          <select
                            value={targetWorkspace?.email || ''}
                            onChange={(e) => {
                              const ws = workspaces.find((w) => w.email === e.target.value)
                              if (ws) setTargetWorkspace(ws)
                            }}
                            className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none"
                          >
                            {workspaces.map((ws) => (
                              <option key={ws.email} value={ws.email}>
                                {ws.email} (Sisa {Math.max(0, (ws.storage?.limitGB || 1024) - (ws.storage?.usageGB || 0))} GB)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Mode Rilis */}
                        <div>
                          <label className="text-[10px] font-bold text-[var(--text-4)] block mb-1">
                            Jenis Penerbitan:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setUploadMode('new')
                                if (setSelectedGame) setSelectedGame(null)
                              }}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                uploadMode === 'new' ? 'bg-emerald-500 text-black' : 'bg-black/40 text-[var(--text-3)]'
                              }`}
                            >
                              + Game Baru
                            </button>
                            <button
                              type="button"
                              onClick={() => setUploadMode('update')}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                uploadMode === 'update' ? 'bg-amber-500 text-black' : 'bg-black/40 text-[var(--text-3)]'
                              }`}
                            >
                              🔄 Update Versi
                            </button>
                          </div>
                        </div>

                        {/* Judul Baru di Katalog */}
                        {uploadMode === 'new' && (
                          <div className="col-span-1 sm:col-span-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-[var(--text-4)] block">
                                Judul Folder di Google Drive / Etalase:
                              </label>
                              <button
                                type="button"
                                onClick={() => setCustomCatalogTitle(cleanReleaseName(selectedFolder.name))}
                                className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Sparkles size={10} /> Auto-Clean
                              </button>
                            </div>
                            <input
                              type="text"
                              value={customCatalogTitle}
                              onChange={(e) => setCustomCatalogTitle(e.target.value)}
                              placeholder="Nama folder game di Google Drive..."
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            />
                          </div>
                        )}

                        {/* Game Target di Katalog untuk Mode Update */}
                        {uploadMode === 'update' && (
                          <div className="col-span-1 sm:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-amber-300 block">
                              Game Katalog yang Diganti/Diperbarui:
                            </label>
                            <select
                              value={selectedGame?.folderId || ''}
                              onChange={(e) => {
                                const found = existingGames.find((g) => g.folderId === e.target.value)
                                if (found && setSelectedGame) {
                                  setSelectedGame(found)
                                  const primaryOwner = found.ownerEmail?.split(',')[0]?.trim()
                                  const matchedWs = workspaces.find((w) => w.email === primaryOwner)
                                  if (matchedWs) setTargetWorkspace(matchedWs)
                                }
                              }}
                              className="w-full rounded-lg border border-amber-500/30 bg-black/40 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            >
                              <option value="">-- Pilih Game dari Katalog Drive --</option>
                              {existingGames.map((g) => (
                                <option key={g.folderId} value={g.folderId}>
                                  {g.name} ({g.ownerEmail || 'Drive'})
                                </option>
                              ))}
                            </select>
                            {selectedGame && (
                              <p className="text-[10px] text-amber-400/90 font-mono">
                                ✓ Link pembeli lama tidak berubah & otomatis sinkron ke file baru ini.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => startProcessing('upload')}
                          disabled={isProcessing || (uploadMode === 'update' && !selectedGame)}
                          className="flex-1 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2.5 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <CloudUpload size={14} />
                          <span>Upload ke Drive Sekarang</span>
                        </button>

                        {addToQueue && (
                          <button
                            type="button"
                            onClick={addToQueue}
                            disabled={isProcessing || (uploadMode === 'update' && !selectedGame)}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                            title="Masukkan game ini ke antrean upload otomatis berurutan"
                          >
                            <ListPlus size={14} />
                            <span>+ Masukkan Antrean</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* KONDISI B: FOLDER SIAP -> PERLU PECAH WINRAR */
                    <div className="space-y-3 p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-300">
                          Game Terpasang Bersih (Belum Dipecah Part)
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-[var(--text-4)]">Ukuran Part:</label>
                          <select
                            value={rarConfig.splitSize}
                            onChange={(e) => setRarConfig((prev) => ({ ...prev, splitSize: Number(e.target.value) }))}
                            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs font-mono text-white focus:outline-none"
                          >
                            <option value={500}>500 MB (Rekomendasi Shopee)</option>
                            <option value={1000}>1 GB</option>
                            <option value={2000}>2 GB</option>
                            <option value={4100}>4.1 GB (DVD)</option>
                            <option value={0}>Tanpa Part (1 File Utuh)</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => startProcessing('archive')}
                        disabled={isProcessing}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-xs font-black text-white hover:brightness-110 shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <FileArchive size={14} />
                        <span>Pecah Menjadi Part WinRAR</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}
        </div>

      </div>

      {/* ── FLOATING SEQUENTIAL QUEUE DRAWER (HANYA MUNCUL JIKA ADA ANTREAN) ── */}
      {queue && queue.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 md:left-64 md:right-8 z-40 space-y-2 pointer-events-none">
          {/* Expanded Queue Drawer */}
          {isQueueDrawerOpen && (
            <div className="pointer-events-auto bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-4 max-h-[380px] overflow-y-auto space-y-3 animate-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <ListOrdered size={16} className="text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Daftar Antrean Sekuensial ({queue.length} Game)
                  </span>
                  <span className="text-[10px] text-[var(--text-4)]">
                    • Diproses satu per satu otomatis
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {completedQueueItems.length > 0 && clearCompletedQueue && (
                    <button
                      type="button"
                      onClick={clearCompletedQueue}
                      className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                    >
                      Bersihkan Selesai ({completedQueueItems.length})
                    </button>
                  )}
                  {failedQueueItems.length > 0 && retryAllFailed && (
                    <button
                      type="button"
                      onClick={retryAllFailed}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw size={10} /> Coba Ulang Gagal ({failedQueueItems.length})
                    </button>
                  )}
                  {handleClearAllQueue && (
                    <button
                      type="button"
                      onClick={handleClearAllQueue}
                      className="text-[10px] font-bold text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                    >
                      Kosongkan Semua
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsQueueDrawerOpen(false)}
                    className="p-1 rounded-lg text-[var(--text-4)] hover:text-white hover:bg-white/10 cursor-pointer ml-1"
                    title="Tutup daftar"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {queue.map((item, idx) => {
                  const isItemActive = activeQueueItem?.id === item.id
                  return (
                    <div
                      key={item.id || idx}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                        isItemActive
                          ? 'border-amber-400/50 bg-amber-500/10'
                          : item.status === 'success'
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : item.status === 'error'
                          ? 'border-red-500/20 bg-red-500/5'
                          : 'border-white/5 bg-black/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <span className="text-[10px] font-mono font-bold text-[var(--text-4)] shrink-0 w-5">
                          #{idx + 1}
                        </span>
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-bold text-white truncate max-w-sm">
                            {item.customTitle || item.folder?.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-[var(--text-4)] font-mono">
                            <span>{item.workspace?.email || 'Drive'}</span>
                            <span>•</span>
                            <span>{item.mode === 'update' ? 'Update Versi' : 'Game Baru'}</span>
                            {item.folder?.formattedSize && (
                              <>
                                <span>•</span>
                                <span>{item.folder.formattedSize}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Status Label */}
                        {item.status === 'processing' || isItemActive ? (
                          <div className="flex items-center gap-2 text-amber-300 font-bold text-[11px]">
                            <Loader2 size={13} className="animate-spin" />
                            <span>{item.progress || processState.progress || 0}% Upload</span>
                          </div>
                        ) : item.status === 'success' ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                            <CheckCircle2 size={13} />
                            <span>Selesai</span>
                          </span>
                        ) : item.status === 'error' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 font-bold text-[11px] truncate max-w-[140px]" title={item.text}>
                              Gagal
                            </span>
                            {retryQueueItem && (
                              <button
                                type="button"
                                onClick={() => retryQueueItem(item.id)}
                                className="p-1 rounded bg-white/10 hover:bg-white/20 text-amber-300 text-[10px] cursor-pointer"
                                title="Coba ulang item ini"
                              >
                                <RotateCcw size={11} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-[var(--text-4)] text-[11px]">
                            <Clock size={12} />
                            <span>Menunggu</span>
                          </span>
                        )}

                        {/* Remove button (if not processing) */}
                        {!isItemActive && removeFromQueue && (
                          <button
                            type="button"
                            onClick={() => removeFromQueue(item.id)}
                            className="p-1.5 rounded-lg text-[var(--text-4)] hover:text-red-400 hover:bg-white/5 cursor-pointer transition-colors"
                            title="Hapus dari antrean"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Slim Floating Bar */}
          <div className="pointer-events-auto bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-xl border shrink-0 ${
                isQueueRunning
                  ? 'border-amber-400/40 bg-amber-500/10 text-amber-400 animate-pulse'
                  : 'border-white/10 bg-white/5 text-[var(--text-3)]'
              }`}>
                <ListOrdered size={16} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    Antrean: {queue.length} Game
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-4)]">
                    ({waitingQueueItems.length} Menunggu • {completedQueueItems.length} Selesai{failedQueueItems.length > 0 ? ` • ${failedQueueItems.length} Gagal` : ''})
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-3)] truncate mt-0.5">
                  {isQueueRunning && activeQueueItem ? (
                    <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin inline shrink-0" />
                      <span>Sedang Upload: {activeQueueItem.customTitle || activeQueueItem.folder?.name} ({activeQueueItem.progress || processState.progress || 0}%)</span>
                    </span>
                  ) : waitingQueueItems.length > 0 ? (
                    <span>Siap dijalankan berurutan (bisa ditinggal tidur/aktivitas lain)</span>
                  ) : (
                    <span>Semua game dalam antrean telah selesai diproses.</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsQueueDrawerOpen(!isQueueDrawerOpen)}
                className="px-2.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-[var(--text-2)] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>{isQueueDrawerOpen ? 'Tutup Daftar' : 'Lihat Daftar'}</span>
                {isQueueDrawerOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              </button>

              {isQueueRunning ? (
                <button
                  type="button"
                  onClick={pauseQueueRunner}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Pause size={13} />
                  <span>Jeda Antrean</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startQueueRunner}
                  disabled={waitingQueueItems.length === 0}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-black text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={13} />
                  <span>Jalankan Antrean</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📂 Inspeksi Isi Folder Lokal (Multi-Part RAR, ISO, dsb.) */}
      <LocalFolderInspectModal
        isOpen={!!inspectTarget}
        folderName={inspectTarget?.folderName}
        folderPath={inspectTarget?.folderPath}
        type={inspectTarget?.type || 'upload'}
        onClose={() => setInspectTarget(null)}
        onLaunchWizard={(folderName) => {
          if (setWizardFolder) setWizardFolder(folderName)
        }}
      />
    </div>
  )
}
