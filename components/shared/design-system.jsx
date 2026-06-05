import { cn } from "@/lib/utils"

export function AppCard({ className = "", children, style, hover = false, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-[var(--surface)]",
        hover && "card-hover",
        className
      )}
      style={{ borderColor: "var(--border-soft)", ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

export function AppButton({
  kind = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  const sizes = {
    sm: "h-7 px-2.5 text-[11px] font-bold",
    md: "h-9 px-3.5 text-xs font-bold",
    lg: "h-11 px-4 text-sm font-bold",
    icon: "h-8 w-8",
  }
  const kinds = {
    primary:
      "bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-105 active:brightness-95 hover:shadow-[0_8px_24px_-10px_rgba(255,209,0,0.55)]",
    accent:
      "bg-[var(--accent)] text-white hover:brightness-110 active:brightness-95 hover:shadow-[0_8px_24px_-10px_rgba(139,92,246,0.6)]",
    ghost:
      "border border-[var(--border-soft)] bg-transparent text-[var(--text-2)] hover:border-[var(--border-strong)] hover:text-[var(--text)]",
    danger:
      "border border-[#7f3032] bg-[var(--danger-bg)] text-[#fca5a5] hover:bg-[#3a1d1f]",
    soft: "bg-[var(--elevated)] text-[var(--text)] hover:brightness-110",
  }

  return (
    <button
      className={cn(
        "pressable inline-flex items-center justify-center gap-1.5 rounded-xl transition disabled:pointer-events-none disabled:opacity-50",
        sizes[size],
        kinds[kind],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function AppBadge({ tone = "neutral", dot = false, className = "", children }) {
  const tones = {
    neutral: "bg-white/[.06] text-[var(--text-2)]",
    primary: "bg-[var(--primary)]/15 text-[var(--primary)]",
    success: "bg-[#22C55E]/12 text-[#4ade80]",
    danger: "bg-[#EF4444]/12 text-[#fca5a5]",
    info: "bg-[#60A5FA]/12 text-[#93c5fd]",
    sims: "bg-[#A78BFA]/15 text-[#c4b5fd]",
    accent: "bg-[var(--accent)]/15 text-[var(--accent-hi)]",
    warn: "bg-[#F59E0B]/12 text-[#fbbf24]",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide",
        tones[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function SectionLabel({ children, right, className = "" }) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">
        {children}
      </p>
      {right}
    </div>
  )
}

export function Field({ icon: Icon, value, onChange, placeholder, right, className = "", ...props }) {
  return (
    <div className={cn("relative", className)}>
      {Icon && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]">
          <Icon size={16} />
        </span>
      )}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border bg-[var(--surface)] py-2.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-[var(--primary)]",
          Icon ? "pl-10" : "pl-3.5",
          right ? "pr-10" : "pr-3.5"
        )}
        style={{ borderColor: "var(--border-soft)" }}
        {...props}
      />
      {right && <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>}
    </div>
  )
}

/* Page header with display-font title + optional accent eyebrow */
export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--text)] md:text-[28px]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}
