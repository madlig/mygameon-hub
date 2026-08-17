'use client'

import { useEffect, useRef } from 'react'
import { Check, Plus, HardDrive, Loader2, Star, Copy, Trash2, Box } from 'lucide-react'
import { AppButton } from './design-system'

export default function GameItem({
  name, meta, size, totalFiles, inCart, onAdd, onRemove, onClick,
  active = false, isFav, onToggleFav
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (active && ref.current) ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  const border = active
    ? 'border-[var(--primary)] shadow-[0_0_0_2px_rgba(255,209,0,0.3)]'
    : inCart
      ? 'border-[var(--primary)] shadow-[0_0_0_1px_rgba(255,209,0,0.15),0_8px_28px_-16px_rgba(255,209,0,0.4)]'
      : 'border-[var(--border-soft)] hover:border-[var(--border-strong)]'

  return (
    <div 
      ref={ref} 
      onClick={onClick}
      className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl bg-[var(--surface)] px-4 py-3 transition-all duration-300 cursor-pointer border ${border} hover:border-[var(--primary)]/50 hover:shadow-[0_0_0_1px_rgba(255,209,0,0.2)]`}
    >
      {/* Background Glow Effect */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: 'radial-gradient(400px circle at 50% 50%, rgba(255,255,255,0.03), transparent 60%)' }} />

      {/* Left Content */}
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
            <h3 className="truncate text-sm font-bold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors">{name}</h3>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex shrink-0 items-center gap-1 rounded border border-[var(--border-soft)] bg-[var(--elevated)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                <Box size={10} className="text-[var(--primary)]" />
                {meta}
            </div>
            {(size || totalFiles) && (
              <p className="shrink-0 text-[10px] font-medium text-[var(--text-2)]">
                {totalFiles ? `${totalFiles} file` : ''} {size && totalFiles ? '·' : ''} {size || ''}
              </p>
            )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="relative flex shrink-0 items-center gap-1">
        
        {/* Secondary Actions (Tucked away, most moved to Modal) */}
        <div className="flex items-center gap-1">
            {onToggleFav && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
                title={isFav ? 'Hapus dari favorit' : 'Tandai favorit'}
                className={`pressable flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--elevated)] ${
                  isFav ? 'text-[var(--primary)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
                }`}
              >
                <Star size={14} className={isFav ? 'fill-[var(--primary)]' : ''} />
              </button>
            )}
        </div>

        {/* Primary Cart Action */}
        <div className="ml-1 pl-2 border-l border-[var(--border-soft)]">
          {inCart ? (
            <AppButton kind="ghost" size="sm" className="border-[var(--primary)]/40 px-2 text-[var(--primary)]" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
              <Check size={14} className="sm:mr-1" /> <span className="hidden sm:inline">Ditambah</span>
            </AppButton>
          ) : (
            <AppButton size="sm" className="px-2" onClick={(e) => { e.stopPropagation(); onAdd(); }}>
              <Plus size={14} className="sm:mr-1" /> <span className="hidden sm:inline">Keranjang</span>
            </AppButton>
          )}
        </div>
      </div>
    </div>
  )
}
