'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navGroups = [
  {
    label: 'General Games',
    items: [
      { href: '/',        icon: '⊞',  label: 'Dashboard'   },
      { href: '/search',  icon: '🎮', label: 'Cari game'   },
      { href: '/revoke',  icon: '⛔', label: 'Revoke akses' },
      { href: '/check',   icon: '📂', label: 'Cek file'    },
    ],
  },
  {
    label: 'The Sims 4',
    items: [
      { href: '/sims4/order',    icon: '🟡', label: 'Order baru'      },
      { href: '/sims4/licenses', icon: '🔑', label: 'Kelola lisensi'  },
    ],
  },
  {
    label: 'Lainnya',
    items: [
      { href: '/log', icon: '📋', label: 'Log & history' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-52 flex-shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="border-b border-border px-4 py-5">
        <div className="text-sm font-semibold text-foreground">
          MyGameON <span className="text-primary">Hub</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">Admin panel</div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-2">
            <p className="px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 border-l-2 px-4 py-2 text-xs transition-colors ${
                    isActive
                      ? 'border-primary bg-secondary text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Admin info */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            A
          </div>
          <div>
            <div className="text-xs font-medium text-foreground">Admin</div>
            <div className="text-[10px] text-muted-foreground">mygameonhub</div>
          </div>
        </div>
      </div>
    </aside>
  )
}