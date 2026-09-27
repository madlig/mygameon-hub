'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  DownloadCloud, HardDrive, RefreshCw, FolderOpen, ExternalLink, Play,
  CheckCircle2, Clock, Loader2, ArrowRight, Zap, AlertTriangle, ShieldCheck,
  Package, FileCode, Check, Layers, ChevronRight, Sparkles, Terminal
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'

export default function DownloadHubPage() {
  const [data, setData] = useState({
    targetDir: 'D:\\Game\\Shopee\\GameDownload',
    uploadDir: 'D:\\Game\\Shopee\\GameUpload',
    autoHandoff: false,
    isRunning: false,
    activeItems: [],
    readyItems: [],
    historyItems: []
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [launchingJd, setLaunchingJd] = useState(false)
  const [handoffLoading, setHandoffLoading] = useState({}) // { [folderName]: boolean }
  const [handoffSuccess, setHandoffSuccess] = useState({}) // { [folderName]: true }
  const [notification, setNotification] = useState(null)

  // ── 1. Fetch Status Download ──
  const fetchStatus = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true)
    try {
      const res = await fetch('/api/download/status')
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Gagal mengambil status download:', err)
    } finally {
      setLoading(false)
      if (!isSilent) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Polling setiap 8 detik untuk memantau progress unduhan
    const interval = setInterval(() => {
      fetchStatus(true)
    }, 8000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // ── 2. Toggle Auto-Handoff ──
  async function handleToggleAutoHandoff() {
    const nextVal = !data.autoHandoff
    try {
      const res = await fetch('/api/download/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoHandoff: nextVal })
      })
      const json = await res.json()
      if (json.success) {
        setData((prev) => ({ ...prev, autoHandoff: nextVal }))
        setNotification({
          type: 'success',
          text: nextVal ? '⚡ Auto-Handoff Aktif: Game selesai akan otomatis dioper ke Upload Studio' : 'Auto-Handoff Dinonaktifkan'
        })
        setTimeout(() => setNotification(null), 4000)
      }
    } catch (err) {
      console.error('Gagal menyimpan preferensi auto-handoff:', err)
    }
  }

  // ── 3. Luncurkan JDownloader 2 ──
  async function handleLaunchJDownloader() {
    setLaunchingJd(true)
    try {
      const res = await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch_jd' })
      })
      const json = await res.json()
      if (json.success) {
        setNotification({ type: 'success', text: 'JDownloader 2 sedang diluncurkan di PC Anda' })
        setTimeout(() => setNotification(null), 4000)
        setTimeout(() => fetchStatus(true), 3000)
      } else {
        setNotification({ type: 'error', text: json.error || 'Gagal meluncurkan JDownloader' })
        setTimeout(() => setNotification(null), 5000)
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.message })
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setLaunchingJd(false)
    }
  }

  // ── 4. Buka Folder di Windows Explorer ──
  async function handleOpenFolder(folderPath) {
    try {
      await fetch('/api/download/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_folder', targetPath: folderPath || data.targetDir })
      })
    } catch (err) {
      console.error('Gagal membuka folder di explorer:', err)
    }
  }

  // ── 4b. Buka Sumber Game di In-App Protected Browser (Bebas Iklan & Auto-Bypass) ──
  function handleOpenGameSource(e, url, title) {
    if (typeof window !== 'undefined' && window.electronAPI?.openGameBrowser) {
      e.preventDefault()
      window.electronAPI.openGameBrowser(url, title)
    }
  }

  // ── 5. Eksekusi Handoff (Kirim ke Upload Studio) ──
  async function handleHandoff(folderName, mode = 'new') {
    setHandoffLoading((prev) => ({ ...prev, [folderName]: true }))
    try {
      const res = await fetch('/api/download/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName,
          mode,
          cleanReplace: true
        })
      })
      const json = await res.json()
      if (json.success) {
        setHandoffSuccess((prev) => ({ ...prev, [folderName]: true }))
        const delCount = json.deletedFiles?.length || 0
        const addCount = json.addedFiles?.length || 0
        const brandMsg = delCount > 0
          ? `(Dibersihkan ${delCount} sampah luar, disematkan ${addCount} aset MyGameON)`
          : `(Disematkan ${addCount} aset resmi MyGameON)`
        setNotification({
          type: 'success',
          text: `✅ ${folderName} siap di Studio! ${brandMsg}`
        })
        setTimeout(() => setNotification(null), 6000)
        // Refresh data setelah transfer
        fetchStatus(true)
      } else {
        setNotification({ type: 'error', text: json.error || 'Gagal melakukan handoff game' })
        setTimeout(() => setNotification(null), 6000)
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.message })
      setTimeout(() => setNotification(null), 6000)
    } finally {
      setHandoffLoading((prev) => ({ ...prev, [folderName]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <TopBar title="Download Hub" />

      {/* Floating Toast Notification */}
      {notification && (
        <div
          className={`fixed top-16 right-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300 ${
            notification.type === 'success'
              ? 'border-emerald-500/40 bg-zinc-950/95 text-emerald-400 shadow-emerald-950/50'
              : 'border-red-500/40 bg-zinc-950/95 text-red-400 shadow-red-950/50'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* 🌟 1. BANNER UTAMA & STATUS ENGINE */}
      <div className="rounded-3xl border border-[var(--border-strong)] bg-gradient-to-r from-zinc-950 via-[var(--surface)] to-zinc-950 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[var(--primary)]/5 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 shadow-sm">
                <DownloadCloud size={18} />
              </span>
              <h2 className="text-lg font-black tracking-tight text-[var(--text)] uppercase">
                Download Hub & Pipeline Ingestion
              </h2>
            </div>
            <p className="text-xs text-[var(--text-3)] max-w-2xl leading-relaxed">
              Pantau unduhan game ber-part sekuensial JDownloader dari OvaGames & situs lainnya. Sistem otomatis mendeteksi unduhan yang telah selesai diekstrak dan mengoperkannya langsung ke antrean Upload Studio.
            </p>
          </div>

          {/* Quick Engine Status & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Status JDownloader */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3.5 py-2 shadow-inner">
              <span className={`h-2.5 w-2.5 rounded-full ${data.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <div className="text-left">
                <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-4)] block leading-none">
                  Engine JDownloader 2
                </span>
                <span className="text-xs font-bold text-[var(--text-2)] leading-none mt-1 block">
                  {data.isRunning ? '🟢 Aktif Berjalan' : '⚪ Standby (Tertutup)'}
                </span>
              </div>
            </div>

            {!data.isRunning && (
              <button
                type="button"
                onClick={handleLaunchJDownloader}
                disabled={launchingJd}
                className="flex items-center gap-1.5 rounded-2xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs font-bold text-[var(--text)] hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer disabled:opacity-50"
                title="Buka aplikasi JDownloader 2 di PC"
              >
                {launchingJd ? <Loader2 size={13} className="animate-spin text-amber-400" /> : <Play size={13} className="text-amber-400" />}
                <span>Buka JDownloader</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchStatus()}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              title="Segarkan status folder download"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Path Status & Stats Strip */}
        <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Folder Unduhan:</span>
            <button
              type="button"
              onClick={() => handleOpenFolder(data.targetDir)}
              className="font-mono text-[11px] text-[var(--text-2)] bg-black/30 border border-white/5 px-2.5 py-1 rounded-lg hover:border-white/20 hover:text-white transition-colors flex items-center gap-1.5 truncate cursor-pointer"
              title="Klik untuk membuka folder di Windows Explorer"
            >
              <FolderOpen size={12} className="text-amber-400 shrink-0" />
              <span className="truncate">{data.targetDir}</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-amber-400 font-bold">{data.activeItems?.length || 0}</span>
              <span className="text-[var(--text-4)]">Aktif</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-emerald-400 font-bold">{data.readyItems?.length || 0}</span>
              <span className="text-[var(--text-4)]">Siap Dioper</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 2. INGESTION TOOLBAR & PANDUAN CEPAT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Kolom Kiri: Quick Links Situs Game Favorit (7 Cols) */}
        <div className="md:col-span-7 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
                <Sparkles size={14} className="text-[var(--primary)]" />
                <span>Pusat Sumber Game (Firefox Terisolasi)</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                🦊 Jendela Firefox Mandiri
              </span>
            </div>
            <p className="text-xs text-[var(--text-3)] leading-relaxed mb-4">
              Buka situs penyedia game di bawah melalui <strong>Jendela Firefox Terisolasi</strong>. Berjalan mandiri tanpa tercampur dengan tab pribadi Anda, kebal blokir Cloudflare, dan mendukung <strong>Click&apos;n&apos;Load</strong> ke JDownloader secara instan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
            <a
              href="https://www.ovagames.com"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => handleOpenGameSource(e, 'https://www.ovagames.com', 'OvaGames')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[var(--text)] hover:bg-white/10 hover:border-amber-400/40 hover:text-amber-300 transition-all cursor-pointer shadow-sm group"
            >
              <span>🎮 OvaGames.com</span>
              <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30">Firefox</span>
              <ExternalLink size={11} className="opacity-50 group-hover:opacity-100" />
            </a>
            <a
              href="https://steamrip.com"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => handleOpenGameSource(e, 'https://steamrip.com', 'SteamRIP')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[var(--text)] hover:bg-white/10 hover:border-blue-400/40 hover:text-blue-300 transition-all cursor-pointer shadow-sm group"
            >
              <span>⚡ SteamRip</span>
              <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.2 rounded border border-blue-500/30">Firefox</span>
              <ExternalLink size={11} className="opacity-50 group-hover:opacity-100" />
            </a>
            <a
              href="https://fitgirl-repacks.site"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => handleOpenGameSource(e, 'https://fitgirl-repacks.site', 'FitGirl Repacks')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[var(--text)] hover:bg-white/10 hover:border-purple-400/40 hover:text-purple-300 transition-all cursor-pointer shadow-sm group"
            >
              <span>📦 FitGirl Repacks</span>
              <span className="text-[9px] font-mono font-bold text-purple-400 bg-purple-500/20 px-1.5 py-0.2 rounded border border-purple-500/30">Firefox</span>
              <ExternalLink size={11} className="opacity-50 group-hover:opacity-100" />
            </a>
            <a
              href="https://dodi-repacks.site"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => handleOpenGameSource(e, 'https://dodi-repacks.site', 'DODI Repacks')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[var(--text)] hover:bg-white/10 hover:border-pink-400/40 hover:text-pink-300 transition-all cursor-pointer shadow-sm group"
            >
              <span>🚀 DODI Repacks</span>
              <span className="text-[9px] font-mono font-bold text-pink-400 bg-pink-500/20 px-1.5 py-0.2 rounded border border-pink-500/30">Firefox</span>
              <ExternalLink size={11} className="opacity-50 group-hover:opacity-100" />
            </a>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-4)]">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400">💡 Tips 1x Pasang:</span>
              <span>Pasang ekstensi di jendela Firefox ini agar bebas iklan & auto-skip:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => handleOpenGameSource(e, 'https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/', 'uBlock Origin')}
                className="text-emerald-400 hover:underline font-bold cursor-pointer"
              >
                + Pasang uBlock Origin
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={(e) => handleOpenGameSource(e, 'https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/', 'Violentmonkey')}
                className="text-blue-400 hover:underline font-bold cursor-pointer"
              >
                + Pasang Skip-Redirect
              </button>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Auto-Handoff Switch Card (5 Cols) */}
        <div className="md:col-span-5 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--text)] flex items-center gap-1.5">
                <Zap size={14} className="text-amber-400" />
                <span>Auto-Handoff ke Studio</span>
              </span>
              <button
                type="button"
                onClick={handleToggleAutoHandoff}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  data.autoHandoff ? 'bg-amber-400' : 'bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                    data.autoHandoff ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-[var(--text-3)] leading-relaxed">
              Jika diaktifkan, game yang selesai diunduh & diekstrak akan <strong>otomatis dipindahkan</strong> ke folder staging `GameUpload` dan dimasukkan ke antrean Upload Studio tanpa perlu diklik manual.
            </p>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-[var(--text-4)]">
            <span>Staging Upload:</span>
            <span className="font-bold text-[var(--text-2)] truncate max-w-[170px]">{data.uploadDir}</span>
          </div>
        </div>
      </div>

      {/* 📋 3. DUA BOARD UTAMA: AKTIF VS SIAP OPER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ⏳ BOARD 1: SEDANG DIDOWNLOAD / MENGEKSTRAK (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-xl min-h-[480px]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 text-xs font-black">
                <Clock size={13} />
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">
                Proses Unduhan Aktif ({data.activeItems?.length || 0})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Sekuensial (1 per 1)
            </span>
          </div>

          {/* List Unduhan Aktif */}
          <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-thin">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 text-[var(--text-4)]">
                <Loader2 size={24} className="animate-spin text-amber-400 mb-2" />
                <span className="text-xs font-medium">Memindai folder unduhan...</span>
              </div>
            ) : data.activeItems?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-[var(--text-4)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 mb-2.5">
                  <DownloadCloud size={24} className="opacity-30 text-amber-400" />
                </div>
                <p className="text-xs font-bold text-[var(--text-2)]">Tidak ada unduhan berjalan</p>
                <p className="text-[10px] text-[var(--text-4)] mt-1 max-w-xs leading-relaxed">
                  Buka OvaGames atau web game favorit, lalu klik Click&apos;n&apos;Load untuk mulai mengunduh. Paket download akan muncul di sini secara realtime.
                </p>
              </div>
            ) : (
              data.activeItems.map((item) => (
                <div
                  key={item.folderName}
                  className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3.5 space-y-2.5 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-black text-xs text-amber-200 block truncate" title={item.folderName}>
                        📁 {item.folderName}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-4)] mt-0.5 block">
                        Ukuran terunduh: <strong className="text-white">{item.totalSizeFormatted}</strong> ({item.fileCount} file)
                      </span>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30 shrink-0">
                      <Loader2 size={10} className="animate-spin" />
                      <span>{item.statusText}</span>
                    </span>
                  </div>

                  {/* Progress Pulse Bar */}
                  <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full animate-pulse w-3/4" />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-4)] pt-1 border-t border-white/5">
                    <span>Aktivitas disk: {item.secondsSinceLastWrite}d lalu</span>
                    <button
                      type="button"
                      onClick={() => handleOpenFolder(item.fullPath)}
                      className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FolderOpen size={11} /> Buka Folder
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ✅ BOARD 2: SIAP DIOPER KE UPLOAD STUDIO (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-xl min-h-[480px]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-black">
                <CheckCircle2 size={13} />
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">
                Unduhan Selesai & Siap Diunggah ({data.readyItems?.length || 0})
              </h3>
            </div>
            <Link
              href="/studio"
              className="text-[10px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Buka Upload Studio</span>
              <ArrowRight size={11} />
            </Link>
          </div>

          {/* List Game Siap Oper */}
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 text-[var(--text-4)]">
                <Loader2 size={24} className="animate-spin text-emerald-400 mb-2" />
                <span className="text-xs font-medium">Memindai hasil ekstraksi...</span>
              </div>
            ) : data.readyItems?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-[var(--text-4)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 mb-2.5">
                  <Package size={24} className="opacity-30 text-emerald-400" />
                </div>
                <p className="text-xs font-bold text-[var(--text-2)]">Belum ada game siap dioper</p>
                <p className="text-[10px] text-[var(--text-4)] mt-1 max-w-sm leading-relaxed">
                  Game yang telah selesai diunduh dan diekstrak 100% oleh JDownloader akan muncul di sini dengan tombol 1-klik untuk dikirim ke Upload Studio.
                </p>
              </div>
            ) : (
              data.readyItems.map((item) => {
                const isItemLoading = handoffLoading[item.folderName]
                const isTransferred = item.status === 'transferred' || handoffSuccess[item.folderName]

                return (
                  <div
                    key={item.folderName}
                    className={`rounded-2xl border p-4 transition-all shadow-md ${
                      isTransferred
                        ? 'border-white/10 bg-black/30 opacity-75'
                        : 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-black/40 to-black/30'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-sm text-white truncate max-w-[280px] sm:max-w-md" title={item.folderName}>
                            {item.folderName}
                          </h4>
                          {item.packageType === 'ISO' || item.hasIso ? (
                            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[8px] font-mono font-bold text-blue-300 border border-blue-500/30">
                              💿 DISC IMAGE (.ISO)
                            </span>
                          ) : item.packageType === 'REPACK' ? (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-mono font-bold text-amber-300 border border-amber-500/30">
                              📦 REPACK SETUP
                            </span>
                          ) : (
                            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[8px] font-mono font-bold text-purple-300 border border-purple-500/30">
                              ⚡ PRE-INSTALLED
                            </span>
                          )}
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-mono font-bold text-emerald-400 border border-emerald-500/20">
                            🛡️ Auto-Sanitize & Brand
                          </span>
                          {isTransferred && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[8px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                              ✓ SUDAH DI STUDIO
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-4)]">
                          <span>Ukuran Total: <strong className="text-emerald-300">{item.totalSizeFormatted}</strong></span>
                          <span>•</span>
                          <span>{item.fileCount} berkas</span>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => handleOpenFolder(item.fullPath)}
                            className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <FolderOpen size={10} /> Explorer
                          </button>
                        </div>
                      </div>

                      {/* Tombol Handoff Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isTransferred ? (
                          <Link
                            href="/studio"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all cursor-pointer shadow-sm"
                          >
                            <span>Lihat di Studio</span>
                            <ArrowRight size={13} />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleHandoff(item.folderName, 'new')}
                            disabled={isItemLoading}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2.5 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isItemLoading ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Zap size={13} />
                            )}
                            <span>🚀 Oper ke Upload Studio</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>

      {/* 📜 4. RIWAYAT GAME YANG TELAH DIOPER */}
      {data.historyItems?.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-black/20 p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--text-3)] flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Riwayat Handoff Game Terakhir ({data.historyItems.length})</span>
            </span>
            <Link href="/studio" className="text-[10px] font-mono text-amber-400 hover:underline flex items-center gap-1">
              <span>Ke Studio Console</span>
              <ArrowRight size={10} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {data.historyItems.slice(0, 6).map((h) => (
              <div key={h.id} className="rounded-xl border border-white/5 bg-black/40 p-3 text-xs space-y-1">
                <span className="font-bold text-white block truncate" title={h.folderName}>
                  {h.cleanTitle || h.folderName}
                </span>
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-4)]">
                  <span>{h.sizeFormatted}</span>
                  <span className="text-emerald-400">Telah Terkirim</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
