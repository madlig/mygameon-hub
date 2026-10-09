'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Gamepad2, X, Grid2X2, Sparkles, Search, Users,
  KeyRound, DownloadCloud, Folder, Cloud, Clock,
  Settings, LogOut, ChevronRight, Smartphone, ShieldCheck, ShoppingCart
} from 'lucide-react'

const navSections = [
  {
    title: 'Operasional Toko',
    items: [
      { href: '/', icon: Grid2X2, label: 'Dashboard', desc: 'Ringkasan penjualan & analitik' },
      { href: '/workbench', icon: Gamepad2, label: 'Workbench', desc: 'Depot upload & persiapan file game', highlight: true },
      { href: '/scout', icon: Sparkles, label: 'Listing Studio', desc: 'Katalog rilis game baru' },
      { href: '/search', icon: ShoppingCart, label: 'Katalog & Kasir Game', desc: 'Kasir belanja PC & The Sims 4' },
      { href: '/revoke', icon: Users, label: 'CRM & Lisensi', desc: 'Kelola akses drive & lisensi Sims 4' },
    ],
  },
  {
    title: 'Workspace & Server',
    items: [
      { href: '/download', icon: DownloadCloud, label: 'Download Hub', desc: 'Monitoring download aktif', highlight: true },
      { href: '/files', icon: Folder, label: 'File Manager', desc: 'Jelajah file drive & workspace' },
      { href: '/accounts', icon: Cloud, label: 'Drive & Workspace', desc: 'Kapasitas, status limit & akun' },
      { href: '/log', icon: Clock, label: 'Log Transaksi', desc: 'Riwayat pengiriman game' },
    ],
  },
]

export default function MobileDrawer({ isOpen, onClose }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  // Tutup drawer saat rute berpindah
  useEffect(() => {
    onClose()
  }, [pathname])

  // Cegah scroll body saat drawer terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Panel */}
      <div className="relative w-[320px] max-w-[85vw] h-full bg-[var(--surface)] border-r border-white/10 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-250">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <img
              src="/brand/AMON_Shopee_Avatar_Circular_TransparentCorner.png"
              alt="MyGameON"
              className="h-8 w-8 shrink-0 object-contain drop-shadow-xs"
            />
            <div>
              <span className="text-sm font-black text-white block tracking-tight uppercase">
                MyGameON
              </span>
              <span className="text-[10px] font-mono text-amber-400 font-bold block flex items-center gap-1">
                <Smartphone size={10} />
                <span>Mobile Admin Hub</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-4)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <span className="px-2 text-[10px] font-mono uppercase tracking-wider text-[var(--text-4)] font-bold block">
                {section.title}
              </span>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-all border ${
                        isActive
                          ? 'border-amber-400/40 bg-amber-500/10 text-white font-bold'
                          : item.highlight
                          ? 'border-white/10 bg-white/5 text-[var(--text-2)] hover:border-amber-500/30 hover:bg-white/10'
                          : 'border-transparent hover:bg-white/5 text-[var(--text-3)] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isActive
                            ? 'bg-amber-400 text-black'
                            : item.highlight
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-white/10 text-[var(--text-3)]'
                        }`}>
                          <Icon size={14} />
                        </span>
                        <div className="min-w-0">
                          <span className={`text-xs block truncate ${isActive ? 'text-amber-300' : 'text-white'}`}>
                            {item.label}
                          </span>
                          <span className="text-[9px] text-[var(--text-4)] block truncate">
                            {item.desc}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={13} className={isActive ? 'text-amber-400' : 'text-[var(--text-4)]'} />
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-black/40 space-y-2">
          {session?.user && (
            <div className="px-1 py-1 text-left">
              <span className="text-[11px] font-bold text-white block truncate">
                {session.user.name || 'Administrator'}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 block truncate font-medium">
                {session.user.email}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs font-bold hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            <span>Keluar Sesi</span>
          </button>
        </div>

      </div>
    </div>
  )
}
