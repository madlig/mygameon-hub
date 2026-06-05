'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Clock,
  Folder,
  Grid2X2,
  KeyRound,
  LayoutGrid,
  LogOut,
  Search,
  ShieldX,
  Sparkles,
  X,
} from 'lucide-react'

const primary = [
  { href: '/', icon: Grid2X2, label: 'Home' },
  { href: '/search', icon: Search, label: 'Games' },
  { href: '/sims4/order', icon: Sparkles, label: 'Sims 4', match: '/sims4' },
  { href: '/log', icon: Clock, label: 'Log' },
]

const moreItems = [
  { href: '/revoke', icon: ShieldX, label: 'Revoke akses', desc: 'Cabut akses customer', accent: '#ef4444' },
  { href: '/check', icon: Folder, label: 'Cek file', desc: 'Cek isi folder game', accent: '#60a5fa' },
  { href: '/sims4/licenses', icon: KeyRound, label: 'Kelola lisensi', desc: 'Database Sims 4', accent: '#a78bfa' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = moreItems.some((m) => pathname === m.href)

  return (
    <>
      {/* Sheet "More" */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="animate-overlay absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div
            className="animate-sheet absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[var(--border-strong)] bg-[var(--surface)] p-5 pb-8"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 1.5rem)' }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-base font-bold text-[var(--text)]">Menu lainnya</p>
              <button onClick={() => setMoreOpen(false)} className="text-[var(--text-3)] hover:text-[var(--text)]" aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="pressable flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--elevated)] px-4 py-3"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${item.accent}1f`, color: item.accent }}
                    >
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text)]">{item.label}</p>
                      <p className="text-[11px] text-[var(--text-3)]">{item.desc}</p>
                    </div>
                  </Link>
                )
              })}

              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="pressable mt-1 flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] px-4 py-3 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[.06] text-[var(--text-2)]">
                  <LogOut size={18} />
                </span>
                <p className="text-[13px] font-semibold text-[var(--text-2)]">Logout</p>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--border-soft)] md:hidden"
        style={{
          background: 'rgba(10,11,15,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        }}
      >
        {primary.map((item) => {
          const isActive = item.match ? pathname.startsWith(item.match) : pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
              style={{ color: isActive ? 'var(--primary)' : 'var(--text-2)' }}
            >
              {isActive && <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-[var(--primary)]" />}
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
              <span className={isActive ? 'font-bold' : ''}>{item.label}</span>
            </Link>
          )
        })}

        <button
          onClick={() => setMoreOpen(true)}
          className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
          style={{ color: moreActive ? 'var(--primary)' : 'var(--text-2)' }}
        >
          {moreActive && <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-[var(--primary)]" />}
          <LayoutGrid size={20} strokeWidth={moreActive ? 2.2 : 1.7} />
          <span className={moreActive ? 'font-bold' : ''}>More</span>
        </button>
      </nav>
    </>
  )
}
