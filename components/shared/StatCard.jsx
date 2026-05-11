export default function StatCard({ label, value, sub, subColor = 'text-[var(--text-3)]', icon: Icon, accent }) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-[var(--pad-card)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] text-[var(--text-2)]">{label}</p>
        {Icon && (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ background: accent ? `${accent}20` : 'var(--elevated)', color: accent || 'var(--text-2)' }}
          >
            <Icon size={13} />
          </span>
        )}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-[var(--text)]">{value}</p>
      {sub && (
        <p className={`mt-2 text-[10.5px] ${subColor}`}>{sub}</p>
      )}
    </div>
  )
}
