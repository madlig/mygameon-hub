'use client'

import { useState, useMemo } from 'react'
import {
  Folder, File, FileArchive, Disc, FileText, Trash2,
  FolderOpen, Search, Copy, Check, RefreshCw, ChevronRight,
  ChevronDown, ChevronUp, Play, Eraser, AlertTriangle,
  Package, Layers, Sparkles, Cpu, Settings, CheckCircle2
} from 'lucide-react'
import { formatBytes } from '@/lib/utils'

export default function FolderInspector({
  activeFolder,
  inspectData,
  loading = false,
  error = null,
  onRefresh,
  onDeleteSingleFile,
  onDeleteFolder,
  onCleanParts,
  onSanitizeJunk,
  onExtractArchive,
}) {
  const [fileSearch, setFileSearch] = useState('')
  const [currentSubfolder, setCurrentSubfolder] = useState(null)
  const [activeCategoryTab, setActiveCategoryTab] = useState('all') // 'all' | 'archives' | 'executables' | 'subfolders' | 'junk' | 'system'
  const [showRarPartsList, setShowRarPartsList] = useState(false)
  const [showSystemFilesList, setShowSystemFilesList] = useState(false)
  const [copied, setCopied] = useState(false)

  const rawFiles = useMemo(() => inspectData?.files || [], [inspectData?.files])
  const subfolders = inspectData?.subfolders || []

  const handleCopyPath = () => {
    if (!activeFolder?.path) return
    navigator.clipboard.writeText(activeFolder.path)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Kategorisasi berkas cerdas
  const categorized = useMemo(() => {
    const archives = []
    const executables = []
    const junk = []
    const systemAndAssets = []

    for (const f of rawFiles) {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      const lower = f.name.toLowerCase()

      const isRar = /\.(rar|7z|zip|part\d+\.rar|r\d+)$/i.test(f.name) || f.category === 'rar_part'
      const isExe = ['exe', 'bat', 'cmd'].includes(ext)
      const isJunk =
        ['url', 'website'].includes(ext) ||
        lower === 'desktop.ini' ||
        lower === 'thumbs.db' ||
        lower.includes('ovagames') ||
        lower.includes('steamrip') ||
        lower.includes('fitgirl') ||
        lower.includes('dodi')

      if (isRar) {
        archives.push(f)
      } else if (isJunk) {
        junk.push(f)
      } else if (isExe) {
        executables.push(f)
      } else {
        systemAndAssets.push(f)
      }
    }

    // Urutkan arsip part
    archives.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    return {
      archives,
      executables,
      junk,
      systemAndAssets,
    }
  }, [rawFiles])

  // Evaluasi apakah game sudah terekstrak
  const hasExtractedGame =
    subfolders.length > 0 ||
    !!activeFolder?.hasExtractedSubfolder ||
    categorized.executables.length > 0

  // Filter berkas berdasarkan subfolder aktif, search query, dan tab
  const displayList = useMemo(() => {
    let list = rawFiles
    if (currentSubfolder) {
      list = list.filter((f) => f.subfolder === currentSubfolder || f.relativePath?.startsWith(currentSubfolder))
    }

    if (activeCategoryTab === 'archives') {
      list = list.filter((f) => /\.(rar|7z|zip|part\d+\.rar|r\d+)$/i.test(f.name) || f.category === 'rar_part')
    } else if (activeCategoryTab === 'executables') {
      list = list.filter((f) => /\.(exe|bat|cmd)$/i.test(f.name))
    } else if (activeCategoryTab === 'junk') {
      list = list.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() || ''
        const lower = f.name.toLowerCase()
        return (
          ['url', 'website'].includes(ext) ||
          lower === 'desktop.ini' ||
          lower === 'thumbs.db' ||
          lower.includes('ovagames') ||
          lower.includes('steamrip')
        )
      })
    } else if (activeCategoryTab === 'system') {
      list = list.filter(
        (f) =>
          !/\.(rar|7z|zip|part\d+\.rar|r\d+|exe|bat|cmd|url|website)$/i.test(f.name) &&
          f.name.toLowerCase() !== 'desktop.ini' &&
          f.name.toLowerCase() !== 'thumbs.db'
      )
    }

    if (!fileSearch.trim()) return list
    const q = fileSearch.toLowerCase()
    return list.filter((f) => f.name.toLowerCase().includes(q))
  }, [rawFiles, currentSubfolder, activeCategoryTab, fileSearch])

  const totalRarSize = useMemo(() => {
    return categorized.archives.reduce((acc, f) => acc + (f.size || 0), 0)
  }, [categorized.archives])

  const totalSystemSize = useMemo(() => {
    return categorized.systemAndAssets.reduce((acc, f) => acc + (f.size || 0), 0)
  }, [categorized.systemAndAssets])

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (['rar', 'zip', '7z', 'r00', 'r01'].includes(ext)) {
      return <FileArchive size={14} className="text-amber-400 shrink-0" />
    }
    if (['iso', 'bin', 'cue', 'mds'].includes(ext)) {
      return <Disc size={14} className="text-purple-400 shrink-0" />
    }
    if (['exe', 'bat', 'cmd'].includes(ext)) {
      return <Play size={14} className="text-emerald-400 shrink-0" />
    }
    if (['txt', 'nfo', 'url', 'website', 'ini'].includes(ext)) {
      return <FileText size={14} className="text-zinc-400 shrink-0" />
    }
    return <File size={14} className="text-[var(--text-3)] shrink-0" />
  }

  if (!activeFolder) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
        <FolderOpen size={32} className="text-white/10 mb-2" />
        <p className="text-xs font-semibold text-[var(--text-4)]">
          Pilih salah satu folder game di panel kiri untuk mulai memeriksa berkas.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-xl space-y-3">
      {/* ── 1. HEADER INFORMASI FOLDER & AKSI CEPAT ── */}
      <div className="flex flex-col gap-2 pb-3 border-b border-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-[var(--primary)] shrink-0" />
            <h4 className="text-xs font-black text-[var(--text)] uppercase tracking-wider truncate" title={activeFolder.name}>
              {activeFolder.name}
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-[var(--text-4)] truncate max-w-sm" title={activeFolder.path}>
              {activeFolder.path}
            </span>
            <button
              type="button"
              onClick={handleCopyPath}
              className="text-[10px] text-[var(--text-4)] hover:text-[var(--text)] transition-colors p-0.5 cursor-pointer"
              title="Salin path folder"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            </button>
          </div>
        </div>

        {/* Toolbar Cepat: Sanitasi Sampah & Refresh */}
        <div className="flex items-center gap-1.5 shrink-0">
          {categorized.junk.length > 0 && onSanitizeJunk && (
            <button
              type="button"
              onClick={onSanitizeJunk}
              className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm"
              title={`Bersihkan ${categorized.junk.length} berkas sampah, url iklan, dan thumbs.db`}
            >
              <Eraser size={11} />
              <span>Bersihkan {categorized.junk.length} Sampah</span>
            </button>
          )}

          {onDeleteFolder && (
            <button
              type="button"
              onClick={onDeleteFolder}
              className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer shadow-sm"
              title="Hapus folder game ini dan seluruh isinya permanen dari harddisk PC"
            >
              <Trash2 size={11} />
              <span>Hapus Folder</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            title="Muat ulang isi folder"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[var(--primary)]' : ''} />
          </button>
        </div>
      </div>

      {/* ── 2. TAB KATEGORI CERDAS ── */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        <button
          type="button"
          onClick={() => setActiveCategoryTab('all')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            activeCategoryTab === 'all'
              ? 'bg-[var(--primary)] text-black shadow-sm'
              : 'border border-white/5 bg-black/30 text-[var(--text-3)] hover:text-[var(--text)]'
          }`}
        >
          <span>Semua (Ringkasan)</span>
        </button>

        {categorized.archives.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveCategoryTab('archives')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'archives'
                ? 'bg-amber-400 text-black shadow-sm'
                : 'border border-amber-500/20 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            <FileArchive size={11} />
            <span>Part RAR ({categorized.archives.length})</span>
          </button>
        )}

        {categorized.executables.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveCategoryTab('executables')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'executables'
                ? 'bg-emerald-400 text-black shadow-sm'
                : 'border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            <Play size={11} />
            <span>Executable ({categorized.executables.length})</span>
          </button>
        )}

        {subfolders.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveCategoryTab('subfolders')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'subfolders'
                ? 'bg-blue-400 text-black shadow-sm'
                : 'border border-blue-500/20 bg-blue-500/5 text-blue-300 hover:bg-blue-500/10'
            }`}
          >
            <Folder size={11} />
            <span>Subfolder ({subfolders.length})</span>
          </button>
        )}

        {categorized.junk.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveCategoryTab('junk')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'junk'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'border border-rose-500/20 bg-rose-500/5 text-rose-300 hover:bg-rose-500/10'
            }`}
          >
            <AlertTriangle size={11} />
            <span>Sampah ({categorized.junk.length})</span>
          </button>
        )}

        {categorized.systemAndAssets.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveCategoryTab('system')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ml-auto ${
              activeCategoryTab === 'system'
                ? 'bg-zinc-600 text-white'
                : 'border border-white/5 bg-black/20 text-[var(--text-4)] hover:text-[var(--text-3)]'
            }`}
          >
            <Settings size={10} />
            <span>Sistem ({categorized.systemAndAssets.length})</span>
          </button>
        )}
      </div>

      {/* ── 3. PENCARIAN & BREADCRUMB ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
          <input
            type="text"
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            placeholder="Cari berkas spesifik..."
            className="w-full rounded-lg border border-white/10 bg-black/30 pl-8 pr-2.5 py-1 text-[11px] text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
          />
        </div>

        {/* Breadcrumb Subfolder */}
        {currentSubfolder && (
          <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
            <button
              type="button"
              onClick={() => setCurrentSubfolder(null)}
              className="text-[var(--text-4)] hover:text-[var(--primary)] transition-colors cursor-pointer"
            >
              Root
            </button>
            <ChevronRight size={11} className="text-[var(--text-4)]" />
            <span className="font-bold text-[var(--text)] truncate max-w-[120px]">{currentSubfolder}</span>
          </div>
        )}
      </div>

      {/* ── 4. TAMPILAN KONTEN BERSIH SESUAI TAB ── */}
      <div className="space-y-2.5 max-h-[320px] overflow-y-auto scrollbar-thin pr-0.5">
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--text-4)]">
            <RefreshCw size={18} className="animate-spin text-amber-400 mx-auto mb-2" />
            <span>Membaca isi berkas...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-xs text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20">
            {error}
          </div>
        ) : (
          <>
            {/* ── TAMPILAN KHUSUS TAB 'SEMUA (RINGKASAN)' ── */}
            {activeCategoryTab === 'all' && (
              <>
                {/* 1. Subfolder Utama Chips */}
                {subfolders.length > 0 && !currentSubfolder && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">
                      Subfolder Utama ({subfolders.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {subfolders.map((sf) => (
                        <button
                          key={sf.name || sf}
                          type="button"
                          onClick={() => setCurrentSubfolder(sf.name || sf)}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] hover:border-amber-400/40 hover:text-[var(--text)] transition-all cursor-pointer"
                        >
                          <Folder size={12} className="text-amber-400 shrink-0" />
                          <span>{sf.name || sf}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Ringkasan Kartu Part WinRAR (Collapsible Accordion) */}
                {categorized.archives.length > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          <Package size={15} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-black text-[var(--text)]">
                              Paket {categorized.archives.length} Part WinRAR
                            </h5>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-300 font-mono">
                              {formatBytes(totalRarSize)}
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--text-4)]">
                            {hasExtractedGame
                              ? 'Berkas part arsip terdeteksi (Tersedia bersamaan dengan game terpasang)'
                              : 'Seluruh berkas part arsip siap diunggah'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowRarPartsList((prev) => !prev)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/10 bg-black/40 text-[10px] font-bold text-amber-300 hover:bg-black/60 transition-all cursor-pointer"
                        >
                          <span>{showRarPartsList ? 'Sembunyikan' : `Lihat ${categorized.archives.length} Part`}</span>
                          {showRarPartsList ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      </div>
                    </div>

                    {/* Daftar Part Detail jika di-expand */}
                    {showRarPartsList && (
                      <div className="pt-2 border-t border-amber-500/20 space-y-1 max-h-40 overflow-y-auto">
                        {categorized.archives.map((part) => (
                          <div
                            key={part.fullPath || part.name}
                            className="flex items-center justify-between px-2 py-1 rounded bg-black/30 text-[11px] font-mono hover:bg-black/50"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileArchive size={12} className="text-amber-400 shrink-0" />
                              <span className="text-zinc-300 truncate">{part.name}</span>
                            </div>
                            <span className="text-[10px] text-[var(--text-4)] shrink-0 ml-2">
                              {formatBytes(part.size || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Berkas Executable Utama (.exe) */}
                {categorized.executables.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Executable Game ({categorized.executables.length})
                    </span>
                    <div className="space-y-1">
                      {categorized.executables.map((exe) => (
                        <div
                          key={exe.fullPath || exe.name}
                          className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Play size={13} className="text-emerald-400 shrink-0" />
                            <span className="font-mono text-[11px] font-bold text-emerald-300 truncate">
                              {exe.name}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-[var(--text-4)] shrink-0">
                            {formatBytes(exe.size || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Berkas Sampah / Iklan (Jika Ditemukan) */}
                {categorized.junk.length > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span className="text-[11px] font-bold">
                        Ditemukan {categorized.junk.length} berkas iklan/sampah (.url, .website, thumbs.db)
                      </span>
                    </div>
                    {onSanitizeJunk && (
                      <button
                        type="button"
                        onClick={onSanitizeJunk}
                        className="px-2 py-0.5 rounded-lg bg-rose-500 text-white text-[10px] font-black hover:bg-rose-600 transition-colors cursor-pointer"
                      >
                        Bersihkan
                      </button>
                    )}
                  </div>
                )}

                {/* 5. Accordion Berkas Sistem & Library Game (Tertutup Default) */}
                {categorized.systemAndAssets.length > 0 && (
                  <div className="rounded-xl border border-white/5 bg-black/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowSystemFilesList((prev) => !prev)}
                      className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Cpu size={12} className="text-[var(--text-4)]" />
                        <span>
                          Berkas Sistem & Asset Game ({categorized.systemAndAssets.length} berkas,{' '}
                          {formatBytes(totalSystemSize)})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-4)]">
                        <span>{showSystemFilesList ? 'Sembunyikan' : 'Tampilkan'}</span>
                        {showSystemFilesList ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </div>
                    </button>

                    {showSystemFilesList && (
                      <div className="p-2.5 pt-0 space-y-0.5 max-h-48 overflow-y-auto border-t border-white/5">
                        {categorized.systemAndAssets.map((f) => (
                          <div
                            key={f.fullPath || f.name}
                            className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-white/[0.03] text-[10px] font-mono text-[var(--text-4)]"
                          >
                            <span className="truncate">{f.name}</span>
                            <span className="shrink-0 ml-2">{formatBytes(f.size || 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── TAMPILAN TAB SELAIN 'SEMUA' (FILTER KHUSUS) ── */}
            {activeCategoryTab !== 'all' && (
              <div className="space-y-1">
                {displayList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--text-4)]">
                    Tidak ada berkas yang cocok dengan filter ini.
                  </div>
                ) : (
                  displayList.map((file) => {
                    const isArchive = /\.(rar|zip|7z|part\d+\.rar)$/i.test(file.name)
                    return (
                      <div
                        key={file.fullPath || file.name}
                        className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(file.name)}
                          <span
                            className="font-mono text-[11px] text-[var(--text-2)] group-hover:text-[var(--text)] truncate"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[10px] text-[var(--text-4)]">
                            {formatBytes(file.size || 0)}
                          </span>

                          {/* Tombol Ekstrak: HANYA jika game BELUM diekstrak (Skenario C) */}
                          {isArchive && !hasExtractedGame && onExtractArchive && (
                            <button
                              type="button"
                              onClick={() => onExtractArchive(file)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 px-1.5 rounded bg-amber-400/20 text-amber-300 hover:bg-amber-400 hover:text-black transition-all text-[10px] font-black cursor-pointer"
                              title="Ekstrak arsip ini di PC"
                            >
                              Ekstrak
                            </button>
                          )}

                          {onDeleteSingleFile && (
                            <button
                              type="button"
                              onClick={() => onDeleteSingleFile(file)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                              title="Hapus file ini"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
