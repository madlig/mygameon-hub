'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Clock,
  Folder,
  Gamepad2,
  Grid2X2,
  KeyRound,
  LogOut,
  Search,
  ShieldX,
  Sparkles,
} from 'lucide-react'

const navGroups = [
  {
    label: 'General Games',
    items: [
      { href: '/', icon: Grid2X2, label: 'Dashboard' },
      { href: '/search', icon: Search, label: 'Cari game' },
      { href: '/revoke', icon: ShieldX, label: 'Revoke akses' },
      { href: '/check', icon: Folder, label: 'Cek file' },
    ],
  },
  {
    label: 'The Sims 4',
    items: [
      { href: '/sims4/order', icon: Sparkles, label: 'Order baru' },
      { href: '/sims4/licenses', icon: KeyRound, label: 'Kelola lisensi' },
    ],
  },
  {
    label: 'Lainnya',
    items: [{ href: '/log', icon: Clock, label: 'Log & history' }],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-[var(--sb-w)] flex-shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)] md:flex">
      <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-4 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-fg)]">
          <Gamepad2 size={18} strokeWidth={2} />
        </div>
        <div className="overflow-hidden">
          <div className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[var(--text)]">
            MyGameON <span className="text-[var(--primary)]">Hub</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[var(--text-3)]">Admin panel</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-4 pb-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--text-3)]">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-2.5 px-4 py-2 text-xs transition-all ${
                    isActive
                      ? 'text-[var(--text)]'
                      : 'text-[var(--text-2)] hover:text-[var(--text)]'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r transition-all ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ background: 'var(--primary)' }}
                  />
                  <span
                    className={`absolute inset-x-2 inset-y-0.5 rounded-md transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    style={{ background: 'var(--elevated)' }}
                  />
                  <Icon className={`relative z-10 ${isActive ? 'text-[var(--primary)]' : ''}`} size={16} />
                  <span className="relative z-10 truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--border-soft)] px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-[var(--primary-fg)]">
            A
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium text-[var(--text)]">Admin</div>
            <div className="truncate text-[10px] text-[var(--text-3)]">mygameonhub</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-[var(--text-3)] hover:text-[var(--text)]" title="Logout">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
