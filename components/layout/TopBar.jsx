'use client'

import { ArrowLeft, LogOut } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

export default function TopBar({ title, backHref }) {
  const { data: session, status } = useSession()

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Status koneksi yang JUJUR — bukan hardcoded.
  const conn =
    status === 'loading'
      ? { color: '#a1a1aa', label: 'Menghubungkan…', glow: false }
      : session?.error === 'RefreshTokenError'
        ? { color: '#ef4444', label: 'Sesi habis', glow: false }
        : status === 'authenticated'
          ? { color: '#22c55e', label: 'Drive terhubung', glow: true }
          : { color: '#ef4444', label: 'Tidak terhubung', glow: false }

  return (
    <header
      className="sticky top-0 z-30 -mx-[var(--pad-card)] -mt-[var(--pad-card)] mb-5 border-b border-[var(--border-soft)] px-[var(--pad-card)] py-3 backdrop-blur-xl"
      style={{ background: 'rgba(10,11,15,0.82)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {backHref && (
            <Link href={backHref} className="pressable shrink-0 text-[var(--text-2)] transition-colors hover:text-[var(--text)]">
              <ArrowLeft size={18} />
            </Link>
          )}
          {/* Brand mark — mobile only (desktop punya sidebar) */}
          <img
            src="/icons/icon-192.png"
            alt="MyGameON"
            className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-[var(--border-soft)] md:hidden"
          />
          <div className="min-w-0">
            <h1 className="font-display truncate text-base font-bold tracking-tight text-[var(--text)] md:text-lg">{title}</h1>
            <p className="hidden text-[10.5px] text-[var(--text-3)] md:block">{today}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1">
            <span className={`h-2 w-2 rounded-full ${conn.glow ? 'ringGlow' : ''}`} style={{ background: conn.color }} />
            <span className="hidden text-[11px] font-semibold sm:inline" style={{ color: conn.color }}>{conn.label}</span>
          </span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="pressable flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] md:hidden"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
