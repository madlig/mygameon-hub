'use client'

import { useState, useMemo } from 'react'
import {
  Folder, FolderOpen, Search, HardDrive, FileArchive, Disc,
  Sparkles, AlertTriangle, Layers, Trash2, Pencil, CheckCircle2,
  RefreshCw, PanelLeftClose
} from 'lucide-react'
import { cleanReleaseName, formatBytes } from '@/lib/utils'

export default function StagingFolderList({
  folders = [],
  selectedFolder = null,
  onSelectFolder,
  isScanning = false,
  onScan,
  onRename,
  onDeleteFolder,
  onCleanParts,
  onToggleCollapse,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders
    const q = searchQuery.toLowerCase()
    return folders.filter((f) => f.name.toLowerCase().includes(q))
  }, [folders, searchQuery])

  // Hitung total data di harddisk staging
  const totalDiskSize = useMemo(() => {
    return folders.reduce((sum, f) => sum + (f.size || 0), 0)
  }, [folders])

  const getFolderBadge = (folder) => {
    if (folder.hasArchive && folder.archiveParts > 0) {
      return {
        label: `${folder.archiveParts} Part RAR`,
        color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      }
    }
    if (folder.hasIso || folder.isInstallerPackage) {
      return {
        label: 'ISO Installer',
        color: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      }
    }
    // GOG Installer Check
    if (folder.isGogPackage || (folder.hasSetupExe && !folder.hasIso)) {
      return {
        label: 'GOG Installer',
        color: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
      }
    }
    if (folder.hasExe || folder.hasExtractedSubfolder) {
      return {
        label: 'Pre-Installed',
        color: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      }
    }
    if (folder.isArchiveFile) {
      return {
        label: 'Arsip Mentah',
        color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
      }
    }
    return {
      label: 'Folder Game',
      color: 'bg-zinc-800 text-zinc-400 border-white/10'
    }
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-xl">
      {/* Header & Disk Stats */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <HardDrive size={16} className="text-amber-400 shrink-0" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)] truncate">
            Folder PC ({folders.length})
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-[var(--text-3)] font-semibold whitespace-nowrap">
            {formatBytes(totalDiskSize)}
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded-lg border border-white/10 bg-white/5 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/10 transition-colors cursor-pointer"
              title="Sembunyikan panel daftar folder"
            >
              <PanelLeftClose size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari folder game..."
          className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none transition-colors"
        />
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[620px] scrollbar-thin">
        {filteredFolders.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-4)]">
            {isScanning ? (
              <div className="flex flex-col items-center gap-2 text-amber-400">
                <RefreshCw size={18} className="animate-spin" />
                <span>Memindai folder...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span>Tidak ada folder game yang ditemukan.</span>
                {onScan && (
                  <button
                    type="button"
                    onClick={() => onScan(false)}
                    className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold border border-amber-500/20 transition-all cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Pindai Ulang Folder</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          filteredFolders.map((folder) => {
            const isSelected = selectedFolder?.name === folder.name || selectedFolder?.path === folder.path
            const badge = getFolderBadge(folder)
            const cleanTitle = cleanReleaseName(folder.name)

            return (
              <div
                key={folder.path || folder.name}
                onClick={() => onSelectFolder(folder)}
                className={`group relative flex flex-col gap-1.5 rounded-xl border p-2.5 sm:p-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 shadow-[0_0_15px_rgba(255,209,0,0.15)]'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                {/* ── BARIS 1: NAMA GAME UTUH (LEBAR PENUH TANPA DIBATASI BADGE) ── */}
                <div className="flex items-center gap-2 min-w-0">
                  <Folder
                    size={15}
                    className={`shrink-0 ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-3)] group-hover:text-[var(--primary)]'}`}
                  />
                  <span
                    className="text-xs font-bold text-[var(--text)] truncate flex-1 leading-snug"
                    title={cleanTitle || folder.name}
                  >
                    {cleanTitle || folder.name}
                  </span>
                </div>

                {/* Subtitle jika nama folder asli berbeda dari cleanTitle */}
                {cleanTitle !== folder.name && (
                  <p className="text-[10px] font-mono text-[var(--text-4)] truncate pl-6 -mt-0.5" title={folder.name}>
                    {folder.name}
                  </p>
                )}

                {/* ── BARIS 2: UKURAN BERKAS + BADGE STATUS + TOMBOL AKSI ── */}
                <div className="flex items-center justify-between gap-1 pl-6 pt-0.5 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="text-[var(--text-3)] font-semibold shrink-0">
                      {formatBytes(folder.size || 0)}
                    </span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.2 text-[8.5px] font-bold uppercase tracking-wider ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Actions on hover/selected */}
                  <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    {folder.hasArchive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCleanParts?.(folder)
                        }}
                        className="p-1 rounded text-amber-400/80 hover:text-amber-300 hover:bg-amber-400/10 transition-colors cursor-pointer"
                        title="Bersihkan part WinRAR lokal"
                      >
                        <FileArchive size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRename?.(folder)
                      }}
                      className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/10 transition-colors cursor-pointer"
                      title="Ubah nama folder"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteFolder?.(folder)
                      }}
                      className="p-1 rounded text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Hapus folder dari PC"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
