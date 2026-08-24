'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import {
  Search, Settings, Clock, Users, Gamepad2, Grid2X2,
  KeyRound, Sparkles, HardDrive, CheckCircle2, AlertCircle, Loader2, Cloud, Telescope, DownloadCloud, RefreshCw
} from 'lucide-react'

const navGroups = [
  {
    label: 'General Games',
    items: [
      { href: '/', icon: Grid2X2, label: 'Dashboard' },
      { href: '/scout', icon: Telescope, label: 'Game Scout (AI)' },
      { href: '/search', icon: Search, label: 'Cari Game' },
      { href: '/revoke', icon: Users, label: 'CRM Pelanggan' },
    ],
  },
  {
    label: 'The Sims 4',
    items: [
      { href: '/sims4/order', icon: Sparkles, label: 'Order Baru' },
      { href: '/sims4/licenses', icon: KeyRound, label: 'Kelola Lisensi' },
    ],
  },
  {
    label: 'Workspace & Log',
    items: [
      { href: '/studio', icon: HardDrive, label: 'Upload Studio' },
      { href: '/drive-status', icon: Cloud, label: 'Status Drive' },
      { href: '/log', icon: Clock, label: 'Log Transaksi' },
      { href: '/accounts', icon: Settings, label: 'Pengaturan Akun' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [driveLimit, setDriveLimit] = useState(null)
  
  const [isClient, setIsClient] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [updateStatus, setUpdateStatus] = useState(null) // 'checking', 'downloading', 'ready', 'error'
  const [updateProgress, setUpdateProgress] = useState(0)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    setIsClient(true)
    // Listen for auto-update events
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getAppVersion().then(ver => setAppVersion(ver)).catch(() => {})
      
      window.electronAPI.onUpdateAvailable(() => {
        setUpdateStatus('downloading')
      })
      window.electronAPI.onUpdateNotAvailable(() => {
        if (updateStatus === 'checking') setUpdateStatus(null)
      })
      window.electronAPI.onUpdateProgress((info) => {
        if (info.percent) setUpdateProgress(Math.round(info.percent))
      })
      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateReady(true)
        setUpdateStatus('ready')
      })
      window.electronAPI.onUpdateError((err) => {
        console.error('Update Error:', err)
        setUpdateStatus('error')
        setTimeout(() => setUpdateStatus(null), 5000)
      })
    }
  }, [updateStatus])

  const checkForUpdates = () => {
    if (window.electronAPI) {
      setUpdateStatus('checking')
      window.electronAPI.checkForUpdates()
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/drive/status')
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'limit') setDriveLimit(data)
          else setDriveLimit(null)
        })
        .catch(console.error)
    }
  }, [status])

  return (
    <aside className="hidden w-[240px] flex-shrink-0 flex-col border-r border-white/5 bg-[var(--surface)] md:flex shadow-2xl relative z-40">
      
      {/* Brand Header */}
      <div className="flex flex-col items-start px-6 pt-7 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[#fbbf24] text-[var(--primary-fg)] shadow-[0_4px_20px_-5px_rgba(255,209,0,0.5)]">
            <Gamepad2 size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-[var(--text)] uppercase" style={{ fontFamily: 'var(--font-display)' }}>
              MyGameON
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-4)]">Admin Hub</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-6 scrollbar-none">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-all outline-none"
                  >
                    {/* Active Indicator Line */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--primary)] shadow-[0_0_10px_rgba(255,209,0,0.5)]" />
                    )}
                    
                    {/* Hover Background */}
                    <div className={`absolute inset-0 rounded-lg transition-colors ${isActive ? 'bg-white/5' : 'group-hover:bg-white/[0.03]'}`} />
                    
                    <Icon 
                      size={16} 
                      className={`relative z-10 transition-colors ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-4)] group-hover:text-[var(--text-2)]'}`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className={`relative z-10 text-xs tracking-wide transition-colors ${isActive ? 'font-bold text-[var(--text)]' : 'font-semibold text-[var(--text-3)] group-hover:text-[var(--text-2)]'}`}>
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Server & Cloud Status Panel (Bottom) */}
      <div className="mt-auto p-4">
        <div className="flex flex-col rounded-2xl border border-white/5 bg-black/30 p-4 shadow-inner relative overflow-hidden">
          
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] flex items-center gap-1.5"><Cloud size={12}/> Sistem Cloud</span>
            {status === 'loading' ? (
               <Loader2 size={12} className="animate-spin text-gray-400" />
            ) : session?.error === 'RefreshTokenError' || driveLimit?.status === 'limit' ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
            ) : (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-40"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
              </span>
            )}
          </div>

          {status === 'loading' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">Sinkronisasi...</span>
            </div>
          ) : session?.error === 'RefreshTokenError' ? (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-red-500">Koneksi Terputus</span>
              <span className="text-[9px] text-red-400 mt-0.5">Sesi Google berakhir</span>
            </div>
          ) : driveLimit?.status === 'limit' ? (
             <div className="flex flex-col z-10 relative">
               <span className="text-xs font-black text-red-500 tracking-wide">LIMIT TERDETEKSI</span>
               <span className="text-[10px] text-red-200 mt-1 font-medium leading-tight opacity-90 truncate">
                 {driveLimit.limited?.length > 1
                   ? `${driveLimit.email} + ${driveLimit.limited.length - 1} lainnya`
                   : (driveLimit.email || 'Workspace penuh')}
               </span>
             </div>
          ) : (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#10b981] tracking-wide">Semua Operasional</span>
              <span className="text-[10px] text-[var(--text-3)] mt-0.5 font-medium">Layanan Google Aktif & Aman</span>
            </div>
          )}

          {/* Background Danger Glow if Limit */}
          {driveLimit?.status === 'limit' && (
            <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
          )}
        </div>
        
        {/* Update Button Area */}
        {isClient && window.electronAPI && (
          <div className="mt-3">
            {updateReady ? (
              <button
                onClick={() => window.electronAPI?.quitAndInstall()}
                className="pressable w-full animate-in slide-in-from-top-2 fade-in duration-300 flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/15 px-3 py-2 shadow-[0_0_15px_rgba(168,85,247,0.25)] hover:bg-purple-500/25 transition-colors"
              >
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500"></span>
                </span>
                <span className="text-[11px] font-bold text-purple-400 tracking-wide">
                  Install Update!
                </span>
              </button>
            ) : updateStatus === 'downloading' ? (
              <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2">
                <RefreshCw size={14} className="animate-spin text-blue-400" />
                <span className="text-[11px] font-bold text-blue-400 tracking-wide">
                  Unduh {updateProgress}%
                </span>
              </div>
            ) : updateStatus === 'error' ? (
              <button
                onClick={checkForUpdates}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
              >
                <AlertCircle size={14} /> Gagal Cek Update
              </button>
            ) : (
              <button
                onClick={checkForUpdates}
                disabled={updateStatus === 'checking'}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-black/20 px-3 py-2 text-[11px] font-semibold text-[var(--text-3)] transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                {updateStatus === 'checking' ? (
                  <RefreshCw size={14} className="animate-spin text-[var(--text-3)]" />
                ) : (
                  <DownloadCloud size={14} />
                )}
                {updateStatus === 'checking' ? 'Mengecek...' : 'Cek Update Sistem'}
              </button>
            )}
            
            {appVersion && (
              <div className="mt-2 text-center">
                <span className="text-[10px] font-bold text-[var(--text-4)] tracking-widest uppercase">
                  Versi {appVersion}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
