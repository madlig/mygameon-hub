'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'

const FILTERS = [
  { key: 'all',     label: 'Semua'      },
  { key: 'general', label: 'General'    },
  { key: 'sims4',   label: 'Sims 4'     },
  { key: 'today',   label: 'Hari ini'   },
  { key: 'week',    label: 'Minggu ini' },
]

export default function LogPage() {
  const [logs, setLogs]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [filter, setFilter]   = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function fetchLogs(f = filter, p = page) {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/log?filter=${f}&page=${p}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || `Error ${res.status}`)
        setLogs([])
        return
      }
      const data = await res.json()
      setError(null)
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (e) {
      setError('Gagal terhubung ke server')
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, filter])

  function handleFilter(f) {
    setFilter(f)
    setPage(1)
  }

  function formatTime(timeStr) {
    if (!timeStr) return '-'
    const d = new Date(timeStr)
    if (isNaN(d.getTime())) return timeStr
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      <TopBar title="Log & history" />

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => handleFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:bg-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Total */}
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
        {total} entri
      </p>

      {/* Error */}
      {error && !isLoading && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          Gagal memuat log: {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      )}

      {/* Log list */}
      {!isLoading && (
        <div className="flex flex-col gap-2 mb-6">
          {logs.map((log, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{log.email}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{log.product}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatTime(log.time)}
                  {log.type === 'sims4' && log.source && ` · #${log.source}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  log.type === 'sims4'
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {log.type === 'sims4' ? 'Sims 4' : 'General'}
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  log.status === 'Terkirim' || log.status === 'Active'
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  {log.status}
                </span>
              </div>
            </div>
          ))}

          {logs.length === 0 && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="text-3xl">📋</span>
              <p className="text-sm font-medium text-muted-foreground">Belum ada log</p>
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
            className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground disabled:opacity-50 hover:bg-secondary"
          >
            ← Prev
          </button>
          <p className="text-xs text-muted-foreground">
            Hal {page} dari {Math.ceil(total / 20)}
          </p>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground disabled:opacity-50 hover:bg-secondary"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}