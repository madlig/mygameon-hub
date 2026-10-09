'use client'

import { Gamepad2, Clock, RefreshCw, FolderPlus, FolderOpen, ListOrdered, HardDrive } from 'lucide-react'

export default function WorkbenchHeader({
  activeTab = 'workbench',
  setActiveTab,
  historyCount = 0,
  queueCount = 0,
  isQueueRunning = false,
  isScanning = false,
  isElectron = true,
  stagingPath = '',
  onScan,
  onCreateFolder,
  onChangeStagingPath,
  onOpenQueueDrawer,
}) {
  return (
    <div className="flex flex-col gap-3 pb-4 border-b border-white/5 sm:flex-row sm:items-center sm:justify-between">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('workbench')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'workbench'
              ? 'bg-[var(--primary)] text-black shadow-[0_0_20px_rgba(255,209,0,0.3)]'
              : 'text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text)]'
          }`}
        >
          <Gamepad2 size={15} />
          <span>Workbench</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'
              : 'text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text)]'
          }`}
        >
          <Clock size={15} />
          <span>Riwayat Upload</span>
          {historyCount > 0 && (
            <span className="rounded-full bg-black/30 px-1.5 py-0.2 text-[10px] font-mono">
              {historyCount}
            </span>
          )}
        </button>
      </div>

      {/* Action Buttons & Status */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Antrean Drawer Toggle */}
        <button
          type="button"
          onClick={onOpenQueueDrawer}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
            isQueueRunning
              ? 'border-amber-400/40 bg-amber-400/15 text-amber-300 animate-pulse'
              : queueCount > 0
              ? 'border-white/10 bg-white/5 text-[var(--text)] hover:bg-white/10'
              : 'border-white/5 bg-black/30 text-[var(--text-4)] hover:text-[var(--text-3)]'
          }`}
          title="Buka panel antrean batch upload"
        >
          <ListOrdered size={14} className={isQueueRunning ? 'text-amber-400' : ''} />
          <span>Antrean</span>
          {queueCount > 0 && (
            <span className="rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[10px] font-mono text-amber-300">
              {queueCount}
            </span>
          )}
        </button>

        {/* Refresh Scan */}
        <button
          type="button"
          onClick={onScan}
          disabled={isScanning}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-all disabled:opacity-50"
          title="Pindai ulang folder di PC lokal"
        >
          <RefreshCw size={13} className={isScanning ? 'animate-spin text-[var(--primary)]' : ''} />
          <span className="hidden sm:inline">Pindai</span>
        </button>

        {/* Buat Folder Game Baru */}
        <button
          type="button"
          onClick={onCreateFolder}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-all"
          title="Buat folder baru di direktori staging"
        >
          <FolderPlus size={13} />
          <span className="hidden sm:inline">Folder Baru</span>
        </button>

        {/* Ubah Staging Path */}
        <button
          type="button"
          onClick={onChangeStagingPath}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-mono text-[var(--text-3)] hover:text-[var(--text)] hover:border-white/20 transition-all max-w-[170px] truncate"
          title={`Path Staging PC: ${stagingPath || '-'}`}
        >
          <HardDrive size={13} className="shrink-0 text-amber-400/80" />
          <span className="truncate">{stagingPath ? stagingPath.split(/[\\/]/).pop() || stagingPath : 'Path PC'}</span>
        </button>

        {/* Status Mode Badge */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-white/5 bg-black/40 px-2.5 py-1 text-[10px] font-mono text-[var(--text-4)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>{isElectron ? 'Desktop Mode' : 'Web Hub'}</span>
        </div>
      </div>
    </div>
  )
}
