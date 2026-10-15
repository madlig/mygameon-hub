'use client'

import Link from 'next/link'
import {
  CheckCircle2, Loader2, Play, Package, Trash2, ArrowRight,
  FolderOpen, Zap, AlertTriangle, Disc, Check, KeyRound, X
} from 'lucide-react'

export default function GamePipelineCard({
  item,
  activeExtraction = null, // jika ada proses UnRAR aktif untuk folder ini
  onInspect,
  onOpenExplorer,
  onExtract,
  onOpenExtractModal,
  onDismissExtraction,
  onCleanRar,
  onLaunchInstaller,
  onHandoff,
  onDeleteRaw,
  isExtracting = false,
  isCleaningRar = false,
  isHandoffLoading = false,
  isDeletingRaw = false
}) {
  // ── 1. Evaluasi Status Tiap Tahap Pipeline ──
  // Tahap 1: Unduh (selalu selesai untuk item di katalog download)
  const step1Download = { status: 'completed', label: '1. Unduh' }

  // Tahap 2: Ekstrak (UnRAR)
  let step2Extract = { status: 'completed', label: '2. Ekstrak' }
  const needsExtract = (item.hasRar || item.hasPartFiles || (item.completedPartsCount || 0) > 0) && !item.isExtracted && !item.isInstalledInStudio
  const isCurrentlyExtracting = isExtracting || (activeExtraction && activeExtraction.status === 'extracting')
  const hasExtractionError = Boolean(activeExtraction && activeExtraction.status === 'error')

  if (isCurrentlyExtracting) {
    step2Extract = { status: 'running', label: `2. Mengekstrak (${activeExtraction?.progressPercent || 0}%)` }
  } else if (hasExtractionError) {
    step2Extract = { status: 'error', label: '2. Gagal Ekstrak' }
  } else if (needsExtract) {
    step2Extract = { status: 'pending', label: '2. Butuh Ekstrak' }
  }

  // Tahap 3: Pasang (Silent Installer)
  let step3Install = { status: 'pending', label: '3. Pasang' }
  const isInstalling = Boolean(item.isInstalling || (item.installPipeline && item.installPipeline.status === 'running'))
  const isInstalled = Boolean(item.isInstalledInStudio)

  if (isInstalling) {
    step3Install = {
      status: 'running',
      label: `3. Memasang (${item.installPipeline?.progress?.percent || 0}%)`
    }
  } else if (isInstalled) {
    step3Install = { status: 'completed', label: '3. Terpasang' }
  } else if (!item.hasIso && item.packageType !== 'ISO' && item.packageType !== 'REPACK') {
    // Game bukan format installer (sudah pre-installed asli dari sumber)
    step3Install = { status: 'completed', label: '3. Pre-Installed' }
  }

  // Tahap 4: Siap di Workbench
  let step4Ready = { status: 'pending', label: '4. Siap Kirim' }
  const isTransferred = item.status === 'transferred'

  if (isInstalled || isTransferred) {
    step4Ready = { status: 'completed', label: '4. Siap di Workbench' }
  }

  const pipelineSteps = [step1Download, step2Extract, step3Install, step4Ready]

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-md space-y-4 ${
        isInstalled
          ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/25 via-black/50 to-black/40'
          : isInstalling
          ? 'border-amber-500/50 bg-gradient-to-r from-amber-950/25 via-black/50 to-black/40 shadow-amber-500/10'
          : isCurrentlyExtracting
          ? 'border-blue-500/40 bg-gradient-to-r from-blue-950/25 via-black/50 to-black/40'
          : hasExtractionError
          ? 'border-rose-500/40 bg-gradient-to-r from-rose-950/25 via-black/50 to-black/40'
          : 'border-white/10 bg-black/40 hover:border-white/20'
      }`}
    >
      {/* ── HEADER KARTU: JUDUL & TIPE BERKAS ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              onClick={() => onInspect(item.folderName, item.fullPath, 'download')}
              className="font-black text-sm sm:text-base text-white hover:text-amber-300 transition-colors cursor-pointer truncate max-w-sm sm:max-w-lg"
              title={item.folderName}
            >
              {item.cleanTitle || item.folderName}
            </h3>

            {/* Badge Tipe Berkas Bersih (Hanya 1 Badge Utama) */}
            {item.packageType === 'ISO' || item.hasIso ? (
              <span className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1">
                <Disc size={11} />
                <span>ISO DISC</span>
              </span>
            ) : item.packageType === 'REPACK' ? (
              <span className="rounded-lg bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-300 flex items-center gap-1">
                <Package size={11} />
                <span>REPACK SETUP</span>
              </span>
            ) : (
              <span className="rounded-lg bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-teal-300 flex items-center gap-1">
                <Zap size={11} />
                <span>PRE-INSTALLED</span>
              </span>
            )}

            {/* Status Selesai / Terpasang */}
            {isInstalled ? (
              <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span>TERPASANG ({item.installedSizeFormatted || 'Siap Kirim'})</span>
              </span>
            ) : isInstalling ? (
              <span className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1 animate-pulse">
                <Loader2 size={11} className="animate-spin text-amber-400" />
                <span>MENGINSTAL SILENT</span>
              </span>
            ) : isCurrentlyExtracting ? (
              <span className="rounded-lg bg-blue-500/20 border border-blue-500/40 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-300 flex items-center gap-1 animate-pulse">
                <Loader2 size={11} className="animate-spin text-blue-400" />
                <span>MENGEKSTRAK ({activeExtraction?.progressPercent || 0}%)</span>
              </span>
            ) : null}
          </div>

          {/* Rincian Ukuran & Metadata */}
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-4)] flex-wrap">
            <span>Ukuran: <strong className="text-white">{item.totalSizeFormatted}</strong></span>
            {item.isExtracted && item.rarPartsCount > 0 && (
              <span className="text-[11px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                (Hasil Ekstrak: <strong className="text-cyan-300">{item.extractedSizeFormatted}</strong> • Part RAR: <strong className="text-amber-400">{item.rarSizeFormatted}</strong>)
              </span>
            )}
            <span>•</span>
            <span>{item.fileCount} berkas</span>
          </div>
        </div>

        {/* Quick Icon Tools Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onInspect(item.folderName, item.fullPath, 'download')}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Lihat isi rincian berkas dalam folder"
          >
            <FolderOpen size={12} className="text-amber-400" />
            <span>Lihat Isi</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenExplorer(item.fullPath)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Buka lokasi folder di Windows Explorer"
          >
            <span>Explorer</span>
          </button>
        </div>
      </div>

      {/* ── STEPPER PIPELINE 4-TAHAP LINEAR ── */}
      <div className="bg-black/50 border border-white/5 rounded-xl p-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          {pipelineSteps.map((s, idx) => {
            const isCompleted = s.status === 'completed'
            const isRunning = s.status === 'running'
            const isError = s.status === 'error'

            return (
              <div
                key={idx}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${
                  isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-bold'
                    : isRunning
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 font-bold animate-pulse'
                    : isError
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 font-bold'
                    : 'border-white/5 bg-white/5 text-zinc-500'
                }`}
              >
                {isCompleted ? (
                  <Check size={13} className="text-emerald-400 shrink-0" />
                ) : isRunning ? (
                  <Loader2 size={13} className="animate-spin text-amber-400 shrink-0" />
                ) : isError ? (
                  <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-zinc-600 shrink-0" />
                )}
                <span className="truncate">{s.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── LIVE INLINE PROGRESS BAR (JIKA SEDANG EXTRACT / SEDANG INSTALL) ── */}
      {isInstalling && item.installPipeline && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-amber-300 font-bold flex items-center gap-1.5">
              <Zap size={13} className="text-amber-400 animate-pulse" />
              <span>{item.installPipeline.statusText || 'Mengekstrak data installer ke folder tujuan...'}</span>
            </span>
            <span className="text-amber-400 font-black text-sm">
              {item.installPipeline.progress?.percent || 0}%
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-black/60 border border-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              style={{ width: `${Math.max(item.installPipeline.progress?.percent || 0, 2)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>
              {item.installPipeline.progress?.formattedCurrent || '0 B'} / {item.installPipeline.progress?.formattedTotal || '0 B'}
              {item.installPipeline.progress?.formattedSpeed ? ` • ${item.installPipeline.progress.formattedSpeed}` : ''}
            </span>
            <span>
              {item.installPipeline.progress?.formattedEta ? `Sisa waktu: ${item.installPipeline.progress.formattedEta}` : 'Memproses berkas...'}
            </span>
          </div>
        </div>
      )}

      {isCurrentlyExtracting && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-mono gap-2">
            <span className="text-blue-300 font-bold flex items-center gap-1.5 min-w-0 truncate">
              <Loader2 size={13} className="animate-spin text-blue-400 shrink-0" />
              <span className="truncate">
                Mengekstrak Game: {activeExtraction?.currentFile || 'Memproses volume arsip...'}
              </span>
            </span>
            <span className="text-blue-400 font-black text-sm shrink-0">
              {activeExtraction?.progressPercent || 0}%
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-black/60 border border-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.4)]"
              style={{ width: `${Math.max(activeExtraction?.progressPercent || 0, 2)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 flex-wrap gap-2">
            <span>
              {activeExtraction?.extractedBytesFormatted || '0 B'} / {activeExtraction?.totalBytesFormatted || item.totalSizeFormatted || '0 B'}
              {activeExtraction?.speedFormatted ? ` • ${activeExtraction.speedFormatted}` : ''}
            </span>
            <span>
              {activeExtraction?.etaFormatted ? `Sisa waktu: ${activeExtraction.etaFormatted}` : 'Mengekstrak berkas ke disk...'}
            </span>
          </div>
        </div>
      )}

      {hasExtractionError && activeExtraction && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2 text-xs">
            <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-rose-300">Gagal Mengekstrak Arsip Game</p>
              <p className="text-[11px] text-rose-200/80 font-mono">{activeExtraction.error}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenExtractModal && (
              <button
                type="button"
                onClick={() => onOpenExtractModal(item.fullPath, item.cleanTitle || item.folderName, item.password)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 px-2.5 py-1.5 text-xs font-bold text-rose-200 transition-all cursor-pointer"
              >
                <KeyRound size={12} />
                <span>Ubah Password & Coba Lagi</span>
              </button>
            )}
            {onDismissExtraction && (
              <button
                type="button"
                onClick={() => onDismissExtraction(activeExtraction.id)}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 p-1.5 text-zinc-400 hover:text-white transition-all cursor-pointer"
                title="Tutup pesan error"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── ACTION FOOTER: SINGLE PRIMARY ACTION & QUICK CLEANUP ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
        {/* Kiri: Keterangan Langkah Selanjutnya */}
        <div className="text-xs text-[var(--text-3)] font-medium">
          {isInstalled ? (
            <span className="text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              <span>Game sudah matang di Upload Studio dan siap dioperasikan di Workbench.</span>
            </span>
          ) : isInstalling ? (
            <span className="text-amber-300">
              Instalasi silent sedang berjalan di latar belakang (aman di-minimize).
            </span>
          ) : isCurrentlyExtracting ? (
            <span className="text-blue-300">
              Proses ekstraksi UnRAR sedang berjalan di latar belakang...
            </span>
          ) : needsExtract ? (
            <span className="text-blue-300">
              Ekstrak arsip RAR untuk mendapatkan berkas installer / ISO.
            </span>
          ) : item.canCleanRar ? (
            <span className="text-amber-300">
              Ekstraksi selesai. Anda dapat menghapus berkas RAR untuk membebaskan ruang disk.
            </span>
          ) : item.packageType === 'ISO' || item.hasIso ? (
            <span className="text-zinc-300">
              Berkas ISO siap dipasang secara otomatis ke format Pre-Installed.
            </span>
          ) : (
            <span className="text-zinc-300">
              Game siap dioperkan ke Workbench untuk persiapan upload.
            </span>
          )}
        </div>

        {/* Kanan: Tombol Aksi Utama yang Dominan */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Tombol Pembersihan Ruang Disk Part RAR (Jika ada sisa RAR) */}
          {item.canCleanRar && (
            <button
              type="button"
              onClick={() => onCleanRar(item)}
              disabled={isCleaningRar}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-300 transition-all cursor-pointer disabled:opacity-50"
              title={`Hapus ${item.rarPartsCount} berkas part RAR mentah untuk membebaskan ${item.rarSizeFormatted} harddisk`}
            >
              {isCleaningRar ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              <span>Hapus File RAR ({item.rarSizeFormatted})</span>
            </button>
          )}

          {/* KASUS 1: Game Sudah Terpasang di Workbench */}
          {isInstalled ? (
            <>
              {/* Tombol Hapus Mentahan Download untuk menghemat ruang disk */}
              <button
                type="button"
                onClick={() => onDeleteRaw(item)}
                disabled={isDeletingRaw}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-300 transition-all cursor-pointer disabled:opacity-50"
                title="Hapus berkas mentahan download ini untuk menghemat harddisk"
              >
                {isDeletingRaw ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                <span>Hapus Mentahan</span>
              </button>

              {/* Opsi pasang ulang jika dibutuhkan */}
              {(item.packageType === 'ISO' || item.hasIso) && (
                <button
                  type="button"
                  onClick={() => onLaunchInstaller(item.folderName)}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-all cursor-pointer"
                  title="Pasang ulang ke lokasi lain jika diperlukan"
                >
                  <span>Pasang Ulang</span>
                </button>
              )}

              {/* Aksi Utama: Buka di Workbench */}
              <Link
                href="/workbench"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-xs font-black text-black hover:brightness-110 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <span>Buka di Workbench</span>
                <ArrowRight size={13} />
              </Link>
            </>
          ) : isInstalling ? (
            /* KASUS 2: Sedang Menginstal Silent */
            <button
              type="button"
              onClick={() => onLaunchInstaller(item.folderName)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-3.5 py-2 text-xs font-black text-black hover:brightness-110 shadow-md transition-all cursor-pointer animate-pulse"
            >
              <Zap size={13} />
              <span>🔍 Monitor Instalasi</span>
            </button>
          ) : isCurrentlyExtracting ? (
            /* KASUS 2B: Sedang Mengekstrak UnRAR */
            <div className="flex items-center gap-2">
              {activeExtraction?.id && onDismissExtraction && (
                <button
                  type="button"
                  onClick={() => onDismissExtraction(activeExtraction.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-300 transition-all cursor-pointer"
                  title="Batalkan proses ekstraksi UnRAR"
                >
                  <X size={12} />
                  <span>Batalkan</span>
                </button>
              )}
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500/30 border border-blue-500/40 px-4 py-2 text-xs font-black text-blue-200 cursor-not-allowed"
              >
                <Loader2 size={13} className="animate-spin text-blue-300" />
                <span>Mengekstrak ({activeExtraction?.progressPercent || 0}%)...</span>
              </button>
            </div>
          ) : needsExtract ? (
            /* KASUS 3: Butuh Ekstrak Arsip */
            <div className="flex items-center gap-2 flex-wrap">
              {onOpenExtractModal && (
                <button
                  type="button"
                  onClick={() => onOpenExtractModal(item.fullPath, item.cleanTitle || item.folderName, item.password)}
                  disabled={isExtracting}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                  title="Atur password arsip secara manual atau pilih opsi ekstraksi"
                >
                  <KeyRound size={12} className="text-amber-400" />
                  <span>Password</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onExtract(item.fullPath, item.cleanTitle || item.folderName, item.password, 'background')}
                disabled={isExtracting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2 text-xs font-black text-white hover:brightness-110 shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                title="Mulai proses ekstraksi arsip langsung di dalam aplikasi (dengan live progress bar)"
              >
                {isExtracting ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
                <span>📦 Ekstrak Game</span>
              </button>
            </div>
          ) : item.packageType === 'ISO' || item.hasIso || item.packageType === 'REPACK' ? (
            /* KASUS 4: File ISO atau Setup Installer (GOG/Repack) Siap Pasang ke Pre-Installed */
            <>
              <button
                type="button"
                onClick={() => onHandoff(item.folderName, 'new')}
                disabled={isHandoffLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 transition-all cursor-pointer disabled:opacity-50"
                title="Oper berkas installer ini langsung ke Workbench tanpa menginstal ke Pre-Installed"
              >
                {isHandoffLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                <span>Oper ke Workbench</span>
              </button>

              <button
                type="button"
                onClick={() => onLaunchInstaller(item.folderName)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-xs font-black text-black hover:brightness-110 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Play size={13} />
                <span>💿 Pasang Game ke Pre-Installed (Silent)</span>
              </button>
            </>
          ) : (
            /* KASUS 5: Pre-Installed Siap Handoff ke Workbench */
            <button
              type="button"
              onClick={() => onHandoff(item.folderName, 'new')}
              disabled={isHandoffLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-xs font-black text-black hover:brightness-110 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isHandoffLoading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              <span>🚀 Oper ke Workbench</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
