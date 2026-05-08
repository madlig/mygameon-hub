export default function StatCard({ label, value, sub, subColor = 'text-muted-foreground' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <p className="text-2xl font-semibold text-foreground leading-none">{value}</p>
      {sub && (
        <p className={`text-xs mt-1.5 ${subColor}`}>{sub}</p>
      )}
    </div>
  )
}