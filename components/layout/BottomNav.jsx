'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Grid2X2,
  Gamepad2,
  DownloadCloud,
  Search,
  Menu
} from 'lucide-react'
import MobileDrawer from './MobileDrawer'

const primary = [
  { href: '/', icon: Grid2X2, label: 'Home' },
  { href: '/studio', icon: Gamepad2, label: 'Studio' },
  { href: '/download', icon: DownloadCloud, label: 'Download', badgeKey: 'download' },
  { href: '/search', icon: Search, label: 'Katalog' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeDownloadCount, setActiveDownloadCount] = useState(0)

  // Listen to open-mobile-drawer event from TopBar or any other trigger
  useEffect(() => {
    const handleOpen = () => setIsDrawerOpen(true)
    window.addEventListener('open-mobile-drawer', handleOpen)
    return () => window.removeEventListener('open-mobile-drawer', handleOpen)
  }, [])

  // Poll active downloads count for live indicator
  useEffect(() => {
    const checkDownloads = () => {
      fetch('/api/download/status')
        .then((r) => r.json())
        .then((j) => {
          if (j.success && j.data?.activeItems) {
            setActiveDownloadCount(j.data.activeItems.length)
          }
        })
        .catch(() => {})
    }
    checkDownloads()
    const interval = setInterval(checkDownloads, 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/10 md:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.6)]"
        style={{
          background: 'rgba(10, 11, 15, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          paddingBottom: 'env(safe-area-inset-bottom, 14px)',
          paddingTop: '6px',
          paddingLeft: '6px',
          paddingRight: '6px'
        }}
      >
        {primary.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const hasBadge = item.badgeKey === 'download' && activeDownloadCount > 0

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-all duration-200"
              style={{ color: isActive ? 'var(--primary)' : 'var(--text-3)' }}
            >
              <div className={`relative flex items-center justify-center h-8 w-12 rounded-xl transition-all duration-200 ${isActive ? 'bg-[var(--primary)]/20 scale-105' : 'bg-transparent scale-100'}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[var(--primary)]' : ''} />
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black animate-pulse shadow-sm shadow-amber-500/50">
                    {activeDownloadCount}
                  </span>
                )}
              </div>
              <span className={`text-[9px] tracking-tight transition-all ${isActive ? 'font-black text-[var(--primary)]' : 'font-semibold text-[var(--text-4)]'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* Menu Tab to Open Full Drawer */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[var(--text-3)] hover:text-white transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center justify-center h-8 w-12 rounded-xl bg-transparent scale-100">
            <Menu size={20} strokeWidth={2} />
          </div>
          <span className="text-[9px] tracking-tight font-semibold text-[var(--text-4)]">
            Menu
          </span>
        </button>
      </nav>

      {/* Slide-over Mobile Navigation Drawer */}
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  )
}
