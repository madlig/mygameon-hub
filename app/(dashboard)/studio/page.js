'use client'

import { useState, useEffect } from 'react'
import {
  HardDrive, FolderOpen, AlertCircle, Loader2, UploadCloud,
  CheckCircle2, ChevronRight, Server, FileArchive, Settings2,
  Trash2, Plus, Store, Cloud, Clock, CheckSquare, Square
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  } catch { return '-' }
}
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  } catch { return '-' }
}

export default function StudioPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ path: '', folders: [] })
  const [error, setError] = useState(null)
  
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [targetWorkspace, setTargetWorkspace] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [processState, setProcessState] = useState({ status: 'idle', progress: 0, text: '' })
  const [isElectron, setIsElectron] = useState(true)
  
  // Advanced Settings Toggle
  const [showSettings, setShowSettings] = useState(false)
  const [rarConfig, setRarConfig] = useState({
    splitSize: 4100, compression: 'm5', solid: true, recoveryRecord: true, autoDelete: false
  })

  // Papan Tulis (Tasks) & History
  const [tasks, setTasks] = useState([])
  const [history, setHistory] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isUpdatingTask, setIsUpdatingTask] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.electronAPI) {
      setIsElectron(false)
      setLoading(false)
      return
    }

    fetchScan()
    fetchWorkspaces()
    fetchTasks()
    fetchHistory()
    
    const interval = setInterval(checkStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  async function checkStatus() {
    try {
      const res = await fetch('/api/studio/status')
      const state = await res.json()
      if (state && state.status) {
        setProcessState(state)
        if (state.status === 'success' && processState.status === 'processing') {
            fetchScan()
            fetchHistory() // Refresh history after upload
        }
      }
    } catch (e) {}
  }

  async function fetchScan() {
    setLoading(true)
    try {
      const res = await fetch('/api/studio/scan')
      const json = await res.json()
      if (json.success) setData(json)
    } catch (err) {} finally { setLoading(false) }
  }

  async function fetchWorkspaces() {
    try {
      const res = await fetch('/api/drive/status')
      const d = await res.json()
      setWorkspaces(d.workspaces || [])
    } catch (e) {}
  }

  async function fetchTasks() {
    try {
      const res = await fetch('/api/studio/tasks')
      const d = await res.json()
      setTasks(d.tasks || [])
    } catch (e) {}
  }

  async function fetchHistory() {
    try {
      const res = await fetch('/api/studio/history')
      const d = await res.json()
      setHistory(d.history || [])
    } catch (e) {}
  }

  async function startProcessing() {
    if (!selectedFolder || !targetWorkspace) return
    try {
      setProcessState({ status: 'processing', progress: 0, text: 'Mengirim perintah...' })
      await fetch('/api/studio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: selectedFolder.path, targetEmail: targetWorkspace.email, config: rarConfig })
      })
    } catch (e) {}
  }

  // --- Task Board Actions ---
  async function addTask(e) {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    setIsUpdatingTask(true)
    try {
      const res = await fetch('/api/studio/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle })
      })
      if (res.ok) {
        setNewTaskTitle('')
        fetchTasks()
      }
    } finally { setIsUpdatingTask(false) }
  }

  async function toggleTaskStatus(id, field, currentValue) {
    try {
      setTasks(prev => prev.map(t => t._id === id ? { ...t, [field]: !currentValue } : t))
      await fetch('/api/studio/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: !currentValue })
      })
      fetchTasks()
    } catch (e) {}
  }

  async function deleteTask(id) {
    try {
      setTasks(prev => prev.filter(t => t._id !== id))
      await fetch('/api/studio/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
    } catch (e) {}
  }

  if (!isElectron) {
    return (
      <div className="fadeUp pb-24 h-full flex flex-col">
        <TopBar title="Workspace Studio" />
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertCircle size={32} /></div>
          <h2 className="text-xl font-bold mb-2 text-[var(--text)]">Desktop Version Only</h2>
          <p className="text-sm text-[var(--text-3)] max-w-md">Fitur ini hanya dapat diakses melalui perangkat Desktop menggunakan Aplikasi MyGameON lokal.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fadeUp pb-24 h-full flex flex-col">
      <TopBar title="Workspace Studio" />
      
      <div className="flex flex-col flex-1 mt-6">
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

        <div className="grid xl:grid-cols-2 gap-6 items-start">
          {/* KOLOM KIRI: MESIN UPLOAD */}
          <div className="flex flex-col gap-4">
            
            {/* Folder Explorer */}
            <div className="flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden shadow-sm max-h-[300px]">
              <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--elevated)] px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-[var(--primary)]" />
                  <h3 className="font-bold text-sm text-[var(--text)]">Pilih Game Lokal</h3>
                </div>
                <button onClick={fetchScan} disabled={loading} className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
                  {loading ? 'Scanning...' : 'Refresh'}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loading ? (
                  <div className="flex h-20 items-center justify-center text-[var(--text-3)]"><Loader2 className="animate-spin" /></div>
                ) : data.folders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-center border-2 border-dashed border-[var(--border-soft)] rounded-xl m-2">
                    <FileArchive size={20} className="text-[var(--text-4)] mb-1" />
                    <p className="text-xs font-medium text-[var(--text-3)]">Folder Kosong</p>
                  </div>
                ) : (
                  data.folders.map(folder => (
                    <button 
                      key={folder.name}
                      onClick={() => setSelectedFolder(folder)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                        selectedFolder?.name === folder.name 
                        ? 'bg-[var(--primary)]/10 text-[var(--primary)] shadow-[inset_0_0_0_1px_rgba(255,209,0,0.3)]' 
                        : 'bg-transparent text-[var(--text-2)] hover:bg-[var(--elevated)]'
                      }`}
                    >
                      <span className="font-semibold text-[13px] truncate pr-4">{folder.name}</span>
                      {selectedFolder?.name === folder.name && <ChevronRight size={14} />}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Target & Proses */}
            <div className="flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 relative">
              {!selectedFolder ? (
                <div className="flex flex-col items-center justify-center text-center p-6 text-[var(--text-3)]">
                  <UploadCloud size={32} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">Pilih game di atas untuk diupload</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 pb-4 border-b border-[var(--border-soft)]">
                    <h3 className="font-bold text-[var(--text)] text-sm truncate">{selectedFolder.name}</h3>
                    <p className="text-[10px] text-[var(--text-3)] font-mono truncate">{selectedFolder.path}</p>
                  </div>

                  {/* Dropdown Workspace */}
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-2">Target Workspace</label>
                    <select 
                      className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--elevated)] px-3 py-2.5 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                      value={targetWorkspace?.email || ''}
                      onChange={e => setTargetWorkspace(workspaces.find(w => w.email === e.target.value))}
                    >
                      <option value="" disabled>-- Pilih Akun Google Drive --</option>
                      {workspaces.map(ws => (
                        <option key={ws.email} value={ws.email}>
                          {ws.email} {ws.storage ? `(${ws.storage.usageGB}/${ws.storage.limitGB} GB)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Advanced Settings */}
                  <div className="mb-4">
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className="flex items-center gap-2 text-xs font-bold text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
                    >
                      <Settings2 size={14} /> {showSettings ? 'Sembunyikan Pengaturan WinRAR' : 'Pengaturan WinRAR'}
                    </button>
                    
                    {showSettings && (
                      <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-semibold text-[var(--text-2)]">Split Size (MB)</label>
                            <input type="number" value={rarConfig.splitSize} onChange={e => setRarConfig({...rarConfig, splitSize: parseInt(e.target.value) || 0})} className="w-20 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)]" />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-semibold text-[var(--text-2)]">Compression</label>
                            <select value={rarConfig.compression} onChange={e => setRarConfig({...rarConfig, compression: e.target.value})} className="w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)]">
                                <option value="m5">Best</option><option value="m4">Good</option><option value="m3">Normal</option><option value="m0">Fast</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-soft)]">
                            <label className="text-[11px] font-semibold text-[var(--text-2)]">Solid Archive & Recovery</label>
                            <div className="flex gap-3">
                              <input type="checkbox" title="Solid" checked={rarConfig.solid} onChange={e => setRarConfig({...rarConfig, solid: e.target.checked})} className="accent-[var(--primary)]" />
                              <input type="checkbox" title="Recovery" checked={rarConfig.recoveryRecord} onChange={e => setRarConfig({...rarConfig, recoveryRecord: e.target.checked})} className="accent-[var(--primary)]" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-soft)]">
                            <label className="text-[11px] font-semibold text-red-400">Auto-Delete Folder Lokal</label>
                            <input type="checkbox" checked={rarConfig.autoDelete} onChange={e => setRarConfig({...rarConfig, autoDelete: e.target.checked})} className="accent-red-500" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Proses Monitor */}
                  {processState.status !== 'idle' && (
                    <div className={`mb-4 rounded-xl p-3 text-xs ${
                      processState.status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      processState.status === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20'
                    }`}>
                      <div className="flex items-center justify-between font-bold mb-1.5">
                        <span>{processState.status === 'processing' ? 'Proses...' : processState.status === 'error' ? 'Error' : 'Berhasil'}</span>
                        <span>{processState.progress}%</span>
                      </div>
                      <div className="w-full h-1 bg-black/10 rounded-full overflow-hidden mb-2">
                        <div className={`h-full transition-all duration-500 ${processState.status === 'error' ? 'bg-red-500' : processState.status === 'success' ? 'bg-green-500' : 'bg-[var(--primary)]'}`} style={{ width: `${processState.progress}%` }} />
                      </div>
                      <p className="text-[10px] truncate opacity-80">{processState.text}</p>
                    </div>
                  )}

                  <button 
                    onClick={startProcessing}
                    disabled={!targetWorkspace || processState.status === 'processing'}
                    className={`w-full rounded-xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      !targetWorkspace ? 'bg-[var(--elevated)] text-[var(--text-4)] cursor-not-allowed'
                      : processState.status === 'processing' ? 'bg-[var(--primary)]/50 text-[var(--text)] cursor-wait'
                      : 'bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-105'
                    }`}
                  >
                    {processState.status === 'processing' ? <><Loader2 size={16} className="animate-spin" /> Memproses</> : <><UploadCloud size={16} /> Mulai Eksekusi</>}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* KOLOM KANAN: STUDIO BOARD & HISTORY */}
          <div className="flex flex-col gap-4">
            
            {/* Papan Tulis / Kanban */}
            <div className="flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-sm">
              <div className="border-b border-[var(--border-soft)] bg-[var(--elevated)] px-4 py-3 rounded-t-2xl">
                <h3 className="font-bold text-sm text-[var(--text)] flex items-center gap-2"><CheckSquare size={16} className="text-[var(--accent)]" /> Studio Board</h3>
              </div>
              
              <div className="p-4">
                <form onSubmit={addTask} className="flex gap-2 mb-4">
                  <input 
                    type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} 
                    placeholder="Tambah target game baru..."
                    className="flex-1 rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] text-[var(--text)]"
                  />
                  <button type="submit" disabled={!newTaskTitle.trim() || isUpdatingTask} className="rounded-xl bg-[var(--elevated)] px-3 text-[var(--text-2)] hover:bg-[var(--border-soft)] transition">
                    <Plus size={18} />
                  </button>
                </form>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {tasks.length === 0 ? (
                    <p className="text-center text-xs text-[var(--text-4)] py-4">Papan tulis bersih. Tidak ada antrean tugas.</p>
                  ) : (
                    tasks.map(task => (
                      <div key={task._id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-all ${
                        task.isUploaded && task.shopeeListed ? 'border-[var(--success)]/20 bg-[var(--success)]/5 opacity-60' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
                      }`}>
                        <span className={`text-sm font-semibold flex-1 truncate ${task.isUploaded && task.shopeeListed ? 'line-through text-[var(--text-3)]' : 'text-[var(--text)]'}`}>
                          {task.title}
                        </span>
                        
                        <div className="flex items-center gap-4 shrink-0">
                          <button onClick={() => toggleTaskStatus(task._id, 'shopeeListed', task.shopeeListed)} className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${task.shopeeListed ? 'text-[var(--accent)]' : 'text-[var(--text-4)] hover:text-[var(--text-2)]'}`}>
                            {task.shopeeListed ? <Store size={14} /> : <Store size={14} className="opacity-40" />} Shopee
                          </button>
                          
                          <button onClick={() => toggleTaskStatus(task._id, 'isUploaded', task.isUploaded)} className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${task.isUploaded ? 'text-blue-500' : 'text-[var(--text-4)] hover:text-[var(--text-2)]'}`}>
                            {task.isUploaded ? <Cloud size={14} /> : <Cloud size={14} className="opacity-40" />} GDrive
                          </button>

                          <div className="w-[1px] h-4 bg-[var(--border-strong)] mx-1" />
                          
                          <button onClick={() => deleteTask(task._id)} className="text-[var(--text-4)] hover:text-[var(--danger)] transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Riwayat Upload */}
            <div className="flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-sm">
              <div className="border-b border-[var(--border-soft)] bg-[var(--elevated)] px-4 py-3 rounded-t-2xl flex justify-between items-center">
                <h3 className="font-bold text-sm text-[var(--text)] flex items-center gap-2"><Clock size={16} className="text-blue-400" /> Riwayat Upload</h3>
                <span className="text-[10px] text-[var(--text-3)] font-medium">Dari Katalog</span>
              </div>
              
              <div className="p-2 h-[220px] overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-center text-xs text-[var(--text-4)] py-8">Belum ada riwayat upload.</p>
                ) : (
                  history.map(item => (
                    <div key={item._id} className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--elevated)] transition rounded-lg">
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="text-sm font-bold text-[var(--text)] truncate">{item.name}</p>
                        <p className="text-[10px] text-[var(--text-3)] font-mono truncate mt-0.5">{item.ownerEmail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-[var(--text-2)]">{item.lastSyncedAt ? fmtDate(item.lastSyncedAt) : '-'}</p>
                        <p className="text-[10px] text-[var(--text-4)] mt-0.5">{item.lastSyncedAt ? fmtTime(item.lastSyncedAt) : '-'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
