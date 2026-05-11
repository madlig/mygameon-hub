'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, Grid2X2, Search, Sparkles } from 'lucide-react'

const navItems = [
  { href: '/', icon: Grid2X2, label: 'Dashboard' },
  { href: '/search', icon: Search, label: 'Games' },
  { href: '/sims4/order', icon: Sparkles, label: 'Sims 4' },
  { href: '/log', icon: Clock, label: 'Log' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--border-soft)] md:hidden"
      style={{
        background: 'rgba(28,25,23,0.92)',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
      }}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href === '/sims4/order' && pathname.startsWith('/sims4'))
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors"
            style={{ color: isActive ? 'var(--primary)' : 'var(--text-2)' }}
          >
            {isActive && (
              <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b bg-[var(--primary)]" />
            )}
            <Icon size={20} strokeWidth={isActive ? 2 : 1.6} />
            <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
