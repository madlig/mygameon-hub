'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import {
  Clock, Users, Gamepad2, Grid2X2,
  Sparkles, AlertCircle, Cloud, DownloadCloud, RefreshCw, Folder, ShoppingCart, CheckCircle2
} from 'lucide-react'

const navGroups = [
  {
    label: 'Operasional Toko',
    items: [
      { href: '/', icon: Grid2X2, label: 'Dashboard' },
      { href: '/workbench', icon: Gamepad2, label: 'Workbench' },
      { href: '/scout', icon: Sparkles, label: 'Listing Studio' },
      { href: '/search', icon: ShoppingCart, label: 'Katalog & Kasir Game' },
      { href: '/revoke', icon: Users, label: 'CRM & Lisensi' },
    ],
  },
  {
    label: 'Workspace & Log',
    items: [
      { href: '/download', icon: DownloadCloud, label: 'Download Hub', badgeKey: 'download' },
      { href: '/files', icon: Folder, label: 'File Manager' },
      { href: '/accounts', icon: Cloud, label: 'Drive & Workspace' },
      { href: '/log', icon: Clock, label: 'Log Transaksi' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [driveLimit, setDriveLimit] = useState(null)
  const [activeDownloadCount, setActiveDownloadCount] = useState(0)

  const [isClient, setIsClient] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [updateStatus, setUpdateStatus] = useState(null) // 'checking', 'downloading', 'ready', 'error', 'latest'
  const [updateProgress, setUpdateProgress] = useState(0)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getAppVersion().then(ver => setAppVersion(ver)).catch(() => {})

      window.electronAPI.onUpdateAvailable(() => {
        setUpdateStatus('downloading')
      })
      window.electronAPI.onUpdateNotAvailable(() => {
        setUpdateStatus('latest')
        setTimeout(() => setUpdateStatus(null), 3500)
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
  }, [])

  const checkForUpdates = () => {
    if (window.electronAPI) {
      setUpdateStatus('checking')
      window.electronAPI.checkForUpdates()
    }
  }

  // Poll Google Drive limit status
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
    <aside className="hidden w-[256px] flex-shrink-0 flex-col border-r border-white/5 bg-[var(--surface)] md:flex shadow-xl relative z-40">
      
      {/* Brand Header — Using Official Mascot Asset */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <img
          src="/brand/AMON_Shopee_Avatar_Circular_TransparentCorner.png"
          alt="MyGameON"
          className="h-10 w-10 shrink-0 object-contain drop-shadow-sm select-none"
        />
        <div className="min-w-0">
          <h1 className="text-base font-black tracking-tight text-[var(--text)] uppercase leading-none" style={{ fontFamily: 'var(--font-display)' }}>
            MyGameON
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-4)] mt-1">Studio Hub</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-2 space-y-6 scrollbar-none">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-4)]">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                const showDownloadBadge = item.badgeKey === 'download' && activeDownloadCount > 0

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors outline-none ${
                      isActive
                        ? 'bg-white/[0.08] text-white font-semibold'
                        : 'text-[var(--text-3)] hover:text-[var(--text)] hover:bg-white/[0.03] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon 
                        size={18} 
                        className={`shrink-0 transition-colors ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-4)] group-hover:text-[var(--text-2)]'}`}
                        strokeWidth={isActive ? 2.25 : 1.75}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {showDownloadBadge && (
                      <span className="inline-flex items-center justify-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-400">
                        {activeDownloadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status Bar Footer (Quiet, Minimalist & 100% Functional) */}
      <div className="mt-auto border-t border-white/5 p-3.5 space-y-2.5">
        {/* Drive Limit Alert or Normal Quiet Status */}
        {driveLimit?.status === 'limit' ? (
          <Link
            href="/accounts"
            className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/20"
            title={driveLimit.limited?.join(', ') || driveLimit.email}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="font-bold text-red-400 truncate">Drive Limit</span>
            </div>
            <span className="text-[11px] font-mono text-red-400/80 underline shrink-0">Periksa</span>
          </Link>
        ) : session?.error === 'RefreshTokenError' ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertCircle size={15} className="shrink-0" />
            <span className="font-semibold truncate">Sesi Berakhir</span>
          </div>
        ) : (
          <div className="flex items-center justify-between px-1 text-xs">
            <div className="flex items-center gap-2 min-w-0" title="Koneksi Google Drive normal & aktif">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              <span className="font-medium text-[var(--text-3)] truncate">Cloud Normal</span>
            </div>
            {appVersion && (
              <span className="text-xs font-mono text-[var(--text-4)]">v{appVersion}</span>
            )}
          </div>
        )}

        {/* Dedicated Auto-Update / Self-Update Control Button */}
        {isClient && window.electronAPI && (
          <div>
            {updateReady ? (
              <button
                type="button"
                onClick={() => window.electronAPI?.quitAndInstall()}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/20 px-3 py-2.5 text-xs font-bold text-purple-300 hover:bg-purple-500/30 transition-all cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.25)] animate-pulse"
              >
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                <span>Restart & Install Update!</span>
              </button>
            ) : updateStatus === 'downloading' ? (
              <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-400">
                <RefreshCw size={13} className="animate-spin text-blue-400" />
                <span>Mengunduh {updateProgress}%</span>
              </div>
            ) : updateStatus === 'checking' ? (
              <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--text-3)]">
                <RefreshCw size={13} className="animate-spin text-[var(--text-3)]" />
                <span>Memeriksa Update...</span>
              </div>
            ) : updateStatus === 'latest' ? (
              <div className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 animate-in fade-in">
                <CheckCircle2 size={14} />
                <span>Aplikasi Versi Terbaru</span>
              </div>
            ) : updateStatus === 'error' ? (
              <button
                type="button"
                onClick={checkForUpdates}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                <AlertCircle size={14} />
                <span>Gagal Cek · Coba Lagi</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={checkForUpdates}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 px-3 py-2 text-xs font-semibold text-[var(--text-2)] hover:text-white transition-all cursor-pointer"
                title="Periksa apakah ada pembaruan rilis baru di GitHub"
              >
                <DownloadCloud size={14} className="text-[var(--text-3)]" />
                <span>Cek Update Sistem</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
