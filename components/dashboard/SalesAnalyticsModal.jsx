'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, Calendar, Trophy, User, ArrowRight, Loader2, PieChart } from 'lucide-react'

export default function SalesAnalyticsModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  
  const [dateRange, setDateRange] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, dateRange])

  async function fetchData() {
    setLoading(true)
    try {
      const now = new Date()
      let start = new Date()
      let end = new Date()

      if (dateRange === 'today') {
        start.setHours(0,0,0,0)
      } else if (dateRange === 'week') {
        start.setDate(now.getDate() - 7)
      } else if (dateRange === 'month') {
        start.setMonth(now.getMonth() - 1)
      } else if (dateRange === 'custom') {
        if (!customStart || !customEnd) {
          setLoading(false)
          return
        }
        start = new Date(customStart)
        end = new Date(customEnd)
      }

      const res = await fetch(`/api/analytics/sales?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
      const json = await res.json()
      if (json.success) {
        setData(json)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="pressable flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-fg)] transition-all hover:brightness-110 shadow-[0_4px_20px_-5px_rgba(255,209,0,0.3)]"
      >
        <TrendingUp size={16} /> Analisis Performa Penjualan
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 fadeUp">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl">
            {/* Header Modal */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--elevated)]/90 backdrop-blur-md px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
                  <PieChart size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text)]">Performa Penjualan</h2>
                  <p className="text-xs font-medium text-[var(--text-3)]">Executive Analytics Dashboard</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-2 text-[var(--text-3)] hover:bg-[var(--border-soft)] hover:text-[var(--text)] transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {/* Filter Row */}
              <div className="mb-8 flex flex-wrap items-end gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--elevated)] p-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--text-3)]"><Calendar size={12} className="inline mr-1"/> Rentang Waktu</label>
                  <select 
                    value={dateRange} 
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]"
                  >
                    <option value="today">Hari Ini (24 Jam)</option>
                    <option value="week">7 Hari Terakhir</option>
                    <option value="month">30 Hari Terakhir</option>
                    <option value="custom">Pilih Tanggal Kustom...</option>
                  </select>
                </div>

                {dateRange === 'custom' && (
                  <>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--text-3)]">Mulai</label>
                      <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--text-3)]">Akhir</label>
                      <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]" />
                    </div>
                    <button onClick={fetchData} className="rounded-xl bg-[var(--text)] px-4 py-2.5 text-sm font-bold text-[var(--surface)] transition hover:opacity-80">
                      Terapkan
                    </button>
                  </>
                )}
              </div>

              {loading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-4 text-[var(--text-3)]">
                  <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
                  <p className="text-sm font-medium animate-pulse">Menghitung analitik dari database...</p>
                </div>
              ) : !data || data.summary.totalOrders === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--elevated)] text-[var(--text-4)]">
                    <TrendingUp size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-2)]">Tidak Ada Data</h3>
                  <p className="mt-1 max-w-sm text-sm text-[var(--text-3)]">Tidak ada transaksi penjualan yang tercatat pada rentang waktu yang Anda pilih.</p>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Summary Cards */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--primary)]/30 bg-gradient-to-br from-[var(--primary)]/10 to-transparent p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-2)] opacity-80">Total Transaksi</p>
                      <p className="mt-2 text-4xl font-black text-[var(--text)]">{data.summary.totalOrders}</p>
                      <p className="mt-2 text-xs font-medium text-[var(--text-3)]">Dalam periode terpilih</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--elevated)] p-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-3)]">Game Terjual (Berbayar)</p>
                      <p className="mt-2 text-4xl font-black text-[var(--text)]">{data.summary.paidCount}</p>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--border-strong)] overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${100 - data.summary.bonusRatio}%` }} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--elevated)] p-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-3)]">Game Bonus Diberikan</p>
                      <p className="mt-2 text-4xl font-black text-[var(--text)]">{data.summary.bonusCount}</p>
                      <p className="mt-2 text-xs font-medium text-[var(--text-3)]"><span className="text-[var(--accent)] font-bold">{data.summary.bonusRatio}%</span> dari total transaksi</p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Top Games */}
                    <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-sm">
                      <div className="mb-4 flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
                        <Trophy size={18} className="text-[#fbbf24]" />
                        <h3 className="font-bold text-[var(--text)]">Game Paling Laris</h3>
                      </div>
                      <div className="space-y-4">
                        {data.topGames.map((game, i) => {
                          const maxCount = data.topGames[0].count
                          const pct = Math.round((game.count / maxCount) * 100)
                          return (
                            <div key={i}>
                              <div className="mb-1 flex items-center justify-between text-sm">
                                <span className="font-semibold text-[var(--text)] truncate pr-4">{i + 1}. {game.name}</span>
                                <span className="font-bold text-[var(--primary)]">{game.count}x</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-[var(--elevated)] overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[var(--primary)] to-[#fbbf24] rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Top Customers */}
                    <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-sm">
                      <div className="mb-4 flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
                        <User size={18} className="text-[#3b82f6]" />
                        <h3 className="font-bold text-[var(--text)]">Pelanggan Paling Aktif (Top Spender)</h3>
                      </div>
                      <div className="space-y-3">
                        {data.topCustomers.map((cust, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-2.5 transition hover:border-[var(--border-strong)]">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[10px] font-black text-[var(--text-3)] border border-[var(--border-soft)]">
                              #{i + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-[var(--text)]">{cust.email}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-black text-[#3b82f6]">{cust.count}</p>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-4)]">Order</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
