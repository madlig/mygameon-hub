export const dynamic = 'force-dynamic'

import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/shared/StatCard'
import { AppBadge, AppCard, SectionLabel } from '@/components/shared/design-system'
import Link from 'next/link'
import { Clock, Folder, KeyRound, ReceiptText, Search, Send, ShieldX, Sparkles } from 'lucide-react'
import { getGoogleClients } from '@/lib/googleClient'
import { parseSheetDate } from '@/lib/utils'

const quickActions = [
  { icon: Search, label: 'Cari game', desc: 'Search & keranjang', href: '/search', accent: '#F59E0B' },
  { icon: Sparkles, label: 'Order Sims 4', desc: 'Input pesanan baru', href: '/sims4/order', accent: '#A78BFA' },
  { icon: ShieldX, label: 'Revoke akses', desc: 'Cabut akses customer', href: '/revoke', accent: '#EF4444' },
  { icon: Folder, label: 'Cek file', desc: 'Cek isi folder game', href: '/check', accent: '#60A5FA' },
  { icon: KeyRound, label: 'Lisensi Sims 4', desc: 'Kelola database', href: '/sims4/licenses', accent: '#A78BFA' },
  { icon: Clock, label: 'Log & history', desc: 'Riwayat transaksi', href: '/log', accent: '#A8A29E' },
]

async function getDashboardStats() {
  try {
    const { sheets } = await getGoogleClients()

    const generalRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GSHEET_ID,
      range: 'Sheet1!A:D',
      valueRenderOption: 'UNFORMATTED_VALUE',
    })

    const sims4Res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GSHEET_SIMS4_ID,
      range: 'Licenses!A:G',
      valueRenderOption: 'UNFORMATTED_VALUE',
    })

    const generalRows = (generalRes.data.values || []).filter(row => row[0] && row[0] !== 'Date')
    const sims4Rows = (sims4Res.data.values || []).filter(row => row[0] && row[0] !== 'Invoice')
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const todayRows = generalRows.filter(row => {
      const t = parseSheetDate(row[0])
      if (!t) return false
      return new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) === today
    })
    const todayGames = todayRows.length
    const uniqueOrders = new Set(todayRows.map(row => `${row[1] || ''}_${parseSheetDate(row[0]).slice(0, 16)}`))
    const todayOrders = uniqueOrders.size
    const activeLicenses = sims4Rows.filter(row => row[4] === 'Active').length

    const generalLogs = generalRows.map(row => ({
      type: 'general',
      email: row[1] || '',
      product: row[2] || '',
      time: parseSheetDate(row[0]),
    }))

    const sims4Logs = sims4Rows.map(row => ({
      type: 'sims4',
      email: row[5] || '',
      product: `Sims 4 - ${row[3] === 'Y' ? 'Premium CC' : 'Standard'}`,
      time: parseSheetDate(row[6]),
    }))

    const recentLogs = [...generalLogs, ...sims4Logs]
      .filter(l => l.time)
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 3)

    return { todayOrders, todayGames, activeLicenses, recentLogs }
  } catch (e) {
    console.error('Dashboard stats error:', e)
    return { todayOrders: 0, todayGames: 0, activeLicenses: 0, recentLogs: [] }
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
    <div>
      <TopBar title="Dashboard" />

      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-[var(--text-3)]">Selamat datang kembali</p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--text)] md:text-2xl">
            Hari ini, <span className="text-[var(--primary)]">{stats.todayOrders} order</span> masuk.
          </h2>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4">
        <StatCard label="Order hari ini" value={stats.todayOrders} sub={stats.todayOrders > 0 ? `${stats.todayOrders} transaksi` : 'Belum ada'} subColor={stats.todayOrders > 0 ? 'text-[#4ade80]' : 'text-[var(--text-3)]'} icon={ReceiptText} accent="#F59E0B" />
        <StatCard label="Game dikirim" value={stats.todayGames} sub="Hari ini" subColor="text-[#93c5fd]" icon={Send} accent="#60A5FA" />
        <StatCard label="Lisensi Sims 4" value={stats.activeLicenses} sub="Total aktif" icon={KeyRound} accent="#A78BFA" />
        <StatCard label="Log tercatat" value={stats.recentLogs.length > 0 ? 'OK' : '-'} sub="Sistem normal" subColor="text-[#4ade80]" icon={Clock} accent="#22C55E" />
      </div>

      <SectionLabel>Aksi cepat</SectionLabel>
      <div className="mb-6 grid grid-cols-2 gap-[var(--gap)]">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className="pressable group flex flex-col gap-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-[var(--pad-card)] text-left transition-colors hover:border-[var(--border-strong)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${action.accent}18`, color: action.accent }}>
                <Icon size={16} />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[var(--text)]">{action.label}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-3)]">{action.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>

      <SectionLabel right={<Link href="/log" className="text-[10px] font-medium text-[var(--text-2)] hover:text-[var(--primary)]">Lihat semua</Link>}>
        Terakhir dikirim
      </SectionLabel>
      <div className="flex flex-col gap-[var(--gap)]">
        {stats.recentLogs.length === 0 ? (
          <AppCard className="px-4 py-6 text-center">
            <p className="text-sm text-[var(--text-3)]">Belum ada transaksi</p>
          </AppCard>
        ) : (
          stats.recentLogs.map((log, i) => (
            <AppCard key={i} className="flex items-center justify-between gap-3" style={{ padding: 'var(--pad-row)' }}>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-[var(--text)]">{log.email}</p>
                <p className="mt-0.5 truncate text-[10.5px] text-[var(--text-3)]">
                  {log.product} - <span className="text-[var(--text-2)]">{formatTime(log.time)}</span>
                </p>
              </div>
              <AppBadge tone={log.type === 'sims4' ? 'sims' : 'primary'}>
                {log.type === 'sims4' ? 'Sims 4' : 'General'}
              </AppBadge>
            </AppCard>
          ))
        )}
      </div>
    </div>
  )
}
