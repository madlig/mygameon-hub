import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/shared/StatCard'

const quickActions = [
  { icon: '🎮', label: 'Cari game',    desc: 'Search & keranjang', href: '/search'        },
  { icon: '🟡', label: 'Order Sims 4', desc: 'Input pesanan baru', href: '/sims4/order'   },
  { icon: '⛔', label: 'Revoke akses', desc: 'Cabut akses customer', href: '/revoke'       },
  { icon: '🔑', label: 'Lisensi Sims 4', desc: 'Kelola database',  href: '/sims4/licenses'},
]

const recentLogs = [
  { email: 'buyer@gmail.com',    product: 'Elden Ring',          time: '2 menit lalu',  type: 'general' },
  { email: 'customer@gmail.com', product: 'Sims 4 Premium',      time: '14 menit lalu', type: 'sims4'   },
  { email: 'gamer@gmail.com',    product: 'GTA V, RDR2',         time: '1 jam lalu',    type: 'general' },
]

export default function DashboardPage() {
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
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Order hari ini"
          value="18"
          sub="↑ 3 dari kemarin"
          subColor="text-green-500"
        />
        <StatCard
          label="Game dikirim"
          value="74"
          sub="Hari ini"
          subColor="text-blue-400"
        />
        <StatCard
          label="Lisensi Sims 4"
          value="142"
          sub="Total aktif"
        />
        <StatCard
          label="Revoke bulan ini"
          value="6"
          sub="↑ 2 dari bulan lalu"
          subColor="text-red-500"
        />
      </div>

      {/* Quick actions */}
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
        Aksi cepat
      </p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {quickActions.map((action) => (
          <a
            key={action.href}
            href={action.href}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-secondary"
          >
            <span className="text-xl">{action.icon}</span>
            <div>
              <p className="text-xs font-medium text-foreground">{action.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{action.desc}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Recent logs */}
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
        Terakhir dikirim
      </p>
      <div className="flex flex-col gap-2">
        {recentLogs.map((log, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
          >
            <div>
              <p className="text-xs font-medium text-foreground">{log.email}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {log.product} · {log.time}
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
        ))}
      </div>

    </div>
  )
}