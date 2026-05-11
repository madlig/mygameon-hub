import { cn } from "@/lib/utils"

export function AppCard({ className = "", children, style, ...props }) {
  return (
    <div
      className={cn("rounded-xl border bg-[var(--surface)]", className)}
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
    sm: "h-7 px-2.5 text-[11px] font-semibold",
    md: "h-9 px-3.5 text-xs font-semibold",
    lg: "h-11 px-4 text-sm font-bold",
    icon: "h-8 w-8",
  }
  const kinds = {
    primary: "bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-105 active:brightness-95",
    ghost:
      "border border-[var(--border-soft)] bg-transparent text-[var(--text-2)] hover:border-[var(--border-strong)] hover:text-[var(--text)]",
    danger:
      "border border-[#7f3032] bg-[var(--danger-bg)] text-[#fca5a5] hover:bg-[#4a2222]",
    soft: "bg-[var(--elevated)] text-[var(--text)] hover:brightness-110",
  }

  return (
    <button
      className={cn(
        "pressable inline-flex items-center justify-center gap-1.5 rounded-lg transition disabled:pointer-events-none disabled:opacity-50",
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
    primary: "bg-[var(--primary)]/10 text-[var(--primary)]",
    success: "bg-[#22C55E]/10 text-[#4ade80]",
    danger: "bg-[#EF4444]/10 text-[#fca5a5]",
    info: "bg-[#60A5FA]/10 text-[#93c5fd]",
    sims: "bg-[#A78BFA]/10 text-[#c4b5fd]",
    warn: "bg-[#F59E0B]/10 text-[#fbbf24]",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
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
    <div className={cn("mb-2 flex items-center justify-between", className)}>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-3)]">
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]">
          <Icon size={16} />
        </span>
      )}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border bg-[var(--surface)] py-2.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-[var(--primary)]",
          Icon ? "pl-9" : "pl-3.5",
          right ? "pr-10" : "pr-3.5"
        )}
        style={{ borderColor: "var(--border-soft)" }}
        {...props}
      />
      {right && <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>}
    </div>
  )
}
