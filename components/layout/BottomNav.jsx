'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Clock,
  Grid2X2,
  Search,
  Users,
  Sparkles,
} from 'lucide-react'

const primary = [
  { href: '/', icon: Grid2X2, label: 'Home' },
  { href: '/search', icon: Search, label: 'Katalog' },
  { href: '/sims4/order', icon: Sparkles, label: 'Sims 4', match: '/sims4' },
  { href: '/revoke', icon: Users, label: 'CRM' },
  { href: '/log', icon: Clock, label: 'Log' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-white/5 md:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
      style={{
        background: 'rgba(10, 11, 15, 0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        paddingTop: '6px',
        paddingLeft: '8px',
        paddingRight: '8px'
      }}
    >
      {primary.map((item) => {
        const isActive = item.match ? pathname.startsWith(item.match) : pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-all duration-300"
            style={{ color: isActive ? 'var(--primary)' : 'var(--text-3)' }}
          >
            <div className={`flex items-center justify-center h-8 w-14 rounded-full transition-all duration-300 ${isActive ? 'bg-[var(--primary)]/15 scale-110' : 'bg-transparent scale-100'}`}>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[var(--primary)]' : ''} />
            </div>
            <span className={`text-[9px] mt-0.5 tracking-wide transition-all ${isActive ? 'font-black text-[var(--primary)]' : 'font-semibold'}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
