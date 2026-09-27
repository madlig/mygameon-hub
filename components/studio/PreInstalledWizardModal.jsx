'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles, CheckCircle2, AlertTriangle, Loader2, Play,
  HardDrive, ShieldCheck, Zap, FolderOpen, Trash2, ArrowRight,
  X, Check, Disc, RefreshCw, FileCheck
} from 'lucide-react'

export default function PreInstalledWizardModal({
  isOpen,
  onClose,
  folderName,
  onSuccess
}) {
  const [loading, setLoading] = useState(true)
  const [setupInfo, setSetupInfo] = useState(null)
  const [error, setError] = useState(null)

  // Step state: 'ready' -> 'installing_base' -> 'base_done' -> 'installing_update' -> 'update_done' -> 'finalizing' -> 'completed'
  const [step, setStep] = useState('ready')
  const [statusText, setStatusText] = useState('')
  const [activeSession, setActiveSession] = useState(null)
  const [customTitle, setCustomTitle] = useState('')
  const [isMounting, setIsMounting] = useState(false)
  const [mountedDrive, setMountedDrive] = useState(null)

  // 1. Fetch info deteksi installer & update
  useEffect(() => {
    if (!isOpen || !folderName) return

    setLoading(true)
    setError(null)
    setStep('ready')
    setMountedDrive(null)
    setActiveSession(null)

    fetch(`/api/installer/detect?folderName=${encodeURIComponent(folderName)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setSetupInfo(json.data)
          setCustomTitle(json.data.cleanTitle || folderName)
        } else {
          setError(json.error || 'Gagal mendeteksi berkas installer')
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isOpen, folderName])

  // Polling cek proses installer jika sedang berjalan
  useEffect(() => {
    if (!activeSession?.sessionId || (step !== 'installing_base' && step !== 'installing_update')) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/installer/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_status', sessionId: activeSession.sessionId })
        })
        const json = await res.json()
        if (json.success && json.session) {
          if (json.session.status === 'completed') {
            if (step === 'installing_base') {
              setStep('base_done')
              setStatusText('Instalasi Game Utama selesai!')
            } else if (step === 'installing_update') {
              setStep('update_done')
              setStatusText('Instalasi Update & Verifikasi Data selesai!')
            }
          }
        }
      } catch (_) {}
    }, 3000)

    return () => clearInterval(interval)
  }, [activeSession, step])

  if (!isOpen) return null

  // Handler: Mulai Install Game Utama (Mount ISO & Launch Setup)
  async function handleStartBaseInstall() {
    setError(null)
    setIsMounting(true)
    setStatusText('Me-mount file ISO ke Virtual Drive...')

    try {
      let exeToRun = setupInfo.setupExePath
      let driveLetter = null

      if (setupInfo.hasIso) {
        const mountRes = await fetch('/api/installer/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mount', isoPath: setupInfo.isoPath })
        })
        const mountJson = await mountRes.json()
        if (!mountJson.success) throw new Error(mountJson.error || 'Gagal me-mount ISO')

        driveLetter = mountJson.data.driveLetter
        setMountedDrive(driveLetter)
        exeToRun = mountJson.data.setupExePath
      }

      if (!exeToRun) {
        throw new Error('Tidak dapat menemukan setup.exe di dalam file ISO/folder game!')
      }

      setStatusText(`Membuka setup.exe dari Drive ${driveLetter || 'Lokal'}...`)

      // Luncurkan installer
      const launchRes = await fetch('/api/installer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'launch_setup',
          exePath: exeToRun,
          targetDir: setupInfo.suggestedTargetPath
        })
      })
      const launchJson = await launchRes.json()
      if (!launchJson.success) throw new Error(launchJson.error || 'Gagal meluncurkan setup.exe')

      setActiveSession(launchJson.session)
      setStep('installing_base')
      setStatusText('Installer Game Utama berjalan di PC Anda. Silakan selesaikan instalasi pada jendela installer.')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsMounting(false)
    }
  }

  // Handler: Mulai Install Update
  async function handleStartUpdateInstall() {
    setError(null)
    setStatusText('Membuka file Update Patch...')

    try {
      const launchRes = await fetch('/api/installer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'launch_setup',
          exePath: setupInfo.updateExePath,
          targetDir: setupInfo.suggestedTargetPath
        })
      })
      const launchJson = await launchRes.json()
      if (!launchJson.success) throw new Error(launchJson.error || 'Gagal meluncurkan installer update')

      setActiveSession(launchJson.session)
      setStep('installing_update')
      setStatusText('Installer Update berjalan di PC Anda. Pastikan opsi verifikasi berkas (QuickSFV) dijalankan di akhir installer.')
    } catch (err) {
      setError(err.message)
    }
  }

  // Handler: Finalisasi (Dismount, Hapus ISO Mentah & Update Mentah, Injeksi Branding)
  async function handleFinalizeGame() {
    setError(null)
    setStep('finalizing')
    setStatusText('Membersihkan ISO mentah, menghapus folder installer, dan menyuntikkan branding MyGameON...')

    try {
      const res = await fetch('/api/installer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          targetDir: setupInfo.suggestedTargetPath,
          rawBaseFolder: setupInfo.fullPath,
          rawUpdateFolder: setupInfo.updateFolder
            ? `${setupInfo.fullPath.substring(0, setupInfo.fullPath.lastIndexOf('\\'))}\\${setupInfo.updateFolder}`
            : null,
          isoPath: setupInfo.isoPath,
          cleanTitle: customTitle
        })
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Gagal mematangkan game')

      setStep('completed')
      setStatusText('Game sukses dimatangkan ke format Pre-Installed!')
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(err.message)
      setStep(setupInfo.hasUpdate ? 'update_done' : 'base_done')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-amber-500/40 bg-[var(--surface)] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Zap size={20} />
            </span>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Asisten Pembuat Game Pre-Installed</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                  Plug & Play
                </span>
              </h2>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                Konversi otomatis dari file ISO mentah + installer update menjadi folder game matang siap main.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-4)] hover:bg-white/10 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3.5 flex items-start gap-2.5 text-xs text-red-300">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-3)] space-y-2">
            <Loader2 size={28} className="animate-spin text-amber-400" />
            <span className="text-xs font-mono">Memindai komponen installer & file update...</span>
          </div>
        ) : setupInfo ? (
          <div className="space-y-4">
            
            {/* 📋 Ringkasan Komponen yang Terdeteksi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-4)] font-bold block flex items-center gap-1.5">
                  <Disc size={12} className="text-amber-400" />
                  <span>Game Utama (Sumber ISO/Setup)</span>
                </span>
                <span className="font-bold text-white block truncate" title={setupInfo.hasIso ? setupInfo.isoPath : setupInfo.folderName}>
                  {setupInfo.hasIso ? '💿 Berkas ISO Terdeteksi' : '⚡ Setup Installer Terdeteksi'}
                </span>
                <span className="text-[10px] font-mono text-[var(--text-3)] block truncate">
                  {setupInfo.folderName}
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-4)] font-bold block flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <span>Installer Update Berpasangan</span>
                </span>
                {setupInfo.hasUpdate ? (
                  <>
                    <span className="font-bold text-emerald-300 block truncate">
                      ✅ Terdeteksi Update Patch
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-3)] block truncate" title={setupInfo.updateFolder}>
                      {setupInfo.updateFolder}
                    </span>
                  </>
                ) : (
                  <span className="font-medium text-[var(--text-4)] block">
                    Tidak ada file update tambahan (Hanya Game Utama)
                  </span>
                )}
              </div>
            </div>

            {/* Target Folder Penginstalan Bersih */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[var(--text-4)] font-bold flex items-center gap-1">
                  <FolderOpen size={12} className="text-amber-400" />
                  <span>Target Folder Game Matang:</span>
                </span>
                <span className="text-[10px] font-mono text-amber-300">Format Pre-Installed</span>
              </div>
              <div className="font-mono text-white text-xs bg-black/40 p-2 rounded-lg border border-white/5 break-all">
                {setupInfo.suggestedTargetPath}
              </div>
            </div>

            {/* 🚦 Step Progress Tracker */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-3)]">
                Tahapan Pematangan Game:
              </h3>

              <div className="space-y-2">
                {/* Step 1: Base Game */}
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  step === 'installing_base'
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : step === 'base_done' || step === 'installing_update' || step === 'update_done' || step === 'finalizing' || step === 'completed'
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                    : 'border-white/5 bg-white/5 text-[var(--text-4)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {step === 'base_done' || step === 'installing_update' || step === 'update_done' || step === 'finalizing' || step === 'completed' ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : step === 'installing_base' ? (
                      <Loader2 size={16} className="animate-spin text-amber-400" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">1</span>
                    )}
                    <span className="text-xs font-bold text-white">
                      1. Eksekusi Setup Game Utama
                    </span>
                  </div>
                  {mountedDrive && (
                    <span className="text-[10px] font-mono text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                      Drive {mountedDrive}:
                    </span>
                  )}
                </div>

                {/* Step 2: Update Patch */}
                {setupInfo.hasUpdate && (
                  <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    step === 'installing_update'
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : step === 'update_done' || step === 'finalizing' || step === 'completed'
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                      : 'border-white/5 bg-white/5 text-[var(--text-4)]'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {step === 'update_done' || step === 'finalizing' || step === 'completed' ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : step === 'installing_update' ? (
                        <Loader2 size={16} className="animate-spin text-amber-400" />
                      ) : (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">2</span>
                      )}
                      <span className="text-xs font-bold text-white">
                        2. Eksekusi Update Patch & Verifikasi Integritas Data (QuickSFV)
                      </span>
                    </div>
                  </div>
                )}

                {/* Step 3: Cleanup & Branding */}
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  step === 'finalizing'
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : step === 'completed'
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                    : 'border-white/5 bg-white/5 text-[var(--text-4)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {step === 'completed' ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : step === 'finalizing' ? (
                      <Loader2 size={16} className="animate-spin text-amber-400" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                        {setupInfo.hasUpdate ? '3' : '2'}
                      </span>
                    )}
                    <span className="text-xs font-bold text-white">
                      {setupInfo.hasUpdate ? '3' : '2'}. Hapus File ISO Mentah & Injeksi Panduan Direct Play
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Pesan Informasi */}
            {statusText && (
              <div className="rounded-xl border border-amber-500/20 bg-black/40 p-3 text-xs text-amber-200/90 font-mono flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <span>{statusText}</span>
              </div>
            )}

            {/* 🎯 Action Buttons Berdasarkan State */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-bold text-[var(--text-3)] hover:text-white transition-all cursor-pointer"
              >
                {step === 'completed' ? 'Tutup' : 'Batal'}
              </button>

              {step === 'ready' && (
                <button
                  type="button"
                  onClick={handleStartBaseInstall}
                  disabled={isMounting}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-2.5 text-xs font-black text-black hover:from-amber-400 hover:to-amber-300 transition-all cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isMounting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  <span>Mulai Instalasi Game Utama</span>
                </button>
              )}

              {step === 'installing_base' && (
                <button
                  type="button"
                  onClick={() => setStep('base_done')}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-black hover:bg-emerald-400 transition-all cursor-pointer shadow-lg"
                >
                  <Check size={14} />
                  <span>Konfirmasi: Setup Game Utama Selesai</span>
                </button>
              )}

              {step === 'base_done' && (
                setupInfo.hasUpdate ? (
                  <button
                    type="button"
                    onClick={handleStartUpdateInstall}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2.5 text-xs font-black text-white hover:from-blue-400 hover:to-indigo-400 transition-all cursor-pointer shadow-lg"
                  >
                    <Zap size={14} />
                    <span>Lanjut: Jalankan Installer Update</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalizeGame}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-black hover:bg-emerald-400 transition-all cursor-pointer shadow-lg"
                  >
                    <Trash2 size={14} />
                    <span>Bersihkan ISO & Jadikan Game Matang</span>
                  </button>
                )
              )}

              {step === 'installing_update' && (
                <button
                  type="button"
                  onClick={() => setStep('update_done')}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-black hover:bg-emerald-400 transition-all cursor-pointer shadow-lg"
                >
                  <Check size={14} />
                  <span>Konfirmasi: Update & Verifikasi Data Selesai</span>
                </button>
              )}

              {step === 'update_done' && (
                <button
                  type="button"
                  onClick={handleFinalizeGame}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-xs font-black text-black hover:from-emerald-400 hover:to-emerald-300 transition-all cursor-pointer shadow-lg"
                >
                  <Trash2 size={14} />
                  <span>Bersihkan Berkas Mentah & Finalisasi</span>
                </button>
              )}

              {step === 'completed' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    if (onSuccess) onSuccess()
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-black hover:bg-emerald-400 transition-all cursor-pointer shadow-lg"
                >
                  <CheckCircle2 size={14} />
                  <span>Selesai (Kembali ke Studio)</span>
                </button>
              )}
            </div>

          </div>
        ) : null}

      </div>
    </div>
  )
}
