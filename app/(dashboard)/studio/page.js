'use client'

import { useState, useEffect } from 'react'
import { HardDrive, FolderOpen, AlertCircle, Loader2, UploadCloud, CheckCircle2, ChevronRight, Server, FileArchive } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'

export default function StudioPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ path: '', folders: [], archives: [] })
  const [error, setError] = useState(null)
  
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [targetWorkspace, setTargetWorkspace] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [processState, setProcessState] = useState({ status: 'idle', progress: 0, text: '' })
  
  // WinRAR Settings State
  const [rarConfig, setRarConfig] = useState({
    splitSize: 4100,
    compression: 'm5',
    solid: true,
    recoveryRecord: true,
    autoDelete: false
  })

  useEffect(() => {
    fetchScan()
    fetchWorkspaces()
    
    // Polling status setiap 2 detik jika sedang berjalan
    const interval = setInterval(checkStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  async function checkStatus() {
    try {
      const res = await fetch('/api/studio/status')
      const state = await res.json()
      if (state && state.status) {
        setProcessState(state)
        // Auto-refresh daftar game jika sukses
        if (state.status === 'success' && processState.status === 'processing') {
            fetchScan()
        }
      }
    } catch (e) {
      // Abaikan error polling
    }
  }

  async function startProcessing() {
    if (!selectedFolder || !targetWorkspace) return
    
    try {
      setProcessState({ status: 'processing', progress: 0, text: 'Mengirim perintah...' })
      const res = await fetch('/api/studio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: selectedFolder.path,
          targetEmail: targetWorkspace.email,
          config: rarConfig
        })
      })
      
      const json = await res.json()
      if (!res.ok) {
        setProcessState({ status: 'error', progress: 0, text: json.error || 'Gagal memulai' })
      }
      // Pengecekan selanjutnya akan di-handle oleh polling
    } catch (e) {
      setProcessState({ status: 'error', progress: 0, text: e.message })
    }
  }

  async function fetchScan() {
    setLoading(true)
    try {
      const res = await fetch('/api/studio/scan')
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchWorkspaces() {
    try {
      const res = await fetch('/api/drive/status')
      const data = await res.json()
      setWorkspaces(data.workspaces || [])
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="fadeUp pb-24 h-full flex flex-col">
      <TopBar title="Workspace Studio" />

      {/* Mobile Warning */}
      <div className="md:hidden flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-[var(--text)] mb-2">Desktop Only</h2>
        <p className="text-sm text-[var(--text-3)]">
          Fitur Automasi Upload & Arsip beroperasi menggunakan Local Processor dan hanya dapat diakses melalui perangkat Desktop/PC Anda.
        </p>
      </div>

      {/* Desktop Interface */}
      <div className="hidden md:flex flex-col flex-1 mt-6">
        <div className="mb-6 flex items-end justify-between">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">Automasi Arsip & Upload</p>
                <h2 className="font-display mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--text)]">
                    Workspace <span className="gradient-text">Studio</span>
                </h2>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[var(--surface)] px-3 py-1.5 border border-[var(--border-soft)]">
                <HardDrive size={14} className="text-[var(--primary)]" />
                <span className="text-xs font-mono text-[var(--text-2)]">{data.path || 'Loading path...'}</span>
            </div>
        </div>

        {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {error}
                <button onClick={fetchScan} className="ml-4 font-bold text-red-300 underline">Coba Lagi</button>
            </div>
        ) : (
            <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Kolom Kiri: File Explorer */}
                <div className="flex flex-col rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--elevated)] px-5 py-4 shrink-0">
                        <div className="flex items-center gap-2">
                            <FolderOpen size={18} className="text-[var(--primary)]" />
                            <h3 className="font-bold text-[var(--text)]">Local Ready Games</h3>
                        </div>
                        <button onClick={fetchScan} disabled={loading} className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
                            {loading ? 'Scanning...' : 'Refresh'}
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {loading ? (
                            <div className="flex h-32 items-center justify-center text-[var(--text-3)]">
                                <Loader2 className="animate-spin" />
                            </div>
                        ) : data.folders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-center px-6 border-2 border-dashed border-[var(--border-soft)] rounded-xl m-2">
                                <FileArchive size={24} className="text-[var(--text-4)] mb-2" />
                                <p className="text-sm font-medium text-[var(--text-3)]">Folder Kosong</p>
                                <p className="text-[10px] text-[var(--text-4)] mt-1">Simpan game yang sudah diinstall ke dalam {data.path}</p>
                            </div>
                        ) : (
                            data.folders.map(folder => (
                                <button 
                                    key={folder.name}
                                    onClick={() => setSelectedFolder(folder)}
                                    className={`w-full flex items-center justify-between rounded-xl px-4 py-3 transition-colors ${
                                        selectedFolder?.name === folder.name 
                                        ? 'bg-[var(--primary)]/10 text-[var(--primary)] shadow-[inset_0_0_0_1px_rgba(255,209,0,0.3)]' 
                                        : 'bg-transparent text-[var(--text-2)] hover:bg-[var(--elevated)]'
                                    }`}
                                >
                                    <span className="font-semibold text-sm truncate pr-4">{folder.name}</span>
                                    {selectedFolder?.name === folder.name && <ChevronRight size={16} />}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Kolom Kanan: Konfigurasi & Proses */}
                <div className="flex flex-col rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden shadow-sm p-5 relative">
                    {!selectedFolder ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-[var(--surface)] z-10">
                            <UploadCloud size={48} className="text-[var(--border-strong)] mb-4" />
                            <h3 className="text-lg font-bold text-[var(--text-2)]">Pilih Game</h3>
                            <p className="text-sm text-[var(--text-3)] mt-2">Silakan pilih game dari panel sebelah kiri untuk memulai proses Archiving dan Upload.</p>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-lg font-bold text-[var(--text)] mb-1 truncate">{selectedFolder.name}</h3>
                            <p className="text-xs text-[var(--text-3)] mb-6 font-mono truncate">{selectedFolder.path}</p>

                            <div className="mb-6">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-3">
                                    Pilih Workspace Tujuan
                                </label>
                                <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1">
                                    {workspaces.map(ws => (
                                        <button
                                            key={ws.email}
                                            onClick={() => setTargetWorkspace(ws)}
                                            className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                                                targetWorkspace?.email === ws.email 
                                                ? 'border-blue-500 bg-blue-500/10' 
                                                : 'border-[var(--border-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--elevated)]'
                                            }`}
                                        >
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                                                <Server size={14} />
                                            </div>
                                            <div className="text-left flex-1 min-w-0">
                                                <div className={`truncate text-sm font-bold ${targetWorkspace?.email === ws.email ? 'text-blue-400' : 'text-[var(--text)]'}`}>{ws.email}</div>
                                            </div>
                                            {targetWorkspace?.email === ws.email && <CheckCircle2 size={16} className="text-blue-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6 rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">Konfigurasi WinRAR</h4>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="text-xs font-semibold text-[var(--text-2)]">Split Size (MB)</label>
                                        <input 
                                            type="number" 
                                            value={rarConfig.splitSize} 
                                            onChange={e => setRarConfig({...rarConfig, splitSize: parseInt(e.target.value) || 0})}
                                            className="w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="text-xs font-semibold text-[var(--text-2)]">Compression</label>
                                        <select 
                                            value={rarConfig.compression}
                                            onChange={e => setRarConfig({...rarConfig, compression: e.target.value})}
                                            className="w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)]"
                                        >
                                            <option value="m5">Best</option>
                                            <option value="m4">Good</option>
                                            <option value="m3">Normal</option>
                                            <option value="m0">Store (Fast)</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-soft)]">
                                        <label className="text-xs font-semibold text-[var(--text-2)]">Solid Archive</label>
                                        <input 
                                            type="checkbox" 
                                            checked={rarConfig.solid}
                                            onChange={e => setRarConfig({...rarConfig, solid: e.target.checked})}
                                            className="accent-[var(--primary)] w-4 h-4"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="text-xs font-semibold text-[var(--text-2)]">Recovery Record (5%)</label>
                                        <input 
                                            type="checkbox" 
                                            checked={rarConfig.recoveryRecord}
                                            onChange={e => setRarConfig({...rarConfig, recoveryRecord: e.target.checked})}
                                            className="accent-[var(--primary)] w-4 h-4"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-soft)]">
                                        <div className="flex flex-col">
                                            <label className="text-xs font-semibold text-red-400">Auto-Delete Folder Lokal</label>
                                            <span className="text-[9px] text-[var(--text-4)]">Hapus otomatis setelah sukses upload</span>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={rarConfig.autoDelete}
                                            onChange={e => setRarConfig({...rarConfig, autoDelete: e.target.checked})}
                                            className="accent-red-500 w-4 h-4"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto">
                                {/* Status Box */}
                                {processState.status !== 'idle' && (
                                    <div className={`mb-4 rounded-xl p-4 text-xs ${
                                        processState.status === 'error' ? 'bg-red-500/10 text-red-400' :
                                        processState.status === 'success' ? 'bg-green-500/10 text-green-400' :
                                        'bg-blue-500/10 text-blue-400'
                                    }`}>
                                        <div className="flex items-center justify-between font-bold mb-2">
                                            <span>{processState.status === 'processing' ? 'Memproses...' : processState.status === 'error' ? 'Error' : 'Selesai'}</span>
                                            <span>{processState.progress}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden mb-2">
                                            <div 
                                                className={`h-full transition-all duration-500 ${processState.status === 'error' ? 'bg-red-500' : processState.status === 'success' ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                style={{ width: `${processState.progress}%` }} 
                                            />
                                        </div>
                                        <div className="mt-3 max-h-32 overflow-y-auto font-mono text-[9px] sm:text-[10px] space-y-1 pr-1 opacity-80">
                                            {processState.logs?.map((log, i) => (
                                                <div key={i} className="break-all border-b border-black/5 pb-1 mb-1 last:border-0">{log}</div>
                                            ))}
                                            {/* Auto-scroll anchor */}
                                            <div ref={(el) => el && el.scrollIntoView()} />
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={startProcessing}
                                    disabled={!targetWorkspace || processState.status === 'processing'}
                                    className={`w-full rounded-xl py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                        !targetWorkspace 
                                        ? 'bg-[var(--elevated)] text-[var(--text-4)] cursor-not-allowed'
                                        : processState.status === 'processing'
                                        ? 'bg-[var(--primary)]/50 text-[var(--text)] cursor-wait'
                                        : 'bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-105 shadow-[0_0_20px_rgba(255,209,0,0.3)]'
                                    }`}
                                >
                                    {processState.status === 'processing' ? (
                                        <><Loader2 size={16} className="animate-spin" /> Memproses (Lihat Log)</>
                                    ) : (
                                        <><UploadCloud size={18} /> Mulai Archive & Upload</>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  )
}
