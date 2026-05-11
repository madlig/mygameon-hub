import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/shared/StatCard'
import Link from 'next/link'
import { getGoogleClients } from '@/lib/googleClient'

const quickActions = [
  { icon: '🎮', label: 'Cari game',      desc: 'Search & keranjang',  href: '/search'          },
  { icon: '🟡', label: 'Order Sims 4',   desc: 'Input pesanan baru',  href: '/sims4/order'     },
  { icon: '⛔', label: 'Revoke akses',   desc: 'Cabut akses customer', href: '/revoke'          },
  { icon: '🔑', label: 'Lisensi Sims 4', desc: 'Kelola database',     href: '/sims4/licenses'  },
]

async function getDashboardStats() {
  try {
    const { sheets } = await getGoogleClients()

    // Ambil log General Games
    const generalRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GSHEET_ID,
      range: 'Sheet1!A:D',
    })

    // Ambil log Sims 4
    const sims4Res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GSHEET_SIMS4_ID,
      range: 'Licenses!A:G',
    })

    const generalRows = (generalRes.data.values || []).filter(
      row => row[0] && row[0] !== 'Date'
    )
    const sims4Rows = (sims4Res.data.values || []).filter(
      row => row[0] && row[0] !== 'Invoice'
    )

    // Hitung order hari ini (General)
    const today = new Date().toDateString()
    const todayOrders = generalRows.filter(
      row => new Date(row[0]).toDateString() === today
    ).length

    // Hitung game dikirim hari ini
    const todayGames = generalRows.filter(
      row => new Date(row[0]).toDateString() === today
    ).length

    // Total lisensi Sims 4 aktif
    const activeLicenses = sims4Rows.filter(
      row => row[4] === 'Active'
    ).length

    // Recent logs — gabung dan ambil 3 terbaru
    const generalLogs = generalRows.map(row => ({
      type: 'general',
      email: row[1] || '',
      product: row[2] || '',
      time: row[0] || '',
    }))

    const sims4Logs = sims4Rows.map(row => ({
      type: 'sims4',
      email: row[5] || '',
      product: `Sims 4 · ${row[3] === 'Y' ? 'Premium CC' : 'Standard'}`,
      time: row[6] || '',
    }))

    const recentLogs = [...generalLogs, ...sims4Logs]
      .filter(l => l.time)
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 3)

    return {
      todayOrders,
      todayGames,
      activeLicenses,
      recentLogs,
    }

  } catch (e) {
    console.error('Dashboard stats error:', e)
    return {
      todayOrders: 0,
      todayGames: 0,
      activeLicenses: 0,
      recentLogs: [],
    }
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
    return new Date(timeStr).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short'
    })
  } catch {
    return '-'
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div>
      <TopBar title="Dashboard" />

      {/* Greeting */}
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">Selamat datang kembali</p>
        <h2 className="text-xl font-semibold text-foreground">
          MyGameON <span className="text-primary">Hub</span>
        </h2>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
        <StatCard
          label="Order hari ini"
          value={stats.todayOrders}
          sub={stats.todayOrders > 0 ? `${stats.todayOrders} transaksi` : 'Belum ada'}
          subColor={stats.todayOrders > 0 ? 'text-green-500' : 'text-muted-foreground'}
        />
        <StatCard
          label="Game dikirim"
          value={stats.todayGames}
          sub="Hari ini"
          subColor="text-blue-400"
        />
        <StatCard
          label="Lisensi Sims 4"
          value={stats.activeLicenses}
          sub="Total aktif"
        />
        <StatCard
          label="Log tercatat"
          value={stats.recentLogs.length > 0 ? '✓' : '-'}
          sub="Sistem normal"
          subColor="text-green-500"
        />
      </div>

      {/* Quick actions */}
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
        Aksi cepat
      </p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {quickActions.map(action => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-secondary"
          >
            <span className="text-xl">{action.icon}</span>
            <div>
              <p className="text-xs font-medium text-foreground">{action.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent logs */}
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
        Terakhir dikirim
      </p>
      <div className="flex flex-col gap-2">
        {stats.recentLogs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">Belum ada transaksi</p>
          </div>
        ) : (
          stats.recentLogs.map((log, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="text-xs font-medium text-foreground">{log.email}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {log.product} · {formatTime(log.time)}
                </p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                log.type === 'sims4'
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'bg-primary/10 text-primary'
              }`}>
                {log.type === 'sims4' ? 'Sims 4' : 'General'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}