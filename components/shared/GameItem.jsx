'use client'

import { useEffect, useRef } from 'react'
import { Check, Plus, Star, Box, MoreVertical, Sparkles } from 'lucide-react'
import { isSims4Game } from '@/lib/sims4'

export default function GameItem({
  name,
  meta,
  size,
  totalFiles,
  inCart,
  onAdd,
  onRemove,
  onOpenDetails,
  active = false,
  isFav,
  onToggleFav,
}) {
  const ref = useRef(null)
  const isSims = isSims4Game(name)

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [active])

  function handleCardClick() {
    if (inCart) {
      onRemove?.()
    } else {
      onAdd?.()
    }
  }

  const border = active
    ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30 shadow-[0_0_20px_-5px_rgba(255,209,0,0.3)]'
    : inCart
      ? 'border-[var(--primary)] bg-[var(--primary)]/[0.06] shadow-[0_4px_20px_-8px_rgba(255,209,0,0.35)]'
      : 'border-[var(--border-soft)] hover:border-[var(--primary)]/50 hover:bg-[var(--elevated)]/40'

  return (
    <div
      ref={ref}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
      className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl px-4 py-3 transition-all duration-200 cursor-pointer border select-none ${border}`}
    >
      {/* Background Subtle Gradient for In-Cart */}
      {inCart && (
        <div
          className="pointer-events-none absolute inset-0 opacity-100 transition-opacity"
          style={{
            background:
              'linear-gradient(90deg, rgba(255, 209, 0, 0.08) 0%, transparent 60%)',
          }}
        />
      )}

      {/* Left Content */}
      <div className="relative min-w-0 flex-1">
        <div className="flex items-start gap-2.5 mb-1.5">
          {inCart ? (
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm">
              <Check size={12} strokeWidth={3} />
            </span>
          ) : (
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-transparent group-hover:border-[var(--primary)]/60 group-hover:text-[var(--text-3)] transition-colors">
              <Plus size={11} strokeWidth={2.5} />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <h3
                className={`text-sm font-bold leading-snug break-words transition-colors ${
                  inCart
                    ? 'text-[var(--primary)] font-extrabold'
                    : 'text-[var(--text)] group-hover:text-[var(--primary)]'
                }`}
              >
                {name}
              </h3>

              {isSims && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 px-2 py-0.5 text-[9.5px] font-extrabold text-purple-300">
                  <Sparkles size={10} className="text-pink-400" /> Sims 4
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-7">
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--elevated)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-3)]">
            <Box size={10} className="text-[var(--primary)]" />
            {meta}
          </div>
          {(size || totalFiles) && (
            <p className="shrink-0 text-[11px] font-medium text-[var(--text-2)]">
              {totalFiles ? `${totalFiles} file` : ''}{' '}
              {size && totalFiles ? '·' : ''} {size || ''}
            </p>
          )}
        </div>
      </div>

      {/* Right Secondary Actions (Stop Propagation) */}
      <div className="relative flex shrink-0 items-center gap-1 pl-2">
        {/* Favorite Button */}
        {onToggleFav && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFav()
            }}
            title={isFav ? 'Hapus dari favorit' : 'Tandai favorit'}
            className={`pressable flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:bg-[var(--elevated)] ${
              isFav
                ? 'text-[var(--primary)] bg-[var(--primary)]/10'
                : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            <Star size={14} className={isFav ? 'fill-[var(--primary)]' : ''} />
          </button>
        )}

        {/* Technical Options Modal Trigger */}
        {onOpenDetails && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenDetails()
            }}
            title="Opsi teknis file (Detail part, sync web, backup, pindah)"
            className="pressable flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-3)] transition-all hover:bg-[var(--elevated)] hover:text-[var(--text)]"
          >
            <MoreVertical size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
