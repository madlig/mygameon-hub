import { Check, Plus } from 'lucide-react'
import { AppButton } from './design-system'

export default function GameItem({ name, meta, inCart, onAdd, onRemove }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border bg-[var(--surface)] transition-colors ${
        inCart ? 'border-[var(--primary)]' : 'border-[var(--border-soft)] hover:border-[var(--border-strong)]'
      }`}
    >
      <div className="min-w-0 flex-1 px-4 py-3">
        <p className="truncate text-[13px] font-medium text-[var(--text)]">{name}</p>
        <p className="mono mt-0.5 text-[10.5px] text-[var(--text-3)]">{meta}</p>
      </div>
      {inCart ? (
        <AppButton kind="ghost" size="sm" className="mr-3 shrink-0 text-[var(--primary)]" onClick={onRemove}>
          <Check size={13} /> Added
        </AppButton>
      ) : (
        <AppButton size="sm" className="mr-3 shrink-0" onClick={onAdd}>
          <Plus size={13} /> Keranjang
        </AppButton>
      )}
    </div>
  )
}
