'use client'

import { ArrowLeft, LogOut, Bell, Settings, Home, ChevronRight, RefreshCw, Smartphone, Menu } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import MobileConnectModal from './MobileConnectModal'

export default function TopBar({ title, backHref }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isElectron, setIsElectron] = useState(false)
  const [connectModalOpen, setConnectModalOpen] = useState(false)

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI)
  }, [])

  const getBreadcrumbs = () => {
    let category = 'Lainnya'
    if (['/', '/studio', '/search', '/scout', '/revoke'].includes(pathname)) category = 'General Games'
    if (pathname.startsWith('/sims4/')) category = 'The Sims 4'
    if (['/download', '/files', '/drive-status', '/log', '/accounts'].includes(pathname)) category = 'Workspace & Log'

    return (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-4)]">
        <Home size={12} className="text-[var(--text-3)]" />
        <ChevronRight size={12} className="opacity-50" />
        <span className="uppercase tracking-wider">{category}</span>
        <ChevronRight size={12} className="opacity-50" />
        <span className="uppercase tracking-wider font-bold text-[var(--text-2)]">{title}</span>
      </div>
    )
  }

  return (
    <>
      <header
        className="sticky top-0 z-40 -mx-[var(--pad-card)] mb-6 border-b border-[var(--border-soft)] bg-[#0a0b0f]/90 backdrop-blur-md px-[var(--pad-card)] py-2.5 sm:py-3 flex items-center shadow-sm"
        style={{ WebkitAppRegion: isElectron ? 'drag' : 'no-drag' }}
      >
        <div className="flex w-full items-center justify-between gap-3 sm:gap-4">
          
          {/* Kiri: Breadcrumbs, Mobile Drawer Trigger, & Back Button */}
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
            {/* Hamburger for mobile */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-drawer'))}
              className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-colors md:hidden cursor-pointer"
              title="Buka Menu"
            >
              <Menu size={18} />
            </button>

            {backHref && (
              <Link href={backHref} className="pressable shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-white/5 text-[var(--text-3)] transition-colors hover:bg-white/10 hover:text-[var(--text)]">
                <ArrowLeft size={14} />
              </Link>
            )}

            {/* Brand mark — mobile only */}
            <img
              src="/icons/icon-192.png"
              alt="MyGameON"
              className="h-6 w-6 shrink-0 rounded-lg ring-1 ring-white/10 md:hidden"
            />

            <div className="min-w-0 hidden md:block">
              {getBreadcrumbs()}
            </div>
            <div className="min-w-0 md:hidden">
              <h1 className="font-display truncate text-sm font-bold tracking-tight text-[var(--text)]">{title}</h1>
            </div>
          </div>

          {/* Kanan: Profil, Akses HP & Actions */}
          <div className={`flex shrink-0 items-center gap-2 sm:gap-3 ${isElectron ? 'mr-28 sm:mr-32' : 'mr-0'}`} style={{ WebkitAppRegion: 'no-drag' }}>
            
            {/* Tombol Akses HP / Mobile Connect */}
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Hubungkan HP & Dapatkan Link / QR Code"
            >
              <Smartphone size={14} className="text-amber-400" />
              <span className="hidden sm:inline">Akses HP</span>
            </button>

            {/* Icon Actions (Desktop Only) */}
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-white/10 hover:text-[var(--text)] cursor-pointer"
                title="Refresh Halaman"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="h-5 w-px bg-white/10 hidden sm:block mx-1" />

            {/* User Profile */}
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block min-w-0">
                <div className="truncate text-xs font-bold text-[var(--text)] leading-none mb-1">
                  {session?.user?.name || 'Administrator'}
                </div>
                <div className="truncate text-[9px] font-medium text-[var(--text-4)] leading-none">
                  {session?.user?.email || 'mygameon.store'}
                </div>
              </div>
              
              <div className="relative group cursor-pointer">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--primary)]/30 bg-gradient-to-br from-[var(--surface)] to-[var(--elevated)] text-[11px] font-black text-[var(--primary)] shadow-[0_0_10px_rgba(255,209,0,0.1)] group-hover:border-[var(--primary)] group-hover:shadow-[0_0_15px_rgba(255,209,0,0.2)] transition-all">
                  {(session?.user?.name || 'A')[0].toUpperCase()}
                </div>
                
                {/* Dropdown Menu (Hover) */}
                <div className="absolute right-0 top-full mt-2 hidden w-48 flex-col rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-1 shadow-2xl group-hover:flex before:absolute before:-top-2 before:left-0 before:h-2 before:w-full z-50">
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                  >
                    <LogOut size={14} /> Keluar Sesi
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Connect QR Modal */}
      <MobileConnectModal isOpen={connectModalOpen} onClose={() => setConnectModalOpen(false)} />
    </>
  )
}
