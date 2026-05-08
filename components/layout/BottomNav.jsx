'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/',        icon: '⊞',  label: 'Dashboard' },
  { href: '/search',  icon: '🎮', label: 'Games'     },
  { href: '/sims4/order', icon: '🟡', label: 'Sims 4' },
  { href: '/log',     icon: '📋', label: 'Log'       },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-card md:hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 pb-6 text-xs transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}