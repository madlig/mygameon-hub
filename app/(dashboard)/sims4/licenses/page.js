'use client'

import TopBar from '@/components/layout/TopBar'
import Sims4LicensesTab from '@/components/shared/Sims4LicensesTab'
import Link from 'next/link'
import { ArrowRight, Users } from 'lucide-react'

export default function Sims4LicensesPage() {
  return (
    <div className="fadeUp pb-24">
      <TopBar title="Kelola Lisensi The Sims 4" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
            <Users size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text)]">Kelola Lisensi Kini Terintegrasi di CRM</p>
            <p className="text-xs text-[var(--text-3)]">Semua lisensi The Sims 4 dan hak bonus kini dapat diakses langsung di CRM &amp; Lisensi.</p>
          </div>
        </div>
        <Link
          href="/revoke?tab=licenses"
          className="pressable flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--primary-fg)] transition hover:brightness-105"
        >
          Buka di CRM <ArrowRight size={14} />
        </Link>
      </div>

      <Sims4LicensesTab />
    </div>
  )
}
