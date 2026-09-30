'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles, CheckCircle2, AlertTriangle, Loader2, Play,
  HardDrive, ShieldCheck, Zap, FolderOpen, Trash2, ArrowRight,
  X, Check, Disc, RefreshCw, FileCheck, Copy, User, Settings2
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
  const [targetPathInput, setTargetPathInput] = useState('')
  const [userNameInput, setUserNameInput] = useState('mygameon')
  const [isMounting, setIsMounting] = useState(false)
  const [mountedDrive, setMountedDrive] = useState(null)
  const [copied, setCopied] = useState(false)

  // Pipeline Otomatis (1-Klik) State
  const [mode, setMode] = useState('auto') // 'auto' | 'manual'
  const [pipelineSession, setPipelineSession] = useState(null)
  const [isPipelineStarting, setIsPipelineStarting] = useState(false)

  // 1. Fetch info deteksi installer & update
  useEffect(() => {
    if (!isOpen || !folderName) return

    setLoading(true)
    setError(null)
    setStep('ready')
    setMountedDrive(null)
    setActiveSession(null)
    setPipelineSession(null)
    setIsPipelineStarting(false)

    fetch(`/api/installer/detect?folderName=${encodeURIComponent(folderName)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setSetupInfo(json.data)
          setCustomTitle(json.data.cleanTitle || folderName)
          setTargetPathInput(json.data.suggestedTargetPath || '')
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

  // Polling cek pipeline otomatis jika sedang berjalan
  useEffect(() => {
    if (!pipelineSession?.pipelineId || pipelineSession.status !== 'running') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/installer/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pipeline_status', pipelineId: pipelineSession.pipelineId })
        })
        const json = await res.json()
        if (json.success && json.pipeline) {
          setPipelineSession(json.pipeline)
          if (json.pipeline.statusText) setStatusText(json.pipeline.statusText)

          if (json.pipeline.status === 'completed') {
            setStep('completed')
            setStatusText(json.pipeline.statusText || 'Instalasi game matang selesai 100%!')
          } else if (json.pipeline.status === 'error') {
            setError(json.pipeline.error || 'Pipeline instalasi otomatis gagal')
          }
        }
      } catch (_) {}
    }, 2000)

    return () => clearInterval(interval)
  }, [pipelineSession?.pipelineId, pipelineSession?.status])

  if (!isOpen) return null

  function handleCopyPath() {
    const val = targetPathInput || setupInfo?.suggestedTargetPath
    if (val) {
      navigator.clipboard.writeText(val)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Handler: Mulai Pipeline Otomatis (1-Klik Unattended)
  async function handleStartAutoPipeline() {
    setError(null)
    setIsPipelineStarting(true)
    setStatusText('Memulai pipeline instalasi otomatis...')

    try {
      const res = await fetch('/api/installer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto_pipeline',
          folderName,
          targetDir: targetPathInput.trim() || setupInfo?.suggestedTargetPath,
          userName: userNameInput.trim() || 'mygameon'
        })
      })
      const json = await res.json()
      if (!json.success || !json.pipeline) {
        throw new Error(json.error || 'Gagal memulai pipeline otomatis')
      }
      setPipelineSession(json.pipeline)
      if (json.pipeline.statusText) setStatusText(json.pipeline.statusText)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsPipelineStarting(false)
    }
  }

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
      const effectiveTarget = targetPathInput.trim() || setupInfo.suggestedTargetPath
      const launchRes = await fetch('/api/installer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'launch_setup',
          exePath: exeToRun,
          targetDir: effectiveTarget,
          userName: userNameInput.trim() || 'mygameon'
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
      const effectiveTarget = targetPathInput.trim() || setupInfo.suggestedTargetPath
      const launchRes = await fetch('/api/installer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'launch_setup',
          exePath: setupInfo.updateExePath,
          targetDir: effectiveTarget,
          userName: userNameInput.trim() || 'mygameon'
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
      const effectiveTarget = targetPathInput.trim() || setupInfo.suggestedTargetPath
      const effTitle = customTitle.trim() || effectiveTarget.split(/[\\/]/).filter(Boolean).pop() || folderName

      const res = await fetch('/api/installer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          targetDir: effectiveTarget,
          rawBaseFolder: setupInfo.fullPath,
          rawUpdateFolder: setupInfo.updateFolder
            ? `${setupInfo.fullPath.substring(0, setupInfo.fullPath.lastIndexOf('\\'))}\\${setupInfo.updateFolder}`
            : null,
          isoPath: setupInfo.isoPath,
          cleanTitle: effTitle,
          userName: userNameInput.trim() || 'mygameon'
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

        {/* Dual Mode Switcher */}
        {setupInfo && (
          <div className="flex items-center gap-2 p-1 bg-black/40 rounded-xl border border-white/10">
            <button
              type="button"
              disabled={pipelineSession?.status === 'running'}
              onClick={() => setMode('auto')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'auto'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-md'
                  : 'text-[var(--text-3)] hover:text-white'
              }`}
            >
              <Zap size={14} />
              <span>⚡ Mode Otomatis (1-Klik Silent)</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${mode === 'auto' ? 'bg-black/20 text-black font-extrabold' : 'bg-emerald-500/10 text-emerald-400 font-bold'}`}>
                Rekomendasi
              </span>
            </button>
            <button
              type="button"
              disabled={pipelineSession?.status === 'running'}
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'manual'
                  ? 'bg-white/15 text-white shadow-md'
                  : 'text-[var(--text-3)] hover:text-white'
              }`}
            >
              <FolderOpen size={14} />
              <span>🛠️ Mode Manual (Step-by-Step)</span>
            </button>
          </div>
        )}

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
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[var(--text-4)] font-bold flex items-center gap-1.5">
                  <FolderOpen size={13} className="text-amber-400" />
                  <span>Lokasi Folder Install (Game Matang):</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {setupInfo?.suggestedTargetPath && targetPathInput !== setupInfo.suggestedTargetPath && (
                    <button
                      type="button"
                      onClick={() => setTargetPathInput(setupInfo.suggestedTargetPath)}
                      className="text-[10px] font-mono text-[var(--text-3)] hover:text-white flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/10 transition-colors cursor-pointer"
                      title="Kembalikan ke saran path default"
                    >
                      <RefreshCw size={10} />
                      <span>Reset Saran</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyPath}
                    className="text-[10px] font-mono text-amber-300 hover:text-white flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 transition-colors cursor-pointer"
                    title="Salin path folder untuk ditempel ke jendela installer jika diperlukan"
                  >
                    {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copied ? 'Tersalin!' : 'Salin Path'}</span>
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={targetPathInput}
                onChange={(e) => setTargetPathInput(e.target.value)}
                disabled={pipelineSession?.status === 'running'}
                placeholder="Contoh: D:\Game\Shopee\GameUpload\Control Resonant"
                className="w-full font-mono text-xs text-white bg-black/50 px-3 py-2 rounded-lg border border-white/10 focus:border-amber-400 focus:outline-none transition-all disabled:opacity-50"
              />
              <p className="text-[10px] text-[var(--text-4)] leading-relaxed">
                Folder tujuan instalasi hasil ekstrak bersih (bebas embel-embel scene group). Anda dapat mengubah nama folder game sesuai keinginan sebelum instalasi dimulai.
              </p>
            </div>

            {/* Parameter & Pengaturan Otomatisasi Terpasang */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2 text-xs">
              <span className="text-[10px] font-mono uppercase text-[var(--text-4)] font-bold flex items-center gap-1.5">
                <Settings2 size={13} className="text-amber-400" />
                <span>Parameter &amp; Pengaturan Otomatisasi (Standar Pre-Installed):</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300 block">Start Menu Folder</span>
                    <span className="text-[10px] text-[var(--text-4)]">Don&apos;t Create (/NOICONS)</span>
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300 block">Desktop Icon</span>
                    <span className="text-[10px] text-[var(--text-4)]">Jangan Buat Shortcut</span>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 flex items-center gap-2">
                  <User size={15} className="text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-amber-300 block">Player UserName</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="text"
                        value={userNameInput}
                        onChange={(e) => setUserNameInput(e.target.value)}
                        disabled={pipelineSession?.status === 'running'}
                        className="w-full bg-black/60 border border-white/15 rounded px-1.5 py-0.5 text-[10px] font-mono text-white focus:outline-none focus:border-amber-400"
                        title="Username yang otomatis disuntikkan ke emulator crack (Steam, Goldberg, Rune, Codex, dll)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════ */}
            {/* TAMPILAN MODE 1: OTOMATIS (1-KLIK SILENT UNATTENDED) */}
            {/* ══════════════════════════════════════════════════════ */}
            {mode === 'auto' ? (
              <div className="space-y-4 pt-1">
                {step === 'completed' || pipelineSession?.status === 'completed' ? (
                  <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-black/50 to-black/60 p-5 text-center space-y-3 shadow-xl">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto shadow-md">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">Instalasi Otomatis Sukses 100%!</h4>
                      <p className="text-xs text-[var(--text-3)] mt-1">
                        Game telah matang ke format Plug & Play di: <br />
                        <span className="font-mono text-emerald-300 font-bold break-all">{targetPathInput || setupInfo.suggestedTargetPath}</span>
                      </p>
                      <p className="text-[11px] text-amber-300/90 mt-1.5">
                        ✓ Berkas ISO mentah &amp; installer sementara telah dihapus (disk PC bertambah lega).<br />
                        ✓ Dokumen branding &amp; panduan resmi MyGameON telah disematkan.<br />
                        ✓ UserName pemain &quot;{userNameInput}&quot; telah dikonfigurasi ke seluruh emulator crack.
                      </p>
                    </div>
                  </div>
                ) : pipelineSession?.status === 'running' ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-black/40 p-4 space-y-4 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin text-amber-400" />
                        <span className="text-xs font-bold text-white">Pipeline Otomatis Sedang Berjalan...</span>
                      </div>
                      <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                        Langkah {pipelineSession.stepIndex} dari {pipelineSession.totalSteps}
                      </span>
                    </div>

                    {/* Step checklist */}
                    <div className="space-y-2.5 text-xs">
                      <div className={`flex items-center gap-2.5 ${pipelineSession.stepIndex > 1 ? 'text-emerald-400 font-medium' : pipelineSession.stepIndex === 1 ? 'text-amber-300 font-bold' : 'text-[var(--text-4)]'}`}>
                        {pipelineSession.stepIndex > 1 ? <CheckCircle2 size={16} /> : pipelineSession.stepIndex === 1 ? <Loader2 size={16} className="animate-spin text-amber-400" /> : <span className="h-4 w-4 rounded-full border border-current flex items-center justify-center text-[10px]">1</span>}
                        <span>1. Mount berkas ISO ke Virtual Drive</span>
                      </div>

                      <div className={`flex items-center gap-2.5 ${pipelineSession.stepIndex > (setupInfo.hasIso ? 2 : 1) ? 'text-emerald-400 font-medium' : pipelineSession.step === 'installing_base' ? 'text-amber-300 font-bold' : 'text-[var(--text-4)]'}`}>
                        {pipelineSession.stepIndex > (setupInfo.hasIso ? 2 : 1) ? <CheckCircle2 size={16} /> : pipelineSession.step === 'installing_base' ? <Loader2 size={16} className="animate-spin text-amber-400" /> : <span className="h-4 w-4 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>}
                        <span>2. Instalasi Game Utama (Silent Inno Setup)</span>
                      </div>

                      {setupInfo.hasUpdate && (
                        <div className={`flex items-center gap-2.5 ${pipelineSession.stepIndex > 3 ? 'text-emerald-400 font-medium' : pipelineSession.step === 'installing_update' ? 'text-amber-300 font-bold' : 'text-[var(--text-4)]'}`}>
                          {pipelineSession.stepIndex > 3 ? <CheckCircle2 size={16} /> : pipelineSession.step === 'installing_update' ? <Loader2 size={16} className="animate-spin text-amber-400" /> : <span className="h-4 w-4 rounded-full border border-current flex items-center justify-center text-[10px]">3</span>}
                          <span>3. Instalasi Patch Update (Silent Inno Setup)</span>
                        </div>
                      )}

                      <div className={`flex items-center gap-2.5 ${pipelineSession.status === 'completed' ? 'text-emerald-400 font-medium' : pipelineSession.step === 'finalizing' ? 'text-amber-300 font-bold' : 'text-[var(--text-4)]'}`}>
                        {pipelineSession.status === 'completed' ? <CheckCircle2 size={16} /> : pipelineSession.step === 'finalizing' ? <Loader2 size={16} className="animate-spin text-amber-400" /> : <span className="h-4 w-4 rounded-full border border-current flex items-center justify-center text-[10px]">{setupInfo.hasUpdate ? '4' : '3'}</span>}
                        <span>{setupInfo.hasUpdate ? '4' : '3'}. Pembersihan ISO Mentah & Injeksi Dokumen Branding</span>
                      </div>
                    </div>

                    {/* Status live bar */}
                    <div className="rounded-xl bg-black/60 border border-white/5 p-3 text-[11px] font-mono text-amber-200 flex items-center gap-2 shadow-inner">
                      <Sparkles size={14} className="text-amber-400 shrink-0" />
                      <span className="truncate">{pipelineSession.statusText}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-black/40 to-black/60 p-4 space-y-3 shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <Zap size={14} />
                      </span>
                      <span className="font-bold text-xs text-white">Full-Automated (Unattended) Pipeline</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
                      Sistem akan me-mount ISO, menginstal game utama + update secara otomatis di latar belakang (Silent), membersihkan berkas ISO mentah untuk menghemat ruang disk, dan menyuntikkan dokumen branding resmi MyGameON tanpa perlu klik berkali-kali.
                    </p>
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-[10px] text-amber-200 font-mono flex items-center gap-2">
                      <ShieldCheck size={14} className="text-amber-400 shrink-0" />
                      <span>Catatan: Jika jendela konfirmasi Administrator (UAC) Windows muncul di layar, klik &quot;Yes&quot; agar installer dapat mengekstrak berkas.</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ══════════════════════════════════════════════════════ */
              /* TAMPILAN MODE 2: MANUAL (STEP-BY-STEP GUIDED WIZARD)   */
              /* ══════════════════════════════════════════════════════ */
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-3)]">
                  Tahapan Pematangan Game (Manual):
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
            )}

            {/* Status Pesan Informasi (Jika Manual) */}
            {mode === 'manual' && statusText && (
              <div className="rounded-xl border border-amber-500/20 bg-black/40 p-3 text-xs text-amber-200/90 font-mono flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <span>{statusText}</span>
              </div>
            )}

            {/* 🎯 Action Buttons Berdasarkan Mode */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={pipelineSession?.status === 'running'}
                className="rounded-xl px-4 py-2 text-xs font-bold text-[var(--text-3)] hover:text-white transition-all cursor-pointer disabled:opacity-40"
              >
                {step === 'completed' || pipelineSession?.status === 'completed' ? 'Tutup' : 'Batal'}
              </button>

              {/* ACTION BUTTONS: MODE OTOMATIS */}
              {mode === 'auto' && (
                step === 'completed' || pipelineSession?.status === 'completed' ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      if (onSuccess) onSuccess()
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-black hover:bg-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2 size={14} />
                    <span>🚀 Selesai (Lanjut ke Pengarsipan & Upload)</span>
                  </button>
                ) : pipelineSession?.status === 'running' ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500/50 px-5 py-2.5 text-xs font-black text-black cursor-not-allowed opacity-80"
                  >
                    <Loader2 size={14} className="animate-spin" />
                    <span>Sedang Menginstal Otomatis di Latar Belakang...</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartAutoPipeline}
                    disabled={isPipelineStarting}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-2.5 text-xs font-black text-black hover:from-amber-400 hover:to-amber-300 transition-all cursor-pointer shadow-lg shadow-amber-500/25 disabled:opacity-50"
                  >
                    {isPipelineStarting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    <span>⚡ Mulai Instalasi Otomatis (1-Klik)</span>
                  </button>
                )
              )}

              {/* ACTION BUTTONS: MODE MANUAL */}
              {mode === 'manual' && (
                <>
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
                </>
              )}
            </div>

          </div>
        ) : null}

      </div>
    </div>
  )
}
