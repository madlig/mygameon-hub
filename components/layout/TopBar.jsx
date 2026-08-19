'use client'

import { ArrowLeft, LogOut, Bell, Settings, Home, ChevronRight, RefreshCw, DownloadCloud } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function TopBar({ title, backHref }) {
  const { data: session } = useSession()
  const [updateReady, setUpdateReady] = useState(false)
  const [updateStatus, setUpdateStatus] = useState(null) // 'checking', 'downloading', 'ready', 'error'
  const [updateProgress, setUpdateProgress] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    // Listen for auto-update events
    if (typeof window !== 'undefined' && window.electronAPI) {
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
      window.electronAPI.onUpdateError(() => {
        setUpdateStatus('error')
        setTimeout(() => setUpdateStatus(null), 3000)
      })
    }
  }, [updateStatus])

  const checkForUpdates = () => {
    if (window.electronAPI) {
      setUpdateStatus('checking')
      window.electronAPI.checkForUpdates()
    }
  }

  // Auto-generate Breadcrumbs based on pathname
  const getBreadcrumbs = () => {
    let category = 'Lainnya'
    if (['/', '/search', '/revoke'].includes(pathname)) category = 'General Games'
    if (pathname.startsWith('/sims4/')) category = 'The Sims 4'
    if (['/studio', '/log', '/accounts'].includes(pathname)) category = 'Workspace & Log'

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
    <header
      className="sticky top-0 z-40 -mx-[var(--pad-card)] mb-6 border-b border-[var(--border-soft)] bg-[#0a0b0f] px-[var(--pad-card)] py-3 flex items-center shadow-sm"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex w-full items-center justify-between gap-4">
        
        {/* Kiri: Breadcrumbs & Back Button */}
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          {backHref && (
            <Link href={backHref} style={{ WebkitAppRegion: 'no-drag' }} className="pressable shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-white/5 text-[var(--text-3)] transition-colors hover:bg-white/10 hover:text-[var(--text)]">
              <ArrowLeft size={14} />
            </Link>
          )}
          {/* Brand mark — mobile only */}
          <img
            src="/icons/icon-192.png"
            alt="MyGameON"
            className="h-7 w-7 shrink-0 rounded-lg ring-1 ring-white/10 md:hidden"
          />
          <div className="min-w-0 hidden md:block">
            {getBreadcrumbs()}
          </div>
          <div className="min-w-0 md:hidden">
             <h1 className="font-display truncate text-sm font-bold tracking-tight text-[var(--text)]">{title}</h1>
          </div>
        </div>

        {/* Kanan: Profil & Actions */}
        <div className="flex shrink-0 items-center gap-3 mr-28 sm:mr-32" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* UPDATE PROGRESS / READY NOTIFICATION */}
          {updateReady ? (
            <button
              onClick={() => window.electronAPI?.quitAndInstall()}
              className="pressable animate-in slide-in-from-top-2 fade-in duration-300 flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/15 px-3 py-1.5 shadow-[0_0_15px_rgba(168,85,247,0.25)] hover:bg-purple-500/25 transition-colors"
            >
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500"></span>
              </span>
              <span className="hidden text-[11px] font-bold text-purple-400 sm:inline tracking-wide">
                Update Siap Diinstal!
              </span>
            </button>
          ) : updateStatus === 'downloading' ? (
            <div className="flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5">
              <RefreshCw size={14} className="animate-spin text-blue-400" />
              <span className="hidden text-[11px] font-bold text-blue-400 sm:inline tracking-wide">
                Mengunduh... {updateProgress}%
              </span>
            </div>
          ) : updateStatus === 'checking' ? (
            <div className="flex items-center gap-2 rounded-full border border-gray-500/30 bg-gray-500/10 px-3 py-1.5">
              <RefreshCw size={14} className="animate-spin text-gray-400" />
              <span className="hidden text-[11px] font-bold text-gray-400 sm:inline tracking-wide">
                Mengecek update...
              </span>
            </div>
          ) : updateStatus === 'error' ? (
            <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5">
              <span className="hidden text-[11px] font-bold text-red-400 sm:inline tracking-wide">
                Update gagal.
              </span>
            </div>
          ) : null}

          {/* Icon Actions */}
          <div className="hidden items-center gap-1 sm:flex">
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-white/10 hover:text-[var(--text)]">
              <Bell size={15} />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-white/10 hover:text-[var(--text)]">
              <Settings size={15} />
            </button>
          </div>

          <div className="h-5 w-px bg-white/10 hidden sm:block mx-1" />

          {/* User Profile */}
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block min-w-0">
              <div className="truncate text-xs font-bold text-[var(--text)] leading-none mb-1">Administrator</div>
              <div className="truncate text-[9px] font-medium text-[var(--text-4)] leading-none">mygameon.store</div>
            </div>
            
            <div className="relative group cursor-pointer">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--primary)]/30 bg-gradient-to-br from-[var(--surface)] to-[var(--elevated)] text-[11px] font-black text-[var(--primary)] shadow-[0_0_10px_rgba(255,209,0,0.1)] group-hover:border-[var(--primary)] group-hover:shadow-[0_0_15px_rgba(255,209,0,0.2)] transition-all">
                A
              </div>
              
              {/* Dropdown Menu (Hover) */}
              <div className="absolute right-0 top-full mt-2 hidden w-48 flex-col rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-1 shadow-2xl group-hover:flex">
                <button
                  onClick={checkForUpdates}
                  disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[var(--text-2)] transition-colors hover:bg-white/5 disabled:opacity-50"
                >
                  <DownloadCloud size={14} /> Cek Update Sistem
                </button>
                <div className="my-1 h-px w-full bg-white/10" />
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOut size={14} /> Keluar Sesi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
