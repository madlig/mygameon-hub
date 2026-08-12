'use client'

import { useState, useEffect } from 'react'
import { HardDrive, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'

export default function DriveStatusPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      // Add random query param to prevent browser caching when manually refreshing
      const res = await fetch('/api/drive/status?t=' + Date.now())
      if (!res.ok) throw new Error('Gagal mengambil data status Drive')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Status Google Drive" />

      <div className="flex-1 overflow-y-auto px-[var(--pad-card)] pb-[var(--pad-card)]">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">Pantau Kuota Download</h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Status limitasi per email workspace secara real-time.
            </p>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[var(--primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Menyinkronkan...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* SUMMARY CARDS */}
        {data && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex items-center gap-3 text-[var(--text-2)]">
                <HardDrive size={18} />
                <span className="text-sm font-medium">Total Workspace</span>
              </div>
              <div className="mt-3 text-3xl font-bold text-[var(--text)]">
                {data.workspaces?.length || 0}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex items-center gap-3 text-[var(--text-2)]">
                <CheckCircle2 size={18} className="text-[#10b981]" />
                <span className="text-sm font-medium">Workspace Aman</span>
              </div>
              <div className="mt-3 text-3xl font-bold text-[#10b981]">
                {(data.workspaces?.length || 0) - (data.limited?.length || 0)}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm relative overflow-hidden">
              <div className={`absolute inset-0 opacity-10 ${data.limited?.length > 0 ? 'bg-red-500 animate-pulse' : ''}`} />
              <div className="relative flex items-center gap-3 text-[var(--text-2)]">
                <AlertTriangle size={18} className={data.limited?.length > 0 ? 'text-red-500' : ''} />
                <span className="text-sm font-medium">Terkena Limit</span>
              </div>
              <div className={`relative mt-3 text-3xl font-bold ${data.limited?.length > 0 ? 'text-red-500' : 'text-[var(--text)]'}`}>
                {data.limited?.length || 0}
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACES TABLE */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <div className="border-b border-[var(--border-soft)] bg-[var(--elevated)] px-5 py-4">
            <h3 className="font-semibold text-[var(--text)]">Detail per Email Workspace</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--elevated)]/50 text-[var(--text-2)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Email Workspace</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-center">Total Game</th>
                  <th className="px-5 py-3 font-medium text-center">Game Ter-limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {loading && !data ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-8 text-center text-[var(--text-3)]">
                      Memuat data dari Google Drive...
                    </td>
                  </tr>
                ) : data?.workspaces?.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-8 text-center text-[var(--text-3)]">
                      Belum ada file di folder utama.
                    </td>
                  </tr>
                ) : (
                  data?.workspaces?.map((ws) => (
                    <tr key={ws.email} className="transition-colors hover:bg-[var(--elevated)]/30">
                      <td className="px-5 py-4 font-medium text-[var(--text)]">{ws.email}</td>
                      <td className="px-5 py-4">
                        {ws.status === 'limit' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-500">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                            LIMIT TERDETEKSI
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/10 px-2.5 py-1 text-xs font-medium text-[#10b981]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                            Aman
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center font-medium text-[var(--text-2)]">
                        {ws.totalFiles}
                      </td>
                      <td className="px-5 py-4 text-center font-medium">
                        <span className={ws.limitedFiles > 0 ? 'text-red-500 font-bold' : 'text-[var(--text-3)]'}>
                          {ws.limitedFiles > 0 ? ws.limitedFiles : '-'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
