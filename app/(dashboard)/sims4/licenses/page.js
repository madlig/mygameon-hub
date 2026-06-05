'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, KeyRound, AlertCircle, Check, Copy, CheckCheck, Send, X, Calendar } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/shared/StatCard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { buildSims4DeliveryMessage } from '@/lib/sims4'

const ACTION_LABELS = {
  resetHwid: 'HWID berhasil direset',
  toggleCC: 'CC berhasil diubah',
  ban: 'Lisensi berhasil di-ban',
  unban: 'Lisensi berhasil di-unban',
}

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'active', label: 'Active' },
  { key: 'banned', label: 'Banned' },
  { key: 'premium', label: 'Premium' },
  { key: 'standard', label: 'Standard' },
  { key: 'hwidEmpty', label: 'HWID kosong' },
]

const EMPTY_STATS = { total: 0, active: 0, banned: 0, premium: 0, standard: 0, hwidEmpty: 0 }

function fmtDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Sims4LicensesPage() {
  const [licenses, setLicenses] = useState([])
  const [total, setTotal]       = useState(0)
  const [stats, setStats]       = useState(EMPTY_STATS)
  const [page, setPage]         = useState(1)
  const [query, setQuery]       = useState('')
  const [filter, setFilter]     = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)
  const [confirm, setConfirm]   = useState(null)
  const [isActing, setIsActing] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  const [resend, setResend]     = useState(null)
  const [copiedMsg, setCopiedMsg] = useState(false)
  const debounceRef = useRef(null)

  async function fetchLicenses(q, p, f) {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/sims4/licenses?q=${encodeURIComponent(q)}&page=${p}&filter=${f}`)
      const data = await res.json()
      setLicenses(data.licenses || [])
      setTotal(data.total || 0)
      if (data.stats) setStats(data.stats)
    } catch (e) {
      setActionMsg({ type: 'error', text: 'Gagal memuat lisensi.' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchLicenses(query, page, filter), 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, page, filter])

  function handleSearch(e) {
    setQuery(e.target.value)
    setPage(1)
  }
  function handleFilter(f) {
    setFilter(f)
    setPage(1)
  }

  async function runAction(invoice, action) {
    setIsActing(true)
    setActionMsg(null)
    try {
      const res = await fetch('/api/sims4/licenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice, action }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setActionMsg({ type: 'success', text: ACTION_LABELS[action] || 'Berhasil' })
        fetchLicenses(query, page, filter)
      } else {
        setActionMsg({ type: 'error', text: data.error || 'Terjadi kesalahan.' })
      }
    } catch (e) {
      setActionMsg({ type: 'error', text: 'Gagal terhubung ke server.' })
    } finally {
      setIsActing(false)
      setConfirm(null)
    }
  }

  function handleAction(lic, action) {
    if (action === 'ban') {
      setConfirm({
        title: 'Ban lisensi ini?',
        description: `Lisensi ${lic.invoice} (${lic.email}) akan di-ban dan tidak bisa dipakai. Anda bisa unban lagi nanti.`,
        confirmLabel: 'Ya, ban',
        onConfirm: () => runAction(lic.invoice, 'ban'),
      })
    } else if (action === 'resetHwid') {
      setConfirm({
        title: 'Reset HWID?',
        description: `HWID untuk lisensi ${lic.invoice} akan dikosongkan. Customer harus mengikat ulang perangkat saat login berikutnya.`,
        confirmLabel: 'Ya, reset',
        onConfirm: () => runAction(lic.invoice, 'resetHwid'),
      })
    } else {
      runAction(lic.invoice, action)
    }
  }

  function copyKey(invoice) {
    try {
      navigator.clipboard.writeText(invoice)
      setCopiedKey(invoice)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch (e) {}
  }

  function openResend(lic) {
    setCopiedMsg(false)
    setResend({ invoice: lic.invoice, message: buildSims4DeliveryMessage(lic.invoice, lic.cc === 'Y') })
  }
  function copyResend() {
    if (!resend) return
    try {
      navigator.clipboard.writeText(resend.message)
      setCopiedMsg(true)
      setTimeout(() => setCopiedMsg(false), 1800)
    } catch (e) {}
  }

  return (
    <div className="fadeUp">
      <TopBar title="Kelola lisensi" />

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4">
        <StatCard label="Total lisensi" value={stats.total} icon={KeyRound} accent="#ffd100" />
        <StatCard label="Active" value={stats.active} sub="Aktif" subColor="text-[#4ade80]" icon={Check} accent="#22c55e" />
        <StatCard label="Banned" value={stats.banned} sub="Diblokir" subColor="text-[#fca5a5]" icon={X} accent="#ef4444" />
        <StatCard label="Premium CC" value={stats.premium} sub={`${stats.standard} standard`} icon={KeyRound} accent="#a78bfa" />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input
          type="text" value={query} onChange={handleSearch}
          placeholder="Cari email atau invoice..."
          className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-2.5 pl-11 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
        />
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
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

      {/* Action message */}
      {actionMsg && (
        <div className={`mb-4 flex items-start gap-1.5 rounded-xl border px-4 py-3 text-sm ${
          actionMsg.type === 'success'
            ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[#4ade80]'
            : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[#fca5a5]'
        }`}>
          {actionMsg.type === 'success' ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
        {total} lisensi {query || filter !== 'all' ? 'ditemukan' : 'total'}
      </p>

      {isLoading && <div className="flex justify-center py-12"><p className="text-sm text-[var(--text-3)]">Memuat…</p></div>}

      {/* Grid kartu */}
      {!isLoading && (
        <div className="stagger mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {licenses.map((lic, i) => {
            const created = fmtDate(lic.createdAt)
            return (
              <div key={i} className="flex flex-col rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                {/* Header */}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <button onClick={() => copyKey(lic.invoice)} className="group flex min-w-0 items-center gap-1.5 text-left" title="Salin License Key">
                    <span className="mono truncate text-sm font-semibold text-[var(--info)]">{lic.invoice}</span>
                    {copiedKey === lic.invoice
                      ? <CheckCheck size={13} className="shrink-0 text-[var(--success)]" />
                      : <Copy size={13} className="shrink-0 text-[var(--text-3)] group-hover:text-[var(--text)]" />}
                  </button>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    lic.status === 'Active' ? 'bg-[var(--success)]/12 text-[#4ade80]' : 'bg-[var(--danger)]/12 text-[#fca5a5]'
                  }`}>
                    {lic.status}
                  </span>
                </div>

                <p className="truncate text-xs text-[var(--text-3)]">{lic.email || '— tanpa email'}</p>
                {created && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-3)]"><Calendar size={10} /> {created}</p>}

                {/* Badges */}
                <div className="mb-3 mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    lic.cc === 'Y' ? 'bg-[var(--accent)]/15 text-[var(--accent-hi)]' : 'bg-[var(--elevated)] text-[var(--text-3)]'
                  }`}>
                    {lic.cc === 'Y' ? 'Premium CC' : 'Standard'}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    lic.hwid ? 'bg-[var(--success)]/12 text-[#4ade80]' : 'bg-[var(--primary)]/15 text-[var(--primary)]'
                  }`}>
                    {lic.hwid ? 'HWID terkunci' : 'HWID kosong'}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--border-soft)] pt-3">
                  <button onClick={() => handleAction(lic, 'resetHwid')} disabled={isActing} className="pressable rounded-lg border border-[var(--border-soft)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50">
                    Reset HWID
                  </button>
                  <button onClick={() => handleAction(lic, 'toggleCC')} disabled={isActing} className="pressable rounded-lg border border-[var(--border-soft)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-hi)] disabled:opacity-50">
                    Toggle CC
                  </button>
                  {lic.status === 'Active' ? (
                    <button onClick={() => handleAction(lic, 'ban')} disabled={isActing} className="pressable rounded-lg border border-[var(--danger)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 disabled:opacity-50">
                      Ban
                    </button>
                  ) : (
                    <button onClick={() => handleAction(lic, 'unban')} disabled={isActing} className="pressable rounded-lg border border-[var(--success)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--success)] transition-colors hover:bg-[var(--success)]/10 disabled:opacity-50">
                      Unban
                    </button>
                  )}
                  <button onClick={() => openResend(lic)} className="pressable ml-auto flex items-center gap-1 rounded-lg bg-[var(--primary)]/15 px-2.5 py-1.5 text-[11px] font-bold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/25">
                    <Send size={12} /> Kirim ulang
                  </button>
                </div>
              </div>
            )
          })}

          {licenses.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 py-12 text-center">
              <KeyRound size={30} className="text-[var(--text-3)]" />
              <p className="text-sm font-semibold text-[var(--text-2)]">Tidak ada lisensi</p>
            </div>
          )}
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

      {/* Resend modal */}
      {resend && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
          <div className="animate-overlay absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setResend(null)} />
          <div className="animate-sheet relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                <Send size={12} className="text-[var(--primary)]" /> Kirim ulang lisensi
              </span>
              <button onClick={() => setResend(null)} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={18} /></button>
            </div>
            <pre className="mono max-h-[50vh] overflow-y-auto whitespace-pre-wrap px-4 py-3 text-[12px] leading-relaxed text-[var(--text-2)]">{resend.message}</pre>
            <div className="border-t border-[var(--border-soft)] p-3">
              <button onClick={copyResend} className="pressable flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-bold text-[var(--primary-fg)] transition hover:brightness-105">
                {copiedMsg ? <><CheckCheck size={15} /> Tersalin — paste ke chat pembeli</> : <><Copy size={15} /> Salin pesan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        tone="danger"
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        loading={isActing}
        onConfirm={confirm?.onConfirm}
        onClose={() => !isActing && setConfirm(null)}
      />
    </div>
  )
}
