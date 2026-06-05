export const dynamic = 'force-dynamic'

import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/shared/StatCard'
import { AppBadge, AppCard, SectionLabel } from '@/components/shared/design-system'
import Link from 'next/link'
import { Clock, Folder, Hourglass, KeyRound, ReceiptText, Search, Send, ShieldX, Sparkles } from 'lucide-react'
import { getGoogleClients } from '@/lib/googleClient'
import { parseSheetDate } from '@/lib/utils'

const quickActions = [
  { icon: Search, label: 'Cari game', desc: 'Search & keranjang', href: '/search', accent: '#ffd100' },
  { icon: Sparkles, label: 'Order Sims 4', desc: 'Input pesanan baru', href: '/sims4/order', accent: '#a78bfa' },
  { icon: ShieldX, label: 'Revoke akses', desc: 'Cabut akses customer', href: '/revoke', accent: '#ef4444' },
  { icon: Folder, label: 'Cek file', desc: 'Cek isi folder game', href: '/check', accent: '#60a5fa' },
  { icon: KeyRound, label: 'Lisensi Sims 4', desc: 'Kelola database', href: '/sims4/licenses', accent: '#a78bfa' },
  { icon: Clock, label: 'Log & history', desc: 'Riwayat transaksi', href: '/log', accent: '#a8a29e' },
]

const jkt = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

async function getDashboardStats() {
  try {
    const { sheets } = await getGoogleClients()

    const [generalRes, sims4Res] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_ID, range: 'Sheet1!A:E', valueRenderOption: 'UNFORMATTED_VALUE' }),
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_SIMS4_ID, range: 'Licenses!A:G', valueRenderOption: 'UNFORMATTED_VALUE' }),
    ])

    const generalRows = (generalRes.data.values || [])
      .filter(row => row[0] && row[0] !== 'Date')
      .map(row => ({
        time: parseSheetDate(row[0]),
        email: row[1] || '',
        product: row[2] || '',
        isBonus: (row[4] || '') === 'bonus',
      }))

    const sims4Rows = (sims4Res.data.values || []).filter(row => row[0] && row[0] !== 'Invoice')
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    // Hitungan hari ini — KECUALIKAN bonus (bonus terkait pesanan sebelumnya)
    const todayGen = generalRows.filter(r => r.time && jkt(r.time) === today && !r.isBonus)
    const todayGames = todayGen.length
    const todayOrders = new Set(todayGen.map(r => `${r.email}_${String(r.time).slice(0, 16)}`)).size

    const todaySims4Rows = sims4Rows.filter(row => {
      const t = parseSheetDate(row[6])
      return t && jkt(t) === today
    })
    const activeLicenses = sims4Rows.filter(row => row[4] === 'Active').length

    // Akses akan expired ≤2 hari
    let expiringSoon = 0
    try {
      const expRes = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_ID, range: 'ExpiringAccess!A:F' })
      const now = Date.now()
      const horizon = now + 2 * 24 * 60 * 60 * 1000
      expiringSoon = (expRes.data.values || []).filter(row => {
        if ((row[5] || '').toLowerCase() !== 'active') return false
        const exp = new Date(row[4]).getTime()
        return !isNaN(exp) && exp >= now && exp <= horizon
      }).length
    } catch (e) {
      console.error('Expiring stat error:', e.message)
    }

    const generalLogs = generalRows.map(r => ({ type: 'general', email: r.email, product: r.product, time: r.time, isBonus: r.isBonus }))
    const sims4Logs = sims4Rows.map(row => ({
      type: 'sims4',
      email: row[5] || '',
      product: `Sims 4 - ${row[3] === 'Y' ? 'Premium CC' : 'Standard'}`,
      time: parseSheetDate(row[6]),
      isBonus: false,
    }))

    const recentLogs = [...generalLogs, ...sims4Logs]
      .filter(l => l.time)
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 6)

    return {
      todayOrders: todayOrders + todaySims4Rows.length,
      todayGames: todayGames + todaySims4Rows.length,
      activeLicenses,
      expiringSoon,
      recentLogs,
    }
  } catch (e) {
    console.error('Dashboard stats error:', e)
    return { todayOrders: 0, todayGames: 0, activeLicenses: 0, expiringSoon: 0, recentLogs: [] }
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '-'
  try {
    const diff = Date.now() - new Date(timeStr).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    if (minutes < 1) return 'Baru saja'
    if (minutes < 60) return `${minutes} menit lalu`
    if (hours < 24) return `${hours} jam lalu`
    return new Date(timeStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  } catch {
    return '-'
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="fadeUp">
      <TopBar title="Dashboard" />

      <div className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-3)]">Selamat datang kembali 👋</p>
        <h2 className="font-display mt-1 text-2xl font-extrabold tracking-tight text-[var(--text)] md:text-[28px]">
          Hari ini <span className="gradient-text">{stats.todayOrders} order</span> masuk.
        </h2>
      </div>

      <div className="stagger mb-7 grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4">
        <StatCard label="Order hari ini" value={stats.todayOrders} sub={stats.todayOrders > 0 ? `${stats.todayOrders} transaksi` : 'Belum ada'} subColor={stats.todayOrders > 0 ? 'text-[#4ade80]' : 'text-[var(--text-3)]'} icon={ReceiptText} accent="#ffd100" />
        <StatCard label="Game dikirim" value={stats.todayGames} sub="Hari ini · tanpa bonus" subColor="text-[#93c5fd]" icon={Send} accent="#60a5fa" />
        <StatCard label="Lisensi Sims 4" value={stats.activeLicenses} sub="Total aktif" icon={KeyRound} accent="#a78bfa" />
        <StatCard
          label="Akan expired"
          value={stats.expiringSoon}
          sub={stats.expiringSoon > 0 ? '≤2 hari lagi' : 'Aman'}
          subColor={stats.expiringSoon > 0 ? 'text-[#fbbf24]' : 'text-[#4ade80]'}
          icon={Hourglass}
          accent={stats.expiringSoon > 0 ? '#f59e0b' : '#22c55e'}
        />
      </div>

      {/* Lower: aksi cepat + aktivitas (2 kolom di desktop) */}
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:items-start">
        {/* Aksi cepat */}
        <div className="mb-7 lg:mb-0">
          <SectionLabel>Aksi cepat</SectionLabel>
          <div className="stagger grid grid-cols-2 gap-[var(--gap)] sm:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="pressable card-hover group flex flex-col gap-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-[var(--pad-card)] text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ background: `${action.accent}1f`, color: action.accent, boxShadow: `0 0 18px -8px ${action.accent}` }}>
                    <Icon size={17} />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-[var(--text)]">{action.label}</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-[var(--text-3)]">{action.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Terakhir dikirim */}
        <div>
          <SectionLabel right={<Link href="/log" className="text-[10px] font-semibold text-[var(--text-2)] transition-colors hover:text-[var(--primary)]">Lihat semua →</Link>}>
            Terakhir dikirim
          </SectionLabel>
          <div className="stagger flex flex-col gap-[var(--gap)]">
            {stats.recentLogs.length === 0 ? (
              <AppCard className="px-4 py-8 text-center">
                <p className="text-sm text-[var(--text-3)]">Belum ada transaksi</p>
              </AppCard>
            ) : (
              stats.recentLogs.map((log, i) => (
                <AppCard key={i} hover className="flex items-center justify-between gap-3" style={{ padding: 'var(--pad-row)' }}>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">{log.email}</p>
                    <p className="mt-0.5 truncate text-[10.5px] text-[var(--text-3)]">
                      {log.product} · <span className="text-[var(--text-2)]">{formatTime(log.time)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {log.isBonus && <AppBadge tone="accent">Bonus</AppBadge>}
                    <AppBadge tone={log.type === 'sims4' ? 'sims' : 'primary'}>
                      {log.type === 'sims4' ? 'Sims 4' : 'General'}
                    </AppBadge>
                  </div>
                </AppCard>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
