'use client'

import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'
import { ShoppingCart, ArrowRight, Sparkles } from 'lucide-react'

export default function Sims4OrderPage() {
  return (
    <div className="fadeUp pb-24">
      <TopBar title="Order Baru The Sims 4" />

      <div className="mx-auto mt-8 max-w-lg rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/30 bg-gradient-to-tr from-purple-500/20 to-pink-500/20 text-purple-300">
          <Sparkles size={28} className="text-pink-400" />
        </div>
        <h2 className="font-display mb-2 text-xl font-extrabold text-[var(--text)]">
          Order The Sims 4 Telah Dilebur ke Kasir Game
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-[var(--text-2)]">
          Kini Anda dapat memproses order The Sims 4 (Standard &amp; Premium CC), game PC reguler, maupun paket campuran dalam satu keranjang belanja terpadu.
        </p>
        <Link
          href="/search"
          className="pressable flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 py-3.5 text-sm font-bold text-[var(--primary-fg)] shadow-lg shadow-[var(--primary)]/20 transition hover:brightness-105"
        >
          <ShoppingCart size={16} /> Buka Katalog &amp; Kasir Game <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )
}
