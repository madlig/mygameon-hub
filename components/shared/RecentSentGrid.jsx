'use client'

import { Clock, Plus, Check, Gamepad2 } from 'lucide-react'

export default function RecentSentGrid({ recentGames = [], isInCart, onToggleCart }) {
  const topSix = (recentGames || []).slice(0, 6)

  if (topSix.length === 0) return null

  return (
    <div className="mb-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
            <Clock size={13} />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)]">
            6 Game Terakhir Dikirim
          </p>
        </div>
        <span className="text-[10px] text-[var(--text-3)] font-medium">
          Klik cepat untuk tambah ke kasir
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {topSix.map((game) => {
          const inCart = isInCart ? isInCart(game.id) : false
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => onToggleCart(game)}
              title={inCart ? 'Hapus dari keranjang' : 'Tambah ke keranjang'}
              className={`pressable flex w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                inCart
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] shadow-sm'
                  : 'border-[var(--border-soft)] bg-[var(--elevated)]/60 text-[var(--text)] hover:border-[var(--primary)]/50 hover:bg-[var(--elevated)]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Gamepad2
                  size={14}
                  className={`shrink-0 ${inCart ? 'text-[var(--primary)]' : 'text-[var(--text-3)]'}`}
                />
                <span className="text-xs font-semibold leading-snug break-words">
                  {game.name}
                </span>
              </div>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                  inCart
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'bg-[var(--surface)] text-[var(--text-3)] group-hover:text-[var(--text)]'
                }`}
              >
                {inCart ? <Check size={11} strokeWidth={3} /> : <Plus size={11} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
