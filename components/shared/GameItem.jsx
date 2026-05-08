export default function GameItem({ name, meta, inCart, onAdd, onRemove }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
      inCart ? 'border-primary bg-secondary' : 'border-border bg-card'
    }`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{meta}</p>
      </div>
      {inCart ? (
        <button
          onClick={onRemove}
          className="flex-shrink-0 rounded-lg border border-primary px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          ✓ Added
        </button>
      ) : (
        <button
          onClick={onAdd}
          className="flex-shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + Keranjang
        </button>
      )}
    </div>
  )
}