'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, KeyRound, AlertCircle, Check, Copy, CheckCheck, Send, X, Calendar } from 'lucide-react'
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
  { key: 'premium', label: 'Premium CC' },
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

export default function Sims4LicensesTab({ onSelectEmail }) {
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
  const [mounted, setMounted]   = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => { setMounted(true) }, [])

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
        description: `Lisensi ${lic.invoice} (${lic.email || 'tanpa email'}) akan di-ban dan tidak bisa dipakai login. Anda bisa unban lagi nanti.`,
        confirmLabel: 'Ya, ban',
        onConfirm: () => runAction(lic.invoice, 'ban'),
      })
    } else if (action === 'resetHwid') {
      setConfirm({
        title: 'Reset HWID?',
        description: `HWID untuk lisensi ${lic.invoice} akan dikosongkan. Customer dapat mengikat ulang perangkat saat login berikutnya.`,
        confirmLabel: 'Ya, reset HWID',
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
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Lisensi" value={stats.total} icon={KeyRound} accent="#ffd100" />
        <StatCard label="Aktif" value={stats.active} sub="Berjalan normal" subColor="text-[#4ade80]" icon={Check} accent="#22c55e" />
        <StatCard label="Premium CC" value={stats.premium} sub={`${stats.standard} standard`} icon={KeyRound} accent="#a78bfa" />
        <StatCard label="HWID Kosong" value={stats.hwidEmpty} sub="Belum login" subColor="text-[var(--text-3)]" icon={KeyRound} accent="#60a5fa" />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder="Cari email pembeli atau nomor invoice Shopee..."
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-2.5 pl-11 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilter(f.key)}
              className={`pressable rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm'
                  : 'border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--border-strong)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action Message */}
      {actionMsg && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            actionMsg.type === 'success'
              ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[#4ade80]'
              : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[#fca5a5]'
          }`}
        >
          {actionMsg.type === 'success' ? (
            <Check size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          {actionMsg.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--text-3)]">
          {total} Lisensi {query || filter !== 'all' ? 'Ditemukan' : 'Terdaftar'}
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <p className="text-sm text-[var(--text-3)]">Memuat daftar lisensi…</p>
        </div>
      )}

      {/* Grid Kartu Lisensi */}
      {!isLoading && (
        <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {licenses.map((lic, i) => {
            const created = fmtDate(lic.createdAt)
            const isLocked = !!(lic.hwid || (Array.isArray(lic.hwids) && lic.hwids.length > 0))
            return (
              <div
                key={lic._id || i}
                className="flex flex-col justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 transition-all hover:border-[var(--primary)]/40 hover:shadow-md"
              >
                <div>
                  {/* Header Card */}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => copyKey(lic.invoice)}
                      className="group flex min-w-0 items-center gap-1.5 text-left"
                      title="Salin License Key"
                    >
                      <span className="mono truncate text-sm font-bold text-[var(--primary)]">
                        {lic.invoice}
                      </span>
                      {copiedKey === lic.invoice ? (
                        <CheckCheck size={13} className="shrink-0 text-[var(--success)]" />
                      ) : (
                        <Copy
                          size={13}
                          className="shrink-0 text-[var(--text-3)] group-hover:text-[var(--text)]"
                        />
                      )}
                    </button>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        lic.status === 'Active'
                          ? 'bg-[var(--success)]/12 text-[#4ade80]'
                          : 'bg-[var(--danger)]/12 text-[#fca5a5]'
                      }`}
                    >
                      {lic.status}
                    </span>
                  </div>

                  {lic.email ? (
                    <button
                      type="button"
                      onClick={() => onSelectEmail?.(lic.email)}
                      className="truncate text-xs font-semibold text-[var(--text-2)] hover:text-[var(--primary)] hover:underline text-left"
                      title="Buka profil pelanggan ini"
                    >
                      {lic.email}
                    </button>
                  ) : (
                    <p className="truncate text-xs text-[var(--text-3)] italic">— Lisensi tanpa email</p>
                  )}

                  {created && (
                    <p className="mt-1 flex items-center gap-1 text-[10.5px] text-[var(--text-3)]">
                      <Calendar size={11} /> Dibuat: {created}
                    </p>
                  )}

                  {/* Status Badges */}
                  <div className="mb-3 mt-2.5 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                        lic.cc === 'Y'
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          : 'bg-[var(--elevated)] text-[var(--text-3)] border border-[var(--border-soft)]'
                      }`}
                    >
                      {lic.cc === 'Y' ? '💎 Premium CC' : '🎮 Standard'}
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                        isLocked
                          ? 'bg-[var(--success)]/12 text-[#4ade80] border border-[var(--success)]/30'
                          : 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30'
                      }`}
                    >
                      {isLocked ? '🔒 HWID Terkunci' : '🔓 HWID Kosong'}
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-soft)] pt-3">
                  <button
                    type="button"
                    onClick={() => handleAction(lic, 'resetHwid')}
                    disabled={isActing}
                    className="pressable rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
                  >
                    Reset HWID
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(lic, 'toggleCC')}
                    disabled={isActing}
                    className="pressable rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] transition hover:border-purple-400 hover:text-purple-300 disabled:opacity-50"
                  >
                    {lic.cc === 'Y' ? 'Jadikan Std' : 'Jadikan CC'}
                  </button>
                  {lic.status === 'Active' ? (
                    <button
                      type="button"
                      onClick={() => handleAction(lic, 'ban')}
                      disabled={isActing}
                      className="pressable rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--danger)] transition hover:bg-[var(--danger)]/20 disabled:opacity-50"
                    >
                      Ban
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction(lic, 'unban')}
                      disabled={isActing}
                      className="pressable rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--success)] transition hover:bg-[var(--success)]/20 disabled:opacity-50"
                    >
                      Unban
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openResend(lic)}
                    className="pressable ml-auto flex items-center gap-1 rounded-xl bg-[var(--primary)]/15 px-2.5 py-1 text-[11px] font-bold text-[var(--primary)] transition hover:bg-[var(--primary)]/25"
                  >
                    <Send size={11} /> Kirim Ulang
                  </button>
                </div>
              </div>
            )
          })}

          {licenses.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 py-12 text-center">
              <KeyRound size={32} className="text-[var(--text-3)]" />
              <p className="text-sm font-semibold text-[var(--text-2)]">Tidak ada lisensi ditemukan</p>
              <p className="text-xs text-[var(--text-3)]">Coba ubah kata kunci atau filter</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="pressable rounded-xl border border-[var(--border-soft)] px-4 py-2 text-xs font-semibold text-[var(--text-2)] transition hover:border-[var(--border-strong)] disabled:opacity-50"
          >
            ← Prev
          </button>
          <p className="text-xs text-[var(--text-3)]">
            Halaman {page} dari {Math.ceil(total / 20)}
          </p>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="pressable rounded-xl border border-[var(--border-soft)] px-4 py-2 text-xs font-semibold text-[var(--text-2)] transition hover:border-[var(--border-strong)] disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}

      {/* Resend Modal */}
      {mounted &&
        resend &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
            <div
              className="animate-overlay absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setResend(null)}
            />
            <div className="animate-sheet relative w-full max-w-[460px] overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-3.5 bg-[var(--elevated)]/40">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                  <Send size={13} className="text-[var(--primary)]" /> Pesan Balasan The Sims 4
                </span>
                <button
                  type="button"
                  onClick={() => setResend(null)}
                  className="rounded-lg p-1 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--elevated)]"
                >
                  <X size={18} />
                </button>
              </div>
              <pre className="mono max-h-[50vh] overflow-y-auto whitespace-pre-wrap p-5 text-xs leading-relaxed text-[var(--text-2)] bg-[var(--surface)]">
                {resend.message}
              </pre>
              <div className="border-t border-[var(--border-soft)] p-4 bg-[var(--elevated)]/20">
                <button
                  type="button"
                  onClick={copyResend}
                  className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] transition hover:brightness-105 shadow-md shadow-[var(--primary)]/20"
                >
                  {copiedMsg ? (
                    <>
                      <CheckCheck size={16} /> Tersalin! Siap dipaste ke Shopee / WA
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> Salin Pesan Balasan Chat
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirm Dialog */}
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
