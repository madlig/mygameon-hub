'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TopBar({ title, backHref }) {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <header className="mb-5 flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--bg)] px-1 pb-3.5 md:px-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {backHref && (
          <Link href={backHref} className="text-[var(--text-2)] hover:text-[var(--text)]">
            <ArrowLeft size={18} />
          </Link>
        )}
        <h1 className="truncate text-sm font-semibold text-[var(--text)]">{title}</h1>
      </div>
      <div className="hidden md:flex items-center gap-3">
        <span className="text-[11px] text-[var(--text-3)]">{today}</span>
        <span className="h-3.5 w-px bg-[var(--border-soft)]" />
        <div className="flex items-center gap-1.5">
          <span className="ringGlow h-2 w-2 rounded-full bg-[#22C55E]" />
          <span className="text-[11px] font-medium text-[#4ade80]">Drive terhubung</span>
        </div>
      </div>
    </header>
  )
}
