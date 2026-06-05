'use client'

import { useEffect, useRef } from 'react'
import { Check, Plus, HardDrive, Loader2, Star } from 'lucide-react'
import { AppButton } from './design-system'

export default function GameItem({
  name, meta, inCart, onAdd, onRemove,
  active = false, info, infoLoading, infoError, onInfo,
  isFav, onToggleFav,
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (active && ref.current) ref.current.scrollIntoView({ block: 'nearest' })
  }, [active])

  const border = active
    ? 'border-[var(--primary)] shadow-[0_0_0_2px_rgba(255,209,0,0.3)]'
    : inCart
      ? 'border-[var(--primary)] shadow-[0_0_0_1px_rgba(255,209,0,0.15),0_8px_28px_-16px_rgba(255,209,0,0.4)]'
      : 'border-[var(--border-soft)] hover:border-[var(--border-strong)]'

  return (
    <div ref={ref} className={`flex items-center justify-between gap-2 rounded-2xl border bg-[var(--surface)] transition-all ${border}`}>
      <div className="min-w-0 flex-1 px-4 py-3">
        <p className="truncate text-[13px] font-semibold text-[var(--text)]">{name}</p>
        <p className="mono mt-0.5 truncate text-[10.5px] text-[var(--text-3)]">
          {meta}
          {infoLoading && <span className="text-[var(--text-3)]"> · menghitung…</span>}
          {info && !infoLoading && <span className="text-[var(--text-2)]"> · {info}</span>}
          {infoError && !infoLoading && <span className="text-[#fca5a5]"> · gagal cek</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 pr-3">
        {onToggleFav && (
          <button
            onClick={onToggleFav}
            title={isFav ? 'Hapus dari favorit' : 'Tandai favorit'}
            className={`pressable flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--elevated)] ${
              isFav ? 'text-[var(--primary)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            <Star size={14} className={isFav ? 'fill-[var(--primary)]' : ''} />
          </button>
        )}
        {onInfo && (
          <button
            onClick={onInfo}
            disabled={infoLoading}
            title="Cek ukuran & jumlah file"
            className="pressable flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] transition-colors hover:bg-[var(--elevated)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {infoLoading ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
          </button>
        )}
        {inCart ? (
          <AppButton kind="ghost" size="sm" className="ml-0.5 border-[var(--primary)]/40 text-[var(--primary)]" onClick={onRemove}>
            <Check size={13} /> Ditambah
          </AppButton>
        ) : (
          <AppButton size="sm" className="ml-0.5" onClick={onAdd}>
            <Plus size={13} /> Keranjang
          </AppButton>
        )}
      </div>
    </div>
  )
}
