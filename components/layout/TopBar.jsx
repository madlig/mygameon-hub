'use client'

import { ArrowLeft, LogOut, Home, ChevronRight, Smartphone, Menu } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import MobileConnectModal from './MobileConnectModal'

export default function TopBar({ title, backHref }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isElectron, setIsElectron] = useState(false)
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI)
  }, [])

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getBreadcrumbs = () => {
    let category = 'Lainnya'
    if (['/', '/workbench', '/studio', '/search', '/scout', '/revoke'].includes(pathname)) category = 'Operasional Toko'
    if (pathname.startsWith('/sims4/')) category = 'The Sims 4'
    if (['/download', '/files', '/drive-status', '/log', '/accounts'].includes(pathname)) category = 'Workspace & Log'

    return (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-4)]">
        <Home size={12} className="text-[var(--text-3)]" />
        <ChevronRight size={12} className="opacity-40" />
        <span className="uppercase tracking-wider">{category}</span>
        <ChevronRight size={12} className="opacity-40" />
        <span className="uppercase tracking-wider font-bold text-[var(--text-2)]">{title}</span>
      </div>
    )
  }

  return (
    <>
      <header
        className="sticky top-0 z-40 -mx-[var(--pad-card)] mb-6 border-b border-[var(--border-soft)] bg-[#0a0b0f]/90 backdrop-blur-md px-[var(--pad-card)] pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-2.5 sm:py-3 flex items-center shadow-xs"
        style={{ WebkitAppRegion: isElectron ? 'drag' : 'no-drag' }}
      >
        <div className="flex w-full items-center justify-between gap-3 sm:gap-4">
          
          {/* Kiri: Breadcrumbs, Mobile Drawer Trigger, & Back Button */}
          <div className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
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

            {/* Brand mark — mobile only (using official mascot) */}
            <img
              src="/brand/AMON_Shopee_Avatar_Circular_TransparentCorner.png"
              alt="MyGameON"
              className="h-6 w-6 shrink-0 object-contain drop-shadow-xs md:hidden"
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
            
            {/* Tombol Akses HP / Mobile Connect (Hanya Tampil di Desktop) */}
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              title="Hubungkan HP & Dapatkan Link Remote / QR Code"
            >
              <Smartphone size={13} className="text-amber-400" />
              <span>Remote HP</span>
            </button>

            <div className="h-4 w-px bg-white/10 hidden sm:block mx-0.5" />

            {/* User Profile (Click Popover) */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg p-1 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="hidden text-right sm:block min-w-0">
                  <div className="truncate text-xs font-semibold text-[var(--text)] leading-none mb-1">
                    {session?.user?.name || 'Administrator'}
                  </div>
                  <div className="truncate text-[9px] font-mono text-[var(--text-4)] leading-none">
                    {session?.user?.email || 'mygameon.store'}
                  </div>
                </div>
                
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-bold text-[var(--primary)] transition-all">
                  {(session?.user?.name || 'A')[0].toUpperCase()}
                </div>
              </button>
              
              {/* Dropdown Menu (Click-based) */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[var(--surface)] p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-white/5 sm:hidden">
                    <div className="text-xs font-semibold text-[var(--text)] truncate">{session?.user?.name || 'Administrator'}</div>
                    <div className="text-[10px] text-[var(--text-4)] truncate">{session?.user?.email || 'mygameon.store'}</div>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                  >
                    <LogOut size={14} /> Keluar Sesi
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Connect QR Modal */}
      <MobileConnectModal isOpen={connectModalOpen} onClose={() => setConnectModalOpen(false)} />
    </>
  )
}
