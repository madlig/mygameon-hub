import { Suspense } from 'react'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'
import {
  Clock, Folder, Hourglass, KeyRound, ReceiptText, Search, Send, Users,
  Sparkles, AlertTriangle, TrendingUp, ShieldAlert, Star, Activity, Terminal,
  Gamepad2, ShoppingBag, ArrowRight, Cloud, DownloadCloud, HardDrive,
  CheckCircle2, Globe, ShoppingCart, Layers
} from 'lucide-react'
import connectToDatabase from '@/lib/db'
import Sims4License from '@/models/Sims4License'
import AccessLog from '@/models/AccessLog'
import Customer from '@/models/Customer'
import WorkspaceAccount from '@/models/WorkspaceAccount'
import GameCatalog from '@/models/GameCatalog'
import SalesAnalyticsModal from '@/components/dashboard/SalesAnalyticsModal'
import { formatBytes } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const allApps = [
  { icon: Gamepad2, label: 'Meja Kerja', desc: 'Staging, Ekstrak & Upload', href: '/workbench', accent: '#fb923c' },
  { icon: Sparkles, label: 'Listing Studio', desc: 'AI Copywriting & Slides', href: '/scout', accent: '#ec4899' },
  { icon: DownloadCloud, label: 'Download Hub', desc: 'Monitoring Unduhan', href: '/download', accent: '#38bdf8' },
  { icon: ShoppingCart, label: 'Kasir & Katalog', desc: 'Pencarian & Kirim Game', href: '/search', accent: '#fbbf24' },
  { icon: Users, label: 'CRM & Lisensi', desc: 'Akses Drive & Sims 4', href: '/revoke', accent: '#60a5fa' },
  { icon: Folder, label: 'File Manager', desc: 'Jelajah Folder Drive', href: '/files', accent: '#a855f7' },
  { icon: Cloud, label: 'Drive & Akun', desc: 'Kapasitas & Workspace', href: '/accounts', accent: '#10b981' },
  { icon: Clock, label: 'Log Transaksi', desc: 'Riwayat Pengiriman', href: '/log', accent: '#9ca3af' },
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

    // 1. Fetch Today's Orders & Fulfillment
    const todayAccess = await AccessLog.find({ grantedAt: { $gte: startOfDay } }).lean()
    const todaySims = await Sims4License.find({ createdAt: { $gte: startOfDay } }).lean()

    const todayOrdersSet = new Set(todayAccess.map(a => a.email))
    const todayOrders = todayOrdersSet.size + todaySims.length
    const todayGames = todayAccess.filter(a => !a.isBonus).length + todaySims.length

    // 2. Fetch Aggregates CRM & Licenses
    const activeLicenses = await Sims4License.countDocuments({ status: 'Active' })
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    const expiringSoon = await AccessLog.countDocuments({ status: 'active', expiresAt: { $gte: now, $lte: twoDaysFromNow } })
    const expiredToRevoke = await AccessLog.countDocuments({ status: 'active', expiresAt: { $lt: now } })

    // 3. Catalog & Cloud Storage (Ground Truth)
    const totalCatalogGames = await GameCatalog.countDocuments()
    const activeWorkspacesCount = await WorkspaceAccount.countDocuments({ status: 'active' })

    const storageAgg = await GameCatalog.aggregate([
      { $group: { _id: "$ownerEmail", totalBytes: { $sum: "$totalSize" }, count: { $sum: 1 } } },
      { $sort: { totalBytes: -1 } }
    ])

    const totalStorageBytes = storageAgg.reduce((acc, curr) => acc + (curr.totalBytes || 0), 0)
    const totalStorageTB = (totalStorageBytes / (1024 ** 4)).toFixed(2)

    // 4. Shopee Listing & Website Storefront Status
    const shopeeListedCount = await GameCatalog.countDocuments({ shopeeListed: true })
    const unlistedCount = await GameCatalog.countDocuments({ shopeeListed: { $ne: true } })
    const websitePublishedCount = await GameCatalog.countDocuments({ isPublished: true })

    // 5. Smart Insights Generation
    const insights = []

    // Insight A: Workspace Storage Health
    if (storageAgg.length > 0) {
      const heaviestWorkspace = storageAgg[0]
      const heaviestGB = (heaviestWorkspace.totalBytes / (1024 ** 3)).toFixed(1)
      if (heaviestGB > 900) {
        insights.push({
          type: 'warning', icon: AlertTriangle,
          title: 'Kapasitas Akun Tertinggi',
          text: `Workspace ${heaviestWorkspace._id} terisi ${heaviestGB} GB (${heaviestWorkspace.count} game). Arahkan upload baru ke workspace lain.`
        })
      } else {
        insights.push({
          type: 'success', icon: Cloud,
          title: 'Kesehatan Cloud',
          text: `${activeWorkspacesCount} Google Workspace aktif menampung total ${totalStorageTB} TB (${totalCatalogGames} game fisik terverifikasi).`
        })
      }
    }

    // Insight B: Revoke Needed
    if (expiredToRevoke > 0) {
      insights.push({
        type: 'warning', icon: ShieldAlert,
        title: 'Tindakan Keamanan',
        text: `Terdapat ${expiredToRevoke} akses game pelanggan (kadaluarsa) yang perlu segera di-revoke hari ini.`
      })
    }

    // Insight C: Shopee Listing Queue
    if (unlistedCount > 0) {
      insights.push({
        type: 'info', icon: Sparkles,
        title: 'Antrean Listing Shopee',
        text: `Terdapat ${unlistedCount} game di Google Drive yang belum ditayangkan di Shopee. Buka Listing Studio untuk membuat judul AI & slide.`
      })
    }

    // Insight D: Trending Game (Aggregation)
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
        title: 'Tren Penjualan',
        text: `Game "${topGames[0]._id}" terjual ${topGames[0].count}x bulan ini. Pastikan folder game tetap prima di Drive.`
      })
    }

    // Insight E: VIP Customers
    const topCustomer = await Customer.findOne({ status: 'active' }).sort({ orderCount: -1 }).lean()
    if (topCustomer && topCustomer.orderCount >= 5) {
      insights.push({
        type: 'success', icon: Star,
        title: 'Sinyal Loyalitas',
        text: `Pelanggan ${topCustomer.email} telah mengorder ${topCustomer.orderCount}x sejauh ini. Pertimbangkan penawaran VIP.`
      })
    }

    // 6. Recent Logs (Combined)
    const recentAccess = await AccessLog.find().sort({ grantedAt: -1 }).limit(7).lean()
    const recentSims = await Sims4License.find().sort({ createdAt: -1 }).limit(7).lean()

    const combinedLogs = [
      ...recentAccess.map(a => ({ type: 'general', email: a.email, product: a.gameName, time: a.grantedAt, isBonus: a.isBonus })),
      ...recentSims.map(s => ({ type: 'sims4', email: s.email, product: `Sims 4 - ${s.cc === 'Y' ? 'Premium CC' : 'Standard'}`, time: s.createdAt, isBonus: false }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8)

    // 7. Games on Drive needing Shopee listing (Resilient against unmigrated records)
    const gamesNeedingListing = await GameCatalog.find({
      shopeeListed: { $ne: true },
      $or: [
        { pipelineStatus: { $in: ['on_drive', 'listing_ready'] } },
        { pipelineStatus: null },
        { pipelineStatus: { $exists: false } }
      ]
    })
      .select('name cleanTitle coverImageUrl steamAppId folderId totalSize')
      .sort({ coverImageUrl: -1, updatedAt: -1 })
      .limit(6)
      .lean()

    return {
      success: true,
      todayOrders,
      todayGames,
      activeLicenses,
      expiringSoon,
      totalCatalogGames,
      totalStorageTB,
      activeWorkspacesCount,
      shopeeListedCount,
      unlistedCount,
      websitePublishedCount,
      insights: insights.slice(0, 4),
      recentLogs: combinedLogs,
      gamesNeedingListing,
      genTime: now.toLocaleTimeString('id-ID')
    }
  } catch (e) {
    console.error('Dashboard stats error:', e)
    return {
      todayOrders: 0,
      todayGames: 0,
      activeLicenses: 0,
      expiringSoon: 0,
      totalCatalogGames: 0,
      totalStorageTB: '0',
      activeWorkspacesCount: 0,
      shopeeListedCount: 0,
      unlistedCount: 0,
      websitePublishedCount: 0,
      insights: [],
      recentLogs: [],
      gamesNeedingListing: [],
      genTime: ''
    }
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()
  const listingPercent = stats.totalCatalogGames > 0
    ? Math.round((stats.shopeeListedCount / stats.totalCatalogGames) * 100)
    : 0

  return (
    <div className="fadeUp h-full flex flex-col">
      <TopBar title="Dashboard" />

      {/* Header Compact */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 mt-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">Pusat Kendali Operasional 🚀</p>
          <h2 className="font-display mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--text)]">
            Hari ini <span className="gradient-text">{stats.todayOrders} order</span> · <span className="text-[var(--primary)]">{stats.totalCatalogGames} game</span> siap di Cloud ({stats.totalStorageTB} TB)
          </h2>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <SalesAnalyticsModal />
        </div>
      </div>

      {/* Stats Cards: Dual-Domain (Operasional & Cloud Inventory) */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Order Hari Ini', val: stats.todayOrders, sub: 'Transaksi sukses', icon: ReceiptText, c: '#fbbf24' },
          { label: 'Game Terkirim', val: stats.todayGames, sub: 'Akses Google Drive', icon: Send, c: '#60a5fa' },
          { label: 'Katalog di Drive', val: `${stats.totalCatalogGames} Game`, sub: `${stats.totalStorageTB} TB di ${stats.activeWorkspacesCount} Akun`, icon: HardDrive, c: '#10b981' },
          { label: 'Menunggu Listing', val: `${stats.unlistedCount} Game`, sub: `${stats.shopeeListedCount} sudah live di Shopee`, icon: ShoppingBag, c: stats.unlistedCount > 0 ? '#fb923c' : '#10b981' }
        ].map((m, i) => (
          <div key={i} className="group relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]">
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.03] transition-transform group-hover:scale-150" style={{ background: `radial-gradient(circle, ${m.c} 0%, transparent 70%)` }} />
            <div className="relative z-10 flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">{m.label}</p>
              <m.icon size={15} style={{ color: m.c }} />
            </div>
            <p className="relative z-10 text-2xl font-black text-[var(--text)] leading-none">{m.val}</p>
            <p className="relative z-10 mt-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-4)]">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Lifecycle Funnel Card */}
      <div className="mb-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-[var(--primary)]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">Pipeline Siklus Game</h3>
            <span className="text-[10px] text-[var(--text-3)] font-medium">({listingPercent}% terlisting di Shopee)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--text-3)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ground Truth Drive
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Siap Listing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-pink-500" /> Live Shopee
            </span>
          </div>
        </div>

        {/* Funnel Stage Badges */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link
            href="/accounts"
            className="group rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-2.5 transition hover:border-emerald-500/40"
          >
            <div className="flex items-center justify-between text-[10px] font-semibold text-emerald-400 mb-1">
              <span>1. Di Google Drive</span>
              <Cloud size={12} />
            </div>
            <p className="text-base font-extrabold text-[var(--text)] leading-tight">{stats.totalCatalogGames} <span className="text-[10px] font-normal text-[var(--text-3)]">Game</span></p>
            <p className="text-[9px] text-[var(--text-4)] mt-0.5">{stats.totalStorageTB} TB · {stats.activeWorkspacesCount} Workspace</p>
          </Link>

          <Link
            href="/scout"
            className="group rounded-xl border border-amber-500/20 bg-amber-950/15 p-2.5 transition hover:border-amber-500/40"
          >
            <div className="flex items-center justify-between text-[10px] font-semibold text-amber-400 mb-1">
              <span>2. Siap Listing</span>
              <Sparkles size={12} />
            </div>
            <p className="text-base font-extrabold text-[var(--text)] leading-tight">{stats.unlistedCount} <span className="text-[10px] font-normal text-[var(--text-3)]">Game</span></p>
            <p className="text-[9px] text-amber-400/80 mt-0.5">Perlu judul & slide</p>
          </Link>

          <Link
            href="/scout"
            className="group rounded-xl border border-pink-500/20 bg-pink-950/15 p-2.5 transition hover:border-pink-500/40"
          >
            <div className="flex items-center justify-between text-[10px] font-semibold text-pink-400 mb-1">
              <span>3. Live di Shopee</span>
              <CheckCircle2 size={12} />
            </div>
            <p className="text-base font-extrabold text-[var(--text)] leading-tight">{stats.shopeeListedCount} <span className="text-[10px] font-normal text-[var(--text-3)]">Game</span></p>
            <p className="text-[9px] text-[var(--text-4)] mt-0.5">{listingPercent}% cakupan katalog</p>
          </Link>

          <Link
            href="/search"
            className="group rounded-xl border border-blue-500/20 bg-blue-950/15 p-2.5 transition hover:border-blue-500/40"
          >
            <div className="flex items-center justify-between text-[10px] font-semibold text-blue-400 mb-1">
              <span>4. Etalase Website</span>
              <Globe size={12} />
            </div>
            <p className="text-base font-extrabold text-[var(--text)] leading-tight">{stats.websitePublishedCount} <span className="text-[10px] font-normal text-[var(--text-3)]">Game</span></p>
            <p className="text-[9px] text-[var(--text-4)] mt-0.5">mygameonapp web</p>
          </Link>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-6 items-start flex-1">
        
        {/* Left Column: Insights, App Grid & Listing Queue */}
        <div className="flex flex-col gap-6">
          
          {/* Dynamic Insights Terminal Style */}
          {stats.insights && stats.insights.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-strong)] bg-black/40 p-1 overflow-hidden font-mono shadow-inner relative">
              {/* Terminal Header */}
              <div className="flex items-center justify-between border-b border-white/5 bg-black/20 px-4 py-2">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-[var(--text-3)]" />
                  <span className="text-[10px] font-bold tracking-wider text-[var(--text-3)] uppercase">MyGameON :: Intelligence Engine</span>
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

          {/* App Grid (Full Synchronized Menu) */}
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 md:p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-4 ml-1">Menu Aplikasi Utama</h3>
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

          {/* Games Needing Listing (Listing Studio Queue) */}
          {stats.gamesNeedingListing && stats.gamesNeedingListing.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-amber-400" />
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    {stats.unlistedCount} Game Menunggu Listing Shopee
                  </h3>
                  <span className="text-[10px] text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    Siap di Drive
                  </span>
                </div>
                <Link
                  href="/scout"
                  className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
                >
                  Buka Listing Studio <ArrowRight size={12} />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {stats.gamesNeedingListing.map(game => (
                  <Link
                    key={game._id.toString()}
                    href={`/scout?prefill=${encodeURIComponent(game.cleanTitle || game.name)}`}
                    className="group flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-950/20 hover:bg-amber-950/40 p-2.5 text-xs font-medium text-amber-200 hover:text-white transition-all shadow-sm"
                  >
                    {game.coverImageUrl ? (
                      <img src={game.coverImageUrl} alt="" className="w-8 h-11 object-cover rounded-md shrink-0 shadow" />
                    ) : (
                      <div className="w-8 h-11 rounded-md bg-amber-900/30 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                        <Sparkles size={14} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[var(--text)] group-hover:text-amber-300 transition-colors">
                        {game.cleanTitle || game.name}
                      </p>
                      <p className="text-[10px] text-amber-400/70 mt-0.5">
                        {game.totalSize ? formatBytes(game.totalSize) : 'Ukuran tersinkron'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Feed & CRM Summary */}
        <div className="flex flex-col gap-5">
          
          {/* CRM Quick Status Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href="/revoke"
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-3)] mb-1">
                <span>Lisensi Sims 4</span>
                <KeyRound size={13} className="text-[#c084fc]" />
              </div>
              <p className="text-xl font-black text-[var(--text)]">{stats.activeLicenses}</p>
              <p className="text-[9px] text-[var(--text-4)] mt-0.5 uppercase tracking-wider">Aktif di DB</p>
            </Link>

            <Link
              href="/revoke"
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-3)] mb-1">
                <span>Akan Expired</span>
                <Hourglass size={13} className={stats.expiringSoon > 0 ? "text-amber-400" : "text-emerald-400"} />
              </div>
              <p className="text-xl font-black text-[var(--text)]">{stats.expiringSoon}</p>
              <p className="text-[9px] text-[var(--text-4)] mt-0.5 uppercase tracking-wider">&lt; 48 Jam</p>
            </Link>
          </div>

          {/* Live Activity Feed */}
          <div className="flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--elevated)] px-4 py-3 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
                <Activity size={14} className="text-[var(--primary)]" />
                Live Activity Feed
              </h3>
              <Link href="/log" className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-3)] hover:text-[var(--text)] transition-colors">Semua</Link>
            </div>
            
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 max-h-[420px]">
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
    </div>
  )
}
