'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, AlertTriangle, Search, Layers, HardDrive } from 'lucide-react'

// Official Google Drive Vector Icon
export function GoogleDriveIcon({ className = 'w-4 h-4 shrink-0' }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className}>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  )
}

function parseWorkspaceMeta(ws, placeholder = 'Pilih Workspace') {
  if (!ws) {
    return {
      email: '',
      username: placeholder,
      domain: '',
      usageGB: 0,
      limitGB: 0,
      freeGB: 0,
      freeFormatted: '',
      percentage: 0,
      isLimit: false,
      isSharedDrive: false,
      isEmpty: true,
      healthColor: 'zinc',
      badgeBg: 'bg-zinc-800 text-zinc-400 border-zinc-700/60',
      barColor: 'bg-zinc-600'
    }
  }

  const isSharedDrive = !!(
    ws.isSharedDrive ||
    ws.email?.startsWith('shared:') ||
    ws.name?.toLowerCase().includes('kebersamaan')
  )

  if (isSharedDrive) {
    const username = ws.name || 'KEBERSAMAAN'
    return {
      email: ws.email,
      username,
      domain: 'Shared Drive Penampungan',
      usageGB: 'Staging',
      limitGB: 'Pooled',
      freeGB: 0,
      freeFormatted: 'Staging Multi-Workspace',
      percentage: 100,
      isLimit: false,
      isSharedDrive: true,
      healthColor: 'teal',
      badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      barColor: 'bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400'
    }
  }

  let usageGB = parseFloat(ws.storage?.usageGB || 0)
  let limitGB = parseFloat(ws.storage?.limitGB || 1024)

  // Guard 1: Batasi kuota individual akun Google Drive (bukan pooled domain 100 TB)
  if (limitGB > 2048) {
    limitGB = 1024
  }

  // Guard 2: Jika usageGB melebihi kuota akun (> limitGB), itu adalah kebocoran pooled usage dari Shared Drive (73 TB)
  // Jangan set usageGB = limitGB karena akan membuat sisa kuota 0 GB!
  if (usageGB > limitGB) {
    const rawPct = parseFloat(ws.storage?.percentage)
    if (!isNaN(rawPct) && rawPct > 0 && rawPct <= 100) {
      usageGB = parseFloat(((rawPct / 100) * limitGB).toFixed(1))
    } else {
      usageGB = 0
    }
  }

  const freeGB = Math.max(0, limitGB - usageGB)
  const percentage = ws.storage?.percentage !== undefined && Number(ws.storage?.percentage) <= 100
    ? Math.min(100, Math.max(0, Number(ws.storage.percentage)))
    : (limitGB > 0 ? Math.min(100, Math.round((usageGB / limitGB) * 100)) : 0)

  const isLimit = ws.status === 'limit' || percentage >= 95
  const email = ws.email || ''
  const parts = email.split('@')
  const username = parts[0] || email
  const domain = parts[1] ? `@${parts[1]}` : ''

  // Format Free GB display
  let freeFormatted = `${freeGB.toFixed(freeGB < 10 && freeGB > 0 ? 1 : 0)} GB`
  if (freeGB >= 1000) {
    freeFormatted = `${(freeGB / 1024).toFixed(1)} TB`
  }

  // Health color classification
  let healthColor = 'emerald'
  let badgeBg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  let barColor = 'bg-gradient-to-r from-emerald-500 to-teal-400'

  if (isLimit) {
    healthColor = 'rose'
    badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    barColor = 'bg-rose-500'
  } else if (freeGB < 30 || percentage >= 95) {
    healthColor = 'rose'
    badgeBg = 'bg-rose-500/15 text-rose-400 border-rose-500/30'
    barColor = 'bg-gradient-to-r from-amber-500 to-rose-500'
  } else if (freeGB < 100 || percentage >= 85) {
    healthColor = 'amber'
    badgeBg = 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    barColor = 'bg-gradient-to-r from-amber-400 to-amber-500'
  }

  return {
    email,
    username,
    domain,
    usageGB,
    limitGB,
    freeGB,
    freeFormatted,
    percentage,
    isLimit,
    isSharedDrive: false,
    healthColor,
    badgeBg,
    barColor
  }
}

export default function WorkspaceDrivePicker({
  workspaces = [],
  value,
  onChange,
  targetWorkspace,
  setTargetWorkspace,
  selectedWorkspace,
  onSelect,
  disabled = false,
  className = '',
  align = 'left',
  placeholder = 'Pilih Workspace'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  // Current active workspace resolution (mendukung targetWorkspace maupun selectedWorkspace)
  const activeTarget = targetWorkspace || selectedWorkspace || null
  const currentWs = useMemo(() => {
    if (value !== undefined) {
      if (!value) return null
      return workspaces.find((w) => w.email === value) || null
    }
    if (activeTarget) {
      return workspaces.find((w) => w.email === activeTarget?.email) || activeTarget
    }
    return workspaces[0] || null
  }, [value, activeTarget, workspaces])

  const meta = useMemo(() => parseWorkspaceMeta(currentWs, placeholder), [currentWs, placeholder])

  // Pisahkan Shared Drive dan Personal Workspace
  const { sharedList, personalList } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const shared = []
    const personal = []

    for (const w of workspaces) {
      const isShared = !!(w.isSharedDrive || w.email?.startsWith('shared:') || w.name?.toLowerCase().includes('kebersamaan'))
      const match = !q || (w.name || '').toLowerCase().includes(q) || (w.email || '').toLowerCase().includes(q)

      if (match) {
        if (isShared) {
          shared.push(w)
        } else {
          personal.push(w)
        }
      }
    }

    return { sharedList: shared, personalList: personal }
  }, [workspaces, searchQuery])

  // Focus input search saat dropdown terbuka
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus()
      }, 50)
    }
  }, [isOpen])

  // Click outside & Escape listener
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (ws) => {
    if (onChange) {
      onChange(ws.email, ws)
    }
    if (setTargetWorkspace) {
      setTargetWorkspace(ws)
    }
    if (onSelect) {
      onSelect(ws)
    }
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className} ${isOpen ? 'z-50' : ''}`}>
      {/* ── TRIGGER BUTTON ── */}
      <button
        type="button"
        disabled={disabled || workspaces.length === 0}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group w-full flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all cursor-pointer relative overflow-hidden ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-white/5 bg-black/40'
            : isOpen
            ? 'border-emerald-500/50 bg-zinc-950 shadow-xl shadow-emerald-950/30 ring-1 ring-emerald-500/40'
            : meta.isEmpty
            ? 'border-white/10 bg-black/40 hover:border-white/20 hover:bg-black/60 shadow-sm'
            : meta.isSharedDrive
            ? 'border-teal-500/30 bg-gradient-to-r from-teal-950/40 via-zinc-950 to-black/60 hover:border-teal-400/50 shadow-md'
            : 'border-white/10 bg-black/60 hover:bg-black/80 hover:border-white/20 shadow-md'
        }`}
      >
        {/* Left: Brand Icon & Account Info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {meta.isEmpty ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 p-1.5 shadow-sm opacity-50">
              <GoogleDriveIcon className="w-4 h-4" />
            </div>
          ) : meta.isSharedDrive ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 shadow-sm">
              <Layers size={16} />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 p-1.5 shadow-sm">
              <GoogleDriveIcon className="w-4 h-4" />
            </div>
          )}

          <div className="min-w-0 flex-1 leading-tight space-y-0.5">
            {/* Account Username & Domain */}
            <div className="flex items-center gap-1.5 truncate">
              <span className={`font-bold text-xs truncate max-w-[170px] sm:max-w-[210px] ${
                meta.isEmpty
                  ? 'text-zinc-400 font-semibold'
                  : meta.isSharedDrive
                  ? 'text-teal-300 tracking-wide font-black'
                  : 'text-white'
              }`}>
                {meta.isSharedDrive ? `📁 ${meta.username}` : meta.username}
              </span>
              {meta.domain && (
                <span className="text-[10px] text-zinc-400 font-mono truncate hidden sm:inline">
                  {meta.domain}
                </span>
              )}
            </div>

            {/* Storage Quota Health Pill / Empty Hint */}
            {meta.isEmpty ? (
              <span className="text-[10px] text-zinc-500 font-mono block">
                Klik untuk memilih workspace tujuan
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${meta.badgeBg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.isLimit ? 'bg-rose-400 animate-ping' : 'bg-current'}`} />
                  <span>
                    {meta.isLimit ? 'Limit Kuota' : meta.isSharedDrive ? 'Staging Penampungan' : `Sisa ${meta.freeFormatted}`}
                  </span>
                </span>
                {!meta.isSharedDrive && (
                  <span className="text-[10px] text-zinc-500 font-mono hidden md:inline">
                    ({meta.percentage}% terpakai)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Chevron Down Indicator */}
        <div className="shrink-0 flex items-center pl-1 text-zinc-400 group-hover:text-white transition-colors">
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`}
          />
        </div>

        {/* Micro Storage Gauge Bar at Bottom Edge */}
        {!meta.isEmpty && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
            <div
              className={`h-full transition-all duration-300 ${meta.barColor}`}
              style={{ width: `${Math.min(100, Math.max(3, meta.percentage))}%` }}
            />
          </div>
        )}
      </button>

      {/* ── DROPDOWN POPOVER MENU ── */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 z-[70] w-full min-w-[320px] sm:min-w-[400px] rounded-2xl border border-white/15 bg-zinc-950/95 p-2 shadow-2xl shadow-black/95 backdrop-blur-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Popover Header & Search Input */}
          <div className="px-1 pt-1 pb-1 space-y-2 border-b border-white/10">
            <div className="flex items-center justify-between px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <GoogleDriveIcon className="w-3.5 h-3.5" />
                <span>Pilih Sumber / Workspace Drive</span>
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white font-mono">
                {workspaces.length} Akun
              </span>
            </div>

            {/* Live Filter Search Bar */}
            {workspaces.length > 4 && (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Cari nama akun atau shared drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/60 pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-400 focus:outline-none transition-all"
                />
              </div>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
            {/* 1. SEKSI SHARED DRIVE (PENAMPUNGAN) */}
            {sharedList.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-teal-400 font-mono flex items-center gap-1">
                  <Layers size={10} />
                  <span>Shared Drive (Penampungan Staging)</span>
                </div>
                {sharedList.map((ws) => {
                  const isSelected = currentWs?.email === ws.email
                  return (
                    <button
                      key={ws.email}
                      type="button"
                      onClick={() => handleSelect(ws)}
                      className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-teal-500/15 border-teal-500/50 text-white shadow-md shadow-teal-950/40 ring-1 ring-teal-500/30'
                          : 'bg-teal-950/20 hover:bg-teal-950/40 border-teal-500/20 text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 border border-teal-500/40 text-teal-300">
                          <Layers size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-teal-200 truncate">
                              📁 {ws.name}
                            </span>
                            <span className="rounded-full bg-teal-500/20 px-1.5 py-0.2 text-[8px] font-mono font-bold text-teal-300 border border-teal-500/30">
                              Staging
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            Terhubung ke semua akun • Penampungan alokasi game
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isSelected && (
                          <Check size={15} className="text-teal-400 font-bold shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* 2. SEKSI PERSONAL WORKSPACE DRIVES */}
            {personalList.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400 font-mono flex items-center gap-1">
                  <HardDrive size={10} />
                  <span>Workspace Google Drive ({personalList.length} Akun)</span>
                </div>

                {personalList.map((ws) => {
                  const itemMeta = parseWorkspaceMeta(ws)
                  const isSelected = currentWs?.email === ws.email

                  return (
                    <button
                      key={ws.email}
                      type="button"
                      onClick={() => handleSelect(ws)}
                      className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-sm ring-1 ring-emerald-500/30'
                          : 'bg-black/20 hover:bg-white/5 border-transparent text-zinc-300'
                      }`}
                    >
                      {/* Left: Account Icon & Full Details */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border p-1.5 ${
                          isSelected ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-black/50 border-white/10'
                        }`}>
                          <GoogleDriveIcon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold text-xs truncate ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                              {itemMeta.username}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono truncate">
                              {itemMeta.domain}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono">
                            {itemMeta.isLimit ? (
                              <span className="text-rose-400 font-bold flex items-center gap-1">
                                <AlertTriangle size={10} />
                                <span>Limit Download Quota</span>
                              </span>
                            ) : (
                              <span className="text-zinc-400">
                                Terpakai {itemMeta.usageGB} GB / {itemMeta.limitGB} GB
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Storage Pill, Mini Gauge, & Checkmark */}
                      <div className="shrink-0 text-right space-y-1">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${itemMeta.badgeBg}`}>
                            Sisa {itemMeta.freeFormatted}
                          </span>
                          {isSelected && (
                            <Check size={14} className="text-emerald-400 font-bold shrink-0 ml-0.5" />
                          )}
                        </div>

                        {/* Micro Progress Bar */}
                        <div className="w-20 h-1.5 rounded-full bg-white/10 ml-auto overflow-hidden">
                          <div
                            className={`h-full rounded-full ${itemMeta.barColor}`}
                            style={{ width: `${Math.min(100, itemMeta.percentage)}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {sharedList.length === 0 && personalList.length === 0 && (
              <div className="p-5 text-center text-xs text-zinc-500 font-mono">
                Tidak ada workspace yang cocok dengan pencarian &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
