'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'

export default function Sims4LicensesPage() {
  const [licenses, setLicenses] = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [query, setQuery]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)

  async function fetchLicenses(q = query, p = page) {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/sims4/licenses?q=${encodeURIComponent(q)}&page=${p}`)
      const data = await res.json()
      setLicenses(data.licenses || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLicenses()
  }, [page])

  function handleSearch(e) {
    const val = e.target.value
    setQuery(val)
    setPage(1)
    fetchLicenses(val, 1)
  }

  async function handleAction(invoice, action) {
    setActionMsg(null)
    try {
      const res = await fetch('/api/sims4/licenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice, action }),
      })
      const data = await res.json()
      if (data.success) {
        const labels = {
          resetHwid: 'HWID berhasil direset',
          toggleCC: 'CC berhasil diubah',
          ban: 'Lisensi berhasil di-ban',
          unban: 'Lisensi berhasil di-unban',
        }
        setActionMsg({ type: 'success', text: `✅ ${labels[action]}` })
        fetchLicenses()
      } else {
        setActionMsg({ type: 'error', text: `❌ ${data.error}` })
      }
    } catch (e) {
      setActionMsg({ type: 'error', text: '❌ Terjadi kesalahan.' })
    }
  }

  return (
    <div>
      <TopBar title="Kelola lisensi" />

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder="Cari email atau invoice..."
          className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          actionMsg.type === 'success'
            ? 'border-green-500/30 bg-green-500/10 text-green-500'
            : 'border-red-500/30 bg-red-500/10 text-red-500'
        }`}>
          {actionMsg.text}
        </div>
      )}

      {/* Total */}
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
        {total} lisensi {query ? 'ditemukan' : 'total'}
      </p>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      )}

      {/* License list */}
      {!isLoading && (
        <div className="flex flex-col gap-3 mb-6">
          {licenses.map((lic, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <p className="font-mono text-sm text-blue-400">{lic.invoice}</p>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  lic.status === 'Active'
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  {lic.status}
                </span>
              </div>

              {/* Email */}
              <p className="text-xs text-muted-foreground mb-2">{lic.email}</p>

              {/* Badges */}
              <div className="flex gap-2 flex-wrap mb-3">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  lic.cc === 'Y'
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {lic.cc === 'Y' ? 'Premium CC' : 'Standard'}
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  lic.hwid
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {lic.hwid ? 'HWID terkunci' : 'HWID kosong'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleAction(lic.invoice, 'resetHwid')}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  Reset HWID
                </button>
                <button
                  onClick={() => handleAction(lic.invoice, 'toggleCC')}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  Toggle CC
                </button>
                {lic.status === 'Active' ? (
                  <button
                    onClick={() => handleAction(lic.invoice, 'ban')}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Ban
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction(lic.invoice, 'unban')}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-green-500 text-green-500 hover:bg-green-500/10 transition-colors"
                  >
                    Unban
                  </button>
                )}
              </div>
            </div>
          ))}

          {licenses.length === 0 && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="text-3xl">🔑</span>
              <p className="text-sm font-medium text-muted-foreground">Tidak ada lisensi</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground disabled:opacity-50 hover:bg-secondary transition-colors"
          >
            ← Prev
          </button>
          <p className="text-xs text-muted-foreground">
            Hal {page} dari {Math.ceil(total / 20)}
          </p>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground disabled:opacity-50 hover:bg-secondary transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}