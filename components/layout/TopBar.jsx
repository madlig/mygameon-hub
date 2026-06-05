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
    <header className="mb-5 flex items-center justify-between border-b border-[var(--border-soft)] px-1 pb-3.5 md:px-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {backHref && (
          <Link href={backHref} className="text-[var(--text-2)] transition-colors hover:text-[var(--text)]">
            <ArrowLeft size={18} />
          </Link>
        )}
        <h1 className="font-display truncate text-base font-bold tracking-tight text-[var(--text)]">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-[11px] text-[var(--text-3)]">{today}</span>
          <span className="h-3.5 w-px bg-[var(--border-soft)]" />
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${conn.glow ? 'ringGlow' : ''}`}
              style={{ background: conn.color }}
            />
            <span className="text-[11px] font-semibold" style={{ color: conn.color }}>
              {conn.label}
            </span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="pressable text-[var(--text-3)] transition-colors hover:text-[var(--text)] md:hidden"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
