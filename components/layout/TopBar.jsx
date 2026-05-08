export default function TopBar({ title }) {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-5 py-3.5 mb-5">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      <div className="hidden md:flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{today}</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-green-500">Drive terhubung</span>
        </div>
      </div>
    </header>
  )
}