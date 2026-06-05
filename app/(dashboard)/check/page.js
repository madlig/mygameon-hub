'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search, Folder, FolderOpen, ArrowLeft, AlertCircle, HardDrive, Files,
  ExternalLink, ChevronDown, ChevronRight, FileBox, CircleCheck, CircleAlert,
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/shared/StatCard'

function FolderBlock({ name, count, size, files = [], isOpen, onToggle, root = false }) {
  const hasFiles = files.length > 0
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
      <button onClick={onToggle} disabled={!hasFiles && count === 0} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left disabled:cursor-default">
        <span className="flex min-w-0 items-center gap-2">
          <Folder size={15} className={root ? 'text-[var(--primary)]' : 'text-[var(--text-3)]'} />
          <span className="truncate text-sm font-semibold text-[var(--text)]">{name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-3)]">
          {count} file · <span className="mono text-[var(--text-2)]">{size}</span>
          {hasFiles && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </span>
      </button>
      {isOpen && hasFiles && (
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto border-t border-[var(--border-soft)] p-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-[var(--elevated)]">
              <span className="flex min-w-0 items-center gap-1.5">
                <FileBox size={12} className="shrink-0 text-[var(--text-3)]" />
                <span className="truncate text-[11.5px] text-[var(--text-2)]">{f.name}</span>
              </span>
              <span className="mono shrink-0 text-[10.5px] text-[var(--text-3)]">{f.size}</span>
            </div>
          ))}
          {count > files.length && (
            <p className="px-2 pt-1 text-[10px] text-[var(--text-3)]">+{count - files.length} file lainnya tidak ditampilkan…</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function CheckPage() {
  const [keyword, setKeyword]   = useState('')
  const [results, setResults]   = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileStats, setFileStats] = useState(null)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)
  const abortRef = useRef(null)

  // Auto-search (debounce + race guard)
  useEffect(() => {
    if (keyword.trim().length < 2) {
      setResults([])
      setIsSearching(false)
      return
    }
    clearTimeout(debounceRef.current)
    setIsSearching(true)
    setError(null)
    debounceRef.current = setTimeout(async () => {
      const myId = ++reqIdRef.current
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`, { signal: ctrl.signal })
        const data = await res.json()
        if (myId !== reqIdRef.current) return
        setResults(data.results || [])
      } catch (e) {
        if (myId !== reqIdRef.current) return
        setError('Gagal mencari. Coba lagi.')
        setResults([])
      } finally {
        if (myId === reqIdRef.current) setIsSearching(false)
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [keyword])

  async function handleCheck(item) {
    setSelectedFile(item)
    setIsChecking(true)
    setFileStats(null)
    setError(null)
    setExpanded({})

    try {
      const res = await fetch(`/api/check?id=${encodeURIComponent(item.id)}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || `Gagal mengecek file (${res.status})`)
        setSelectedFile(null)
      } else {
        setFileStats(data)
        // Auto-buka folder dengan file terbanyak
        const candidates = [{ key: 'root', count: data.root.count }, ...data.subfolders.map(s => ({ key: s.name, count: s.count }))]
        const top = candidates.filter(c => c.count > 0).sort((a, b) => b.count - a.count)[0]
        if (top) setExpanded({ [top.key]: true })
      }
    } catch (e) {
      setError('Gagal terhubung ke server. Coba lagi.')
      setSelectedFile(null)
    } finally {
      setIsChecking(false)
    }
  }

  function back() {
    setFileStats(null)
    setSelectedFile(null)
    setExpanded({})
  }

  function toggleExpand(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const detailOpen = isChecking || !!fileStats
  const total = fileStats?.total
  const isEmpty = total && total.count === 0

  return (
    <div className="fadeUp">
      <TopBar title="Cek file" />

      <div className="md:grid md:grid-cols-[minmax(0,360px)_1fr] md:gap-6 md:items-start">
        {/* ── Kolom kiri: picker ── */}
        <div className={detailOpen ? 'hidden md:block' : ''}>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input
              type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder="Ketik nama game..."
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-2.5 pl-11 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
            />
          </div>

          {error && !detailOpen && (
            <div className="mb-4 flex items-start gap-1.5 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[#fca5a5]">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {isSearching && <p className="mb-3 text-xs text-[var(--text-3)]">Mencari…</p>}

          {!isSearching && results.length > 0 && (
            <>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">Pilih game untuk dicek</p>
              <div className="stagger flex flex-col gap-2">
                {results.map(item => {
                  const active = selectedFile?.id === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleCheck(item)}
                      className={`pressable flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-[var(--text)]">{item.name}</p>
                      <span className="shrink-0 text-xs font-semibold text-[var(--primary)]">Cek →</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {!isSearching && keyword.length >= 2 && results.length === 0 && !error && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="text-3xl">🎮</span>
              <p className="text-sm font-semibold text-[var(--text-2)]">Game tidak ditemukan</p>
            </div>
          )}

          {keyword.length < 2 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Folder size={30} className="text-[var(--text-3)]" />
              <p className="text-sm font-semibold text-[var(--text-2)]">Cek isi folder game</p>
              <p className="text-xs text-[var(--text-3)]">Ketik nama game untuk mulai</p>
            </div>
          )}
        </div>

        {/* ── Kolom kanan: detail ── */}
        <div className={detailOpen ? '' : 'hidden md:block'}>
          {isChecking && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-16">
              <FolderOpen size={30} className="animate-pulse text-[var(--text-3)]" />
              <p className="text-sm text-[var(--text-3)]">Mengecek isi folder…</p>
            </div>
          )}

          {fileStats && !isChecking && (
            <div className="animate-scale">
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button onClick={back} className="pressable shrink-0 text-[var(--text-2)] hover:text-[var(--text)] md:hidden"><ArrowLeft size={18} /></button>
                  <Folder size={18} className="shrink-0 text-[var(--primary)]" />
                  <h2 className="font-display truncate text-lg font-bold text-[var(--text)]">{fileStats.name}</h2>
                </div>
                <a
                  href={fileStats.driveUrl} target="_blank" rel="noreferrer"
                  className="pressable flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                >
                  <ExternalLink size={13} /> Buka di Drive
                </a>
              </div>

              {/* Health badge */}
              <div className="mb-3">
                {isEmpty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger)]/12 px-3 py-1 text-[11px] font-bold text-[#fca5a5]">
                    <CircleAlert size={13} /> Folder kosong — jangan dikirim
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success)]/12 px-3 py-1 text-[11px] font-bold text-[#4ade80]">
                    <CircleCheck size={13} /> Ada isi · {total.count} file
                  </span>
                )}
              </div>

              {/* Stat cards */}
              <div className="mb-5 grid grid-cols-3 gap-[var(--gap)]">
                <StatCard label="Total ukuran" value={total.size} icon={HardDrive} accent="#ffd100" />
                <StatCard label="Total file" value={total.count} icon={Files} accent="#60a5fa" />
                <StatCard label="Subfolder" value={fileStats.subfolders.length} icon={Folder} accent="#a78bfa" />
              </div>

              {/* Root */}
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">Isi folder</p>
              <div className="mb-3">
                <FolderBlock
                  root name="File di root" count={fileStats.root.count} size={fileStats.root.size}
                  files={fileStats.root.files} isOpen={!!expanded['root']} onToggle={() => toggleExpand('root')}
                />
              </div>

              {/* Subfolders */}
              {fileStats.subfolders.length > 0 && (
                <>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">Subfolder ({fileStats.subfolders.length})</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {fileStats.subfolders.map((sub, i) => (
                      <FolderBlock
                        key={i} name={sub.name} count={sub.count} size={sub.size} files={sub.files}
                        isOpen={!!expanded[sub.name]} onToggle={() => toggleExpand(sub.name)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Placeholder (desktop, belum pilih) */}
          {!detailOpen && (
            <div className="hidden h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)]/40 py-24 text-center md:flex">
              <FolderOpen size={34} className="text-[var(--text-3)]" />
              <p className="text-sm font-semibold text-[var(--text-2)]">Detail isi folder muncul di sini</p>
              <p className="max-w-[260px] text-xs text-[var(--text-3)]">Cari game di kiri lalu tekan "Cek" untuk melihat ukuran, jumlah, dan daftar filenya.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
