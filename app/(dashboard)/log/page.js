'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ClipboardList, AlertCircle, Search, Download, Copy, CheckCheck, Send,
  KeyRound, Hourglass, CalendarDays, Gamepad2, ShoppingBag, Gift, Sparkles,
  ReceiptText
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/shared/StatCard'

const ORDER_FILTERS = [
  { key: 'all',    label: 'Semua Pesanan' },
  { key: 'today',  label: 'Hari ini' },
  { key: 'week',   label: 'Minggu ini' },
  { key: 'month',  label: 'Bulan ini' },
  { key: 'bonus',  label: 'Ada Bonus' },
  { key: 'sims4',  label: 'The Sims 4' },
]

const GAME_FILTERS = [
  { key: 'all',     label: 'Semua Item' },
  { key: 'general', label: 'General' },
  { key: 'sims4',   label: 'Sims 4' },
  { key: 'today',   label: 'Hari ini' },
  { key: 'week',    label: 'Minggu ini' },
  { key: 'month',   label: 'Bulan ini' },
]

const EMPTY_STATS = { total: 0, today: 0, week: 0, totalGames: 0, bonusOrders: 0, sims4: 0, general: 0 }

function jkt(t) {
  const d = new Date(t)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}
function fmtTime(t) {
  const d = new Date(t)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}
function fmtFull(t) {
  const d = new Date(t)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}
function dayLabel(t, todayKey, yKey) {
  const k = jkt(t)
  if (!k) return 'Tanggal tidak diketahui'
  if (k === todayKey) return 'Hari ini'
  if (k === yKey) return 'Kemarin'
  return new Date(t).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })
}

function groupLogs(logs) {
  const todayKey = jkt(Date.now())
  const yKey = jkt(Date.now() - 86400000)
  const groups = []
  const map = new Map()
  for (const log of logs) {
    const key = jkt(log.time) || 'unknown'
    if (!map.has(key)) {
      const g = { key, label: dayLabel(log.time, todayKey, yKey), items: [] }
      map.set(key, g)
      groups.push(g)
    }
    map.get(key).items.push(log)
  }
  return groups
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function LogPage() {
  const [mode, setMode]       = useState('orders') // 'orders' | 'games'
  const [logs, setLogs]       = useState([])
  const [total, setTotal]     = useState(0)
  const [stats, setStats]     = useState(EMPTY_STATS)
  const [page, setPage]       = useState(1)
  const [filter, setFilter]   = useState('all')
  const [query, setQuery]     = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [exporting, setExporting] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)

  async function fetchLogs(m, f, p, q) {
    const myId = ++reqIdRef.current
    setIsLoading(true)
    try {
      const res = await fetch(`/api/log?mode=${m}&filter=${f}&page=${p}&q=${encodeURIComponent(q)}`)
      if (myId !== reqIdRef.current) return
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || `Error ${res.status}`)
        setLogs([])
        return
      }
      const data = await res.json()
      if (myId !== reqIdRef.current) return
      setError(null)
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      if (data.stats) setStats(data.stats)
    } catch {
      if (myId !== reqIdRef.current) return
      setError('Gagal terhubung ke server')
      setLogs([])
    } finally {
      if (myId === reqIdRef.current) setIsLoading(false)
    }
  }

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchLogs(mode, filter, page, query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [mode, filter, page, query])

  function handleModeChange(newMode) {
    if (newMode === mode) return
    setMode(newMode)
    setFilter('all')
    setPage(1)
    setLogs([])
  }

  function handleFilter(f) { setFilter(f); setPage(1) }
  function handleSearch(e) { setQuery(e.target.value); setPage(1) }

  function copyText(text, id) {
    if (!text) return
    try {
      navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1400)
    } catch {}
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const res = await fetch(`/api/log?mode=${mode}&filter=${filter}&q=${encodeURIComponent(query)}&all=1`)
      const data = await res.json()
      const rows = data.logs || []

      let lines = []
      if (mode === 'orders') {
        const header = ['Tanggal', 'Nomor Pesanan', 'Email Pembeli', 'Jumlah Game', 'Rincian Game', 'Hak Bonus', 'Klaim Bonus', 'Status']
        lines.push(header.join(','))
        for (const r of rows) {
          const gameNames = (r.cartItems || []).map(i => `${i.name}${i.isBonus ? ' (Bonus)' : ''}`).join('; ')
          lines.push([
            fmtFull(r.time),
            r.invoice || 'Pesanan Langsung',
            r.email,
            r.itemCount,
            gameNames,
            r.bonusEligible || 0,
            r.bonusClaimed || 0,
            r.status || 'Terkirim'
          ].map(csvCell).join(','))
        }
      } else {
        const header = ['Tanggal', 'Tipe', 'Email', 'Produk', 'Sumber', 'Status']
        lines.push(header.join(','))
        for (const r of rows) {
          lines.push([fmtFull(r.time), r.type === 'sims4' ? 'Sims 4' : 'General', r.email, r.product, r.source, r.status].map(csvCell).join(','))
        }
      }

      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mygameon-${mode === 'orders' ? 'pesanan' : 'log-game'}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Gagal export CSV')
    } finally {
      setExporting(false)
    }
  }

  const groups = groupLogs(logs)
  const currentFilters = mode === 'orders' ? ORDER_FILTERS : GAME_FILTERS

  return (
    <div className="fadeUp">
      <TopBar title="Log Transaksi" />

      {/* Switcher Tab Mode: Pesanan vs Log Game */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleModeChange('orders')}
            className={`pressable flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              mode === 'orders'
                ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-[0_4px_16px_-4px_rgba(255,209,0,0.4)]'
                : 'border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--border-strong)]'
            }`}
          >
            <ShoppingBag size={14} />
            <span>Pesanan (Order)</span>
            {mode === 'orders' && stats.total > 0 && (
              <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-black">
                {stats.total}
              </span>
            )}
          </button>
          <button
            onClick={() => handleModeChange('games')}
            className={`pressable flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              mode === 'games'
                ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-[0_4px_16px_-4px_rgba(255,209,0,0.4)]'
                : 'border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--border-strong)]'
            }`}
          >
            <Gamepad2 size={14} />
            <span>Log Game (Satuan)</span>
          </button>
        </div>
        <p className="hidden text-xs text-[var(--text-3)] md:block">
          {mode === 'orders'
            ? '1 keranjang ke 1 email dihitung 1 pesanan'
            : 'Audit pengiriman per file item Google Drive'}
        </p>
      </div>

      {/* Stats Cards */}
      {mode === 'orders' ? (
        <div className="mb-5 grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4">
          <StatCard label="Total Pesanan" value={stats.total} sub="transaksi unik" subColor="text-[var(--text-3)]" icon={ClipboardList} accent="#ffd100" />
          <StatCard label="Hari ini" value={stats.today} sub="pesanan masuk" subColor="text-[#4ade80]" icon={Send} accent="#22c55e" />
          <StatCard label="Minggu ini" value={stats.week} sub="7 hari terakhir" subColor="text-[#93c5fd]" icon={Hourglass} accent="#60a5fa" />
          <StatCard label="Game Terkirim" value={stats.totalGames || 0} sub={`${stats.bonusOrders || 0} order bonus`} icon={Gamepad2} accent="#a78bfa" />
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4">
          <StatCard label="Total Entri" value={stats.total} icon={ClipboardList} accent="#ffd100" />
          <StatCard label="Hari ini" value={stats.today} sub="file terkirim" subColor="text-[#4ade80]" icon={Send} accent="#22c55e" />
          <StatCard label="Minggu ini" value={stats.week} sub="7 hari" subColor="text-[#93c5fd]" icon={Hourglass} accent="#60a5fa" />
          <StatCard label="Sims 4" value={stats.sims4} sub={`${stats.general} general`} icon={KeyRound} accent="#a78bfa" />
        </div>
      )}

      {/* Search + Export */}
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="text" value={query} onChange={handleSearch}
            placeholder={mode === 'orders' ? 'Cari nomor invoice Shopee, email pembeli, atau judul game...' : 'Cari email, invoice, atau produk...'}
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-2.5 pl-11 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="pressable flex shrink-0 items-center gap-1.5 rounded-2xl border border-[var(--border-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
        >
          <Download size={15} /> <span className="hidden sm:inline">{exporting ? 'Menyiapkan…' : 'Export'}</span>
        </button>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {currentFilters.map(f => (
          <button
            key={f.key}
            onClick={() => handleFilter(f.key)}
            className={`pressable rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key
                ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                : 'border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--border-strong)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
        {total} {mode === 'orders' ? 'pesanan' : 'entri'}{query ? ' ditemukan' : ''}
      </p>

      {/* Error */}
      {error && !isLoading && (
        <div className="mb-4 flex items-start gap-1.5 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[#fca5a5]">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> Gagal memuat data: {error}
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><p className="text-sm text-[var(--text-3)]">Memuat data…</p></div>}

      {/* Timeline dikelompokkan per hari */}
      {!isLoading && groups.map((g, gi) => (
        <div key={g.key} className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <CalendarDays size={13} className="text-[var(--text-3)]" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)]">{g.label}</p>
            <span className="text-[10px] text-[var(--text-3)]">· {g.items.length} {mode === 'orders' ? 'pesanan' : 'entri'}</span>
            <div className="ml-1 h-px flex-1 bg-[var(--border-soft)]" />
          </div>

          {/* GRID TAMPILAN PESANAN (ORDERS) */}
          {mode === 'orders' ? (
            <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((ord, i) => {
                const id = `${gi}-${i}`
                return (
                  <div key={ord.id || i} className="flex flex-col justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3.5 transition-all hover:border-[var(--border-strong)]">
                    <div>
                      {/* Top Bar: Invoice & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => copyText(ord.invoice || ord.displayInvoice, `inv-${id}`)}
                          className="group flex min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--elevated)]/60 px-2 py-0.5 text-left transition hover:border-[var(--primary)]"
                          title="Salin nomor pesanan"
                        >
                          <ReceiptText size={11} className="shrink-0 text-[var(--primary)]" />
                          <span className="truncate text-xs font-bold text-[var(--text)]">
                            {ord.invoice ? `#${ord.invoice}` : 'Pesanan Langsung'}
                          </span>
                          {copiedId === `inv-${id}` ? (
                            <CheckCheck size={11} className="shrink-0 text-[var(--success)]" />
                          ) : (
                            <Copy size={11} className="shrink-0 text-[var(--text-3)] opacity-0 transition group-hover:opacity-100" />
                          )}
                        </button>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--elevated)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-2)]">
                            {ord.itemCount} Game
                          </span>
                          <span className="rounded-full bg-[var(--success)]/12 px-2 py-0.5 text-[10px] font-bold text-[#4ade80]">
                            {ord.status || 'Terkirim'}
                          </span>
                        </div>
                      </div>

                      {/* Customer Email & Jam */}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <button
                          onClick={() => copyText(ord.email, `em-${id}`)}
                          className="group flex min-w-0 items-center gap-1.5 text-left"
                          title="Salin email pembeli"
                        >
                          <span className="truncate text-xs font-medium text-[var(--text)]">{ord.email || '—'}</span>
                          {copiedId === `em-${id}` ? (
                            <CheckCheck size={11} className="shrink-0 text-[var(--success)]" />
                          ) : (
                            <Copy size={11} className="shrink-0 text-[var(--text-3)] opacity-0 transition group-hover:opacity-100" />
                          )}
                        </button>
                        <span className="shrink-0 text-[10px] text-[var(--text-3)]">
                          {fmtTime(ord.time)}
                        </span>
                      </div>

                      {/* Daftar Game di dalam Keranjang */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {(ord.cartItems || []).map((item, itemIdx) => (
                          <span
                            key={itemIdx}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10.5px] font-medium ${
                              item.isBonus
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                : item.isSims4
                                ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                                : 'border-[var(--border-soft)] bg-[var(--elevated)]/60 text-[var(--text-2)]'
                            }`}
                          >
                            {item.isBonus ? (
                              <Gift size={10} className="shrink-0 text-amber-400" />
                            ) : item.isSims4 ? (
                              <KeyRound size={10} className="shrink-0 text-purple-400" />
                            ) : (
                              <Gamepad2 size={10} className="shrink-0 text-[var(--text-3)]" />
                            )}
                            <span className="truncate max-w-[180px]">{item.name}</span>
                            {item.isBonus && <span className="text-[9px] font-bold text-amber-400">(Bonus)</span>}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer Bonus Kuota jika ada */}
                    {ord.bonusEligible > 0 && (
                      <div className="mt-3 flex items-center justify-between border-t border-[var(--border-soft)]/60 pt-2 text-[10px]">
                        <span className="flex items-center gap-1 font-bold text-[var(--primary)]">
                          <Sparkles size={11} /> Hak Bonus: {ord.bonusEligible} Game
                        </span>
                        <span className="text-[var(--text-3)]">
                          {ord.bonusClaimed > 0 ? `${ord.bonusClaimed} diklaim` : 'Belum diklaim'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* GRID TAMPILAN LOG GAME SATUAN (LEGACY) */
            <div className="stagger grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((log, i) => {
                const id = `${gi}-${i}`
                return (
                  <div key={i} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => copyText(log.email, id)} className="group flex min-w-0 items-center gap-1.5 text-left" title="Salin email">
                        <span className="truncate text-xs font-semibold text-[var(--text)]">{log.email || '—'}</span>
                        {copiedId === id
                          ? <CheckCheck size={12} className="shrink-0 text-[var(--success)]" />
                          : <Copy size={12} className="shrink-0 text-[var(--text-3)] opacity-0 transition-opacity group-hover:opacity-100" />}
                      </button>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        log.type === 'sims4' ? 'bg-[var(--accent)]/15 text-[var(--accent-hi)]' : 'bg-[var(--primary)]/15 text-[var(--primary)]'
                      }`}>
                        {log.type === 'sims4' ? 'Sims 4' : 'General'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-[var(--text-3)]">{log.product}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[var(--text-3)]">
                        {fmtTime(log.time)}{log.type === 'sims4' && log.source ? ` · #${log.source}` : ''}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        log.status === 'Terkirim' || log.status === 'Active'
                          ? 'bg-[var(--success)]/12 text-[#4ade80]'
                          : 'bg-[var(--danger)]/12 text-[#fca5a5]'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {!isLoading && logs.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <ClipboardList size={30} className="text-[var(--text-3)]" />
          <p className="text-sm font-semibold text-[var(--text-2)]">{query ? 'Tidak ada hasil' : 'Belum ada data'}</p>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="pressable rounded-lg border border-[var(--border-soft)] px-4 py-2 text-xs font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-50">
            ← Prev
          </button>
          <p className="text-xs text-[var(--text-3)]">Hal {page} dari {Math.ceil(total / 20)}</p>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="pressable rounded-lg border border-[var(--border-soft)] px-4 py-2 text-xs font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-50">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
