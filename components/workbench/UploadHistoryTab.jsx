'use client'

import { useState, useMemo } from 'react'
import { Clock, Search, Cloud, RefreshCw, HardDrive, CheckCircle2 } from 'lucide-react'
import { formatBytes } from '@/lib/utils'

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '-'
  }
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

export default function UploadHistoryTab({
  history = [],
  loading = false,
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history
    const q = searchQuery.toLowerCase()
    return history.filter(
      (item) =>
        (item.gameName || '').toLowerCase().includes(q) ||
        (item.workspaceEmail || '').toLowerCase().includes(q)
    )
  }, [history, searchQuery])

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="rounded-2xl border border-white/5 bg-[var(--surface)] shadow-xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-col gap-3 border-b border-white/5 bg-[#0a0b0f] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">
                Riwayat Unggahan Game ({history.length})
              </h3>
              <p className="text-[10px] text-[var(--text-4)]">
                Daftar game yang telah berhasil diunggah ke Google Drive
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari di riwayat..."
                className="rounded-xl border border-white/10 bg-black/40 pl-8 pr-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-blue-400 focus:outline-none w-48 sm:w-64"
              />
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-xl border border-white/10 bg-white/5 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Perbarui riwayat"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-400' : ''} />
            </button>
          </div>
        </div>

        {/* Content Table */}
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--text-4)]">
            {searchQuery ? 'Tidak ada riwayat yang cocok dengan pencarian.' : 'Belum ada riwayat unggahan game.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">
                  <th className="py-3 px-5">Nama Game</th>
                  <th className="py-3 px-4">Workspace Google Drive</th>
                  <th className="py-3 px-4">Part File</th>
                  <th className="py-3 px-4">Total Ukuran</th>
                  <th className="py-3 px-5 text-right">Waktu Upload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredHistory.map((item) => (
                  <tr key={item._id || item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 font-bold text-[var(--text)]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span>{item.gameName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[var(--text-3)] text-[11px]">
                      {item.workspaceEmail}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[var(--text-2)]">
                      {item.fileCount ? `${item.fileCount} Part` : '-'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[var(--primary)]">
                      {formatBytes(item.totalSize || 0)}
                    </td>
                    <td className="py-3.5 px-5 text-right text-[var(--text-4)] font-mono text-[11px]">
                      {fmtDate(item.uploadedAt || item.createdAt)} {fmtTime(item.uploadedAt || item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
