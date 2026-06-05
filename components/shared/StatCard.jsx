export default function StatCard({ label, value, sub, subColor = 'text-[var(--text-3)]', icon: Icon, accent }) {
  return (
    <div className="card-hover rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-[var(--pad-card)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium text-[var(--text-2)]">{label}</p>
        {Icon && (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: accent ? `${accent}22` : 'var(--elevated)',
              color: accent || 'var(--text-2)',
              boxShadow: accent ? `0 0 18px -6px ${accent}66` : 'none',
            }}
          >
            <Icon size={14} />
          </span>
        )}
      </div>
      <p className="font-display mt-2.5 text-[30px] font-extrabold leading-none tracking-tight text-[var(--text)]">
        {value}
      </p>
      {sub && <p className={`mt-2 text-[10.5px] font-medium ${subColor}`}>{sub}</p>}
    </div>
  )
}
