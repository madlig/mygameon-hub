'use client'

import { ArrowLeft, LogOut } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function TopBar({ title, backHref }) {
  const { data: session, status } = useSession()
  const [driveLimit, setDriveLimit] = useState(null)

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/drive/status')
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'limit') {
            setDriveLimit(data)
          } else {
            setDriveLimit(null)
          }
        })
        .catch((err) => console.error(err))
    }
  }, [status])

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <header
      className="sticky top-0 z-30 -mx-[var(--pad-card)] -mt-[var(--pad-card)] mb-5 border-b border-[var(--border-soft)] px-[var(--pad-card)] py-3 backdrop-blur-xl flex items-center pr-[140px]"
      style={{ background: 'rgba(10,11,15,0.82)', WebkitAppRegion: 'drag' }}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {backHref && (
            <Link href={backHref} style={{ WebkitAppRegion: 'no-drag' }} className="pressable shrink-0 text-[var(--text-2)] transition-colors hover:text-[var(--text)]">
              <ArrowLeft size={18} />
            </Link>
          )}
          {/* Brand mark — mobile only */}
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

        <div className="flex shrink-0 items-center gap-3">
          {/* PREMIUM DRIVE STATUS INDICATOR */}
          {status === 'loading' ? (
            <div className="flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
              <span className="hidden text-[11px] font-semibold text-gray-400 sm:inline">Menghubungkan…</span>
            </div>
          ) : session?.error === 'RefreshTokenError' ? (
            <div className="flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="hidden text-[11px] font-semibold text-red-500 sm:inline">Sesi Terputus</span>
            </div>
          ) : driveLimit?.status === 'limit' ? (
            <div className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1.5 shadow-[0_0_15px_rgba(239,68,68,0.25)] relative overflow-hidden group cursor-default">
              <div className="absolute inset-0 bg-red-500/20 animate-pulse"></div>
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
              <span className="relative hidden text-[11px] font-bold text-red-400 sm:inline tracking-wide">
                LIMIT: <span className="text-white">
                  {driveLimit.limited?.length > 1
                    ? `${driveLimit.email} + ${driveLimit.limited.length - 1} lainnya`
                    : (driveLimit.email || 'Workspace')}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-[#10b981]/20 bg-[#10b981]/10 px-3 py-1.5 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10b981] opacity-40"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10b981]"></span>
              </span>
              <span className="hidden text-[11px] font-semibold text-[#10b981] sm:inline tracking-wide">Cloud Aktif</span>
            </div>
          )}

          <button
            style={{ WebkitAppRegion: 'no-drag' }}
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="pressable flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[var(--text-3)] transition-all hover:border-[var(--danger)]/30 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] md:hidden"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
