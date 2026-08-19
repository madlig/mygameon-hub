import { Suspense } from 'react'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'
import { Clock, Folder, Hourglass, KeyRound, ReceiptText, Search, Send, Users, Sparkles, AlertTriangle, TrendingUp, ShieldAlert, Star, Activity, Terminal } from 'lucide-react'
import connectToDatabase from '@/lib/db'
import Sims4License from '@/models/Sims4License'
import AccessLog from '@/models/AccessLog'
import Customer from '@/models/Customer'
import WorkspaceAccount from '@/models/WorkspaceAccount'
import SalesAnalyticsModal from '@/components/dashboard/SalesAnalyticsModal'

export const dynamic = 'force-dynamic'

const allApps = [
  { icon: Search, label: 'Katalog', desc: 'Pencarian Game', href: '/search', accent: '#fbbf24' },
  { icon: Sparkles, label: 'Sims 4', desc: 'Order Game', href: '/sims4/order', accent: '#c084fc' },
  { icon: Users, label: 'CRM', desc: 'Data Pelanggan', href: '/revoke', accent: '#60a5fa' },
  { icon: Clock, label: 'Log', desc: 'Riwayat Kirim', href: '/log', accent: '#9ca3af' },
  { icon: Folder, label: 'Drive', desc: 'Status Kapasitas', href: '/drive-status', accent: '#3b82f6' },
  { icon: ShieldAlert, label: 'Cek File', desc: 'Folder Game', href: '/check', accent: '#38bdf8' },
  { icon: Terminal, label: 'Lisensi', desc: 'DB Hardware', href: '/sims4/licenses', accent: '#a78bfa' },
  { icon: KeyRound, label: 'Akun', desc: 'Whitelist Email', href: '/accounts', accent: '#f59e0b' },
]

function formatTime(timeStr) {
  if (!timeStr) return '-'
  try {
    const diff = Date.now() - new Date(timeStr).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    if (minutes < 1) return 'Baru saja'
    if (minutes < 60) return `${minutes} mnt lalu`
    if (hours < 24) return `${hours} jam lalu`
    return new Date(timeStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  } catch {
    return '-'
  }
}

async function getDashboardStats() {
  try {
    await connectToDatabase()

    const now = new Date()
    const startOfDay = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
    startOfDay.setHours(0, 0, 0, 0)
    
    // 1. Fetch Today's Data
    const todayAccess = await AccessLog.find({ grantedAt: { $gte: startOfDay } }).lean()
    const todaySims = await Sims4License.find({ createdAt: { $gte: startOfDay } }).lean()

    const todayOrdersSet = new Set(todayAccess.map(a => a.email))
    const todayOrders = todayOrdersSet.size + todaySims.length
    const todayGames = todayAccess.filter(a => !a.isBonus).length + todaySims.length

    // 2. Fetch Aggregates
    const activeLicenses = await Sims4License.countDocuments({ status: 'Active' })
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    const expiringSoon = await AccessLog.countDocuments({ status: 'active', expiresAt: { $gte: now, $lte: twoDaysFromNow } })
    const expiredToRevoke = await AccessLog.countDocuments({ status: 'active', expiresAt: { $lt: now } })

    // 3. Smart Insights Generation
    const insights = []
    
    // Insight A: Workspace Storage
    const workspaces = await WorkspaceAccount.find({ status: 'active' }).lean()
    const criticalDrives = workspaces.filter(w => w.storage && (w.storage.usageGB / w.storage.limitGB) > 0.9)
    if (criticalDrives.length > 0) {
      insights.push({
        type: 'danger', icon: AlertTriangle,
        title: 'Kapasitas Kritis',
        text: `Akun ${criticalDrives[0].email} hampir penuh (${(criticalDrives[0].storage.usageGB / criticalDrives[0].storage.limitGB * 100).toFixed(1)}%). Segera lakukan pembersihan.`
      })
    }

    // Insight B: Revoke Needed
    if (expiredToRevoke > 0) {
      insights.push({
        type: 'warning', icon: ShieldAlert,
        title: 'Tindakan Keamanan',
        text: `Terdapat ${expiredToRevoke} akses game pelanggan (kadaluarsa) yang perlu segera di-revoke hari ini.`
      })
    }

    // Insight C: Trending Game (Aggregation)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const topGames = await AccessLog.aggregate([
      { $match: { grantedAt: { $gte: thirtyDaysAgo }, isBonus: false } },
      { $group: { _id: "$gameName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ])
    if (topGames.length > 0 && topGames[0].count > 3) {
      insights.push({
        type: 'info', icon: TrendingUp,
        title: 'Tren Sistem',
        text: `Game "${topGames[0]._id}" terjual ${topGames[0].count}x bulan ini. Pantau aktivitas Google Drive agar terhindar dari limit.`
      })
    }

    // Insight D: VIP Customers
    const topCustomer = await Customer.findOne({ status: 'active' }).sort({ orderCount: -1 }).lean()
    if (topCustomer && topCustomer.orderCount >= 5) {
      insights.push({
        type: 'success', icon: Star,
        title: 'Sinyal Loyalitas',
        text: `Pelanggan ${topCustomer.email} telah mengorder ${topCustomer.orderCount}x sejauh ini. Pertimbangkan penawaran VIP.`
      })
    }

    // 4. Recent Logs (Combined)
    const recentAccess = await AccessLog.find().sort({ grantedAt: -1 }).limit(7).lean()
    const recentSims = await Sims4License.find().sort({ createdAt: -1 }).limit(7).lean()
    
    const combinedLogs = [
      ...recentAccess.map(a => ({ type: 'general', email: a.email, product: a.gameName, time: a.grantedAt, isBonus: a.isBonus })),
      ...recentSims.map(s => ({ type: 'sims4', email: s.email, product: `Sims 4 - ${s.cc === 'Y' ? 'Premium CC' : 'Standard'}`, time: s.createdAt, isBonus: false }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8)

    return { success: true, todayOrders, todayGames, activeLicenses, expiringSoon, insights: insights.slice(0, 4), recentLogs: combinedLogs, genTime: now.toLocaleTimeString('id-ID') }
  } catch (e) {
    console.error('Dashboard stats error:', e)
    return { todayOrders: 0, todayGames: 0, activeLicenses: 0, expiringSoon: 0, insights: [], recentLogs: [], genTime: '' }
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="fadeUp h-full flex flex-col">
      <TopBar title="Dashboard" />

      {/* Header Compact */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 mt-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">Selamat Datang Kembali 👋</p>
          <h2 className="font-display mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--text)]">
            Hari ini <span className="gradient-text">{stats.todayOrders} order</span> masuk.
          </h2>
        </div>
        <div className="shrink-0">
          <SalesAnalyticsModal />
        </div>
      </div>

      {/* Stats Cards Compact */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Order Hari Ini', val: stats.todayOrders, sub: 'Transaksi sukses', icon: ReceiptText, c: '#fbbf24' },
          { label: 'Game Terkirim', val: stats.todayGames, sub: 'Tanpa bonus', icon: Send, c: '#60a5fa' },
          { label: 'Lisensi Aktif', val: stats.activeLicenses, sub: 'The Sims 4', icon: KeyRound, c: '#c084fc' },
          { label: 'Akan Expired', val: stats.expiringSoon, sub: '< 48 Jam', icon: Hourglass, c: stats.expiringSoon > 0 ? '#ef4444' : '#10b981' }
        ].map((m, i) => (
          <div key={i} className="group relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]">
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.03] transition-transform group-hover:scale-150" style={{ background: `radial-gradient(circle, ${m.c} 0%, transparent 70%)` }} />
            <div className="relative z-10 flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">{m.label}</p>
              <m.icon size={14} style={{ color: m.c }} />
            </div>
            <p className="relative z-10 text-2xl font-black text-[var(--text)] leading-none">{m.val}</p>
            <p className="relative z-10 mt-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-4)]">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-6 items-start flex-1">
        
        {/* Left Column: Insights & Quick Actions */}
        <div className="flex flex-col gap-6">
          
          {/* Dynamic Insights Terminal Style */}
          {stats.insights && stats.insights.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-strong)] bg-black/40 p-1 overflow-hidden font-mono shadow-inner relative">
              {/* Terminal Header */}
              <div className="flex items-center justify-between border-b border-white/5 bg-black/20 px-4 py-2">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-[var(--text-3)]" />
                  <span className="text-[10px] font-bold tracking-wider text-[var(--text-3)] uppercase">MyGameON :: Analytics Engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[var(--text-4)]">Last scan: {stats.genTime}</span>
                  <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
                </div>
              </div>
              
              {/* Terminal Body */}
              <div className="p-4 space-y-3">
                {stats.insights.map((insight, i) => {
                  const colors = {
                    danger: 'text-red-400', warning: 'text-amber-400',
                    info: 'text-blue-400', success: 'text-green-400'
                  }
                  return (
                    <div key={i} className="flex gap-3 text-xs animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${i * 150}ms`, animationFillMode: 'both' }}>
                      <span className="text-[var(--text-4)] shrink-0 opacity-50">&gt;</span>
                      <div>
                        <span className={`font-bold ${colors[insight.type]} uppercase tracking-wider`}>[{insight.title}]</span>
                        <span className="text-[var(--text-2)] ml-2 leading-relaxed">{insight.text}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Scanning scanline effect */}
              <div className="pointer-events-none absolute inset-0 z-10 h-full w-full bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
            </div>
          )}

          {/* App Grid (Full Menu) */}
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 md:p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-4 ml-1">Menu Aplikasi</h3>
            <div className="grid grid-cols-4 gap-y-5 gap-x-2 sm:grid-cols-4 lg:grid-cols-4">
              {allApps.map((app) => {
                const Icon = app.icon
                return (
                  <Link
                    key={app.href} href={app.href}
                    className="group flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-all group-hover:shadow-md" style={{ background: `linear-gradient(135deg, ${app.accent}20 0%, ${app.accent}40 100%)`, color: app.accent, border: `1px solid ${app.accent}30` }}>
                      <Icon size={24} strokeWidth={2} />
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-[var(--text-2)] text-center leading-tight">{app.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Feed */}
        <div className="flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--elevated)] px-4 py-3 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
              <Activity size={14} className="text-[var(--primary)]" />
              Live Activity Feed
            </h3>
            <Link href="/log" className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-3)] hover:text-[var(--text)] transition-colors">Semua</Link>
          </div>
          
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 max-h-[400px]">
            {stats.recentLogs.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-center text-[var(--text-3)]">
                <p className="text-xs font-medium">Belum ada aktivitas</p>
              </div>
            ) : (
              stats.recentLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[var(--elevated)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${log.isBonus ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : log.type === 'sims4' ? 'bg-[#c084fc]/15 text-[#c084fc]' : 'bg-[var(--primary)]/15 text-[var(--primary)]'}`}>
                      {log.isBonus ? 'B' : log.type === 'sims4' ? 'S' : 'G'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--text)]">{log.email}</p>
                      <p className="truncate text-[10px] text-[var(--text-3)] mt-0.5">{log.product}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[var(--text-4)]">{formatTime(log.time)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
