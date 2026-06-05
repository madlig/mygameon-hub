'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
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
  const { data: session, status } = useSession()

  const online = status === 'authenticated' && session?.error !== 'RefreshTokenError'

  return (
    <aside className="hidden w-[var(--sb-w)] flex-shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)]/60 backdrop-blur-xl md:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="glow-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-fg)]">
          <Gamepad2 size={19} strokeWidth={2.25} />
        </div>
        <div className="overflow-hidden">
          <div className="brand-wordmark whitespace-nowrap text-[15px] leading-tight">
            <span className="gradient-text">MyGameON</span>
          </div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-3)]">Hub Admin</div>
        </div>
      </div>

      <div className="mx-4 mb-1 h-px bg-gradient-to-r from-transparent via-[var(--border-soft)] to-transparent" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1.5 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-3)]">
              <span className="h-1 w-1 rounded-full bg-[var(--primary)]/60" />
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-semibold transition-all ${
                      isActive
                        ? 'bg-[var(--primary)]/10 text-[var(--primary)] shadow-[inset_0_0_0_1px_rgba(255,209,0,0.18)]'
                        : 'text-[var(--text-2)] hover:bg-[var(--elevated)]/70 hover:text-[var(--text)]'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                        isActive
                          ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-[0_0_16px_-4px_rgba(255,209,0,0.7)]'
                          : 'bg-[var(--elevated)] text-[var(--text-3)] group-hover:text-[var(--text-2)]'
                      }`}
                    >
                      <Icon size={15} strokeWidth={2.1} />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status + user */}
      <div className="border-t border-[var(--border-soft)] p-3">
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-[var(--elevated)]/60 px-2.5 py-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${online ? 'ringGlow bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
          <span className={`text-[10px] font-semibold ${online ? 'text-[#4ade80]' : 'text-[#fca5a5]'}`}>
            {online ? 'Drive terhubung' : status === 'loading' ? 'Menghubungkan…' : 'Sesi habis'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hi)] text-[12px] font-extrabold text-white">
            A
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11.5px] font-bold text-[var(--text)]">Admin</div>
            <div className="truncate text-[10px] text-[var(--text-3)]">mygameon.store</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="pressable flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-3)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
