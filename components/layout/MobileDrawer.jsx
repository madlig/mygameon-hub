'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Gamepad2, X, Grid2X2, Sparkles, Search, Users,
  KeyRound, DownloadCloud, Folder, Cloud, Clock,
  Settings, LogOut, ChevronRight, Smartphone, ShieldCheck
} from 'lucide-react'

const navSections = [
  {
    title: 'General Games',
    items: [
      { href: '/', icon: Grid2X2, label: 'Dashboard', desc: 'Ringkasan penjualan & analitik' },
      { href: '/studio', icon: Gamepad2, label: 'Meja Kerja Game', desc: 'Ekstraksi ISO, WinRAR & Upload', highlight: true },
      { href: '/download', icon: DownloadCloud, label: 'Download Hub', desc: 'Monitoring download aktif', highlight: true },
      { href: '/scout', icon: Sparkles, label: 'Listing Studio', desc: 'Katalog rilis game baru' },
      { href: '/search', icon: Search, label: 'Cari Game', desc: 'Cari game & periksa aset' },
      { href: '/revoke', icon: Users, label: 'CRM Pelanggan', desc: 'Kelola akses pembeli' },
    ],
  },
  {
    title: 'The Sims 4',
    items: [
      { href: '/sims4/order', icon: Sparkles, label: 'Order Baru Sims 4', desc: 'Generate lisensi & link' },
      { href: '/sims4/licenses', icon: KeyRound, label: 'Kelola Lisensi', desc: 'Cek HWID & status user' },
    ],
  },
  {
    title: 'Workspace & Server',
    items: [
      { href: '/files', icon: Folder, label: 'File Manager', desc: 'Jelajah file drive & workspace' },
      { href: '/drive-status', icon: Cloud, label: 'Status Google Drive', desc: 'Monitoring kuota drive' },
      { href: '/log', icon: Clock, label: 'Log Transaksi', desc: 'Riwayat pengiriman game' },
      { href: '/accounts', icon: Settings, label: 'Pengaturan Akun', desc: 'Kelola token & Google API' },
    ],
  },
]

export default function MobileDrawer({ isOpen, onClose }) {
  const pathname = usePathname()

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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-amber-500 text-black shadow-md shadow-amber-500/20">
              <Gamepad2 size={18} strokeWidth={2.5} />
            </div>
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
