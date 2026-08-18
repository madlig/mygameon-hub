'use client'

import { useState, useEffect, Fragment } from 'react'
import { HardDrive, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronRight, Copy, Loader2 } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'

function WorkspaceRow({ ws, onCopy }) {
  const [expanded, setExpanded] = useState(false)
  const [storage, setStorage] = useState(null)
  const [loadingStorage, setLoadingStorage] = useState(false)

  useEffect(() => {
    if (expanded && !storage) {
      setLoadingStorage(true)
      fetch(`/api/drive/storage?email=${ws.email}`)
        .then(res => res.json())
        .then(data => {
          setStorage(data)
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingStorage(false))
    }
  }, [expanded, ws.email])

  return (
    <Fragment>
      <tr 
        className="transition-colors hover:bg-[var(--elevated)]/30 cursor-pointer flex flex-col md:table-row border-b md:border-b-0 border-[var(--border-soft)] mb-2 md:mb-0 bg-[var(--surface)] md:bg-transparent rounded-xl md:rounded-none overflow-hidden shadow-sm md:shadow-none"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-5 py-4 font-medium text-[var(--text)] flex items-center justify-between md:justify-start gap-2 block md:table-cell border-b md:border-b-0 border-[var(--border-soft)] bg-[var(--elevated)]/30 md:bg-transparent">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={16} className="text-[var(--text-3)]" /> : <ChevronRight size={16} className="text-[var(--text-3)]" />}
            {ws.email}
          </div>
          {/* Status Label (Mobile Only) */}
          <div className="md:hidden">
            {ws.status === 'limit' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                LIMIT
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/10 px-2.5 py-1 text-xs font-medium text-[#10b981]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                Aman
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-4 flex-col gap-1 items-start hidden md:table-cell">
          {ws.status === 'limit' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              LIMIT TERDETEKSI
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/10 px-2.5 py-1 text-xs font-medium text-[#10b981]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              Aman
            </span>
          )}
          {ws.hasSharedDriveAccess === false && (
            <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold text-yellow-500 border border-yellow-500/20 mt-1" title="Tidak memiliki akses ke Shared Drive KEBERSAMAAN">
              <AlertTriangle size={10} />
              No KEBERSAMAAN
            </span>
          )}
        </td>
        <td className="px-5 py-3 md:py-4 text-left md:text-center font-medium text-[var(--text-2)] flex justify-between md:table-cell">
          <span className="md:hidden text-xs text-[var(--text-3)]">Total Game:</span>
          {ws.totalFiles}
        </td>
        <td className="px-5 py-3 md:py-4 text-left md:text-center font-medium flex justify-between md:table-cell">
          <span className="md:hidden text-xs text-[var(--text-3)]">Game Ter-limit:</span>
          <span className={ws.limitedFiles > 0 ? 'text-red-500 font-bold' : 'text-[var(--text-3)]'}>
            {ws.limitedFiles > 0 ? ws.limitedFiles : '-'}
          </span>
        </td>
      </tr>
      
      {expanded && (
        <tr className="block md:table-row">
          <td colSpan="4" className="bg-[var(--surface)] p-0 block md:table-cell">
            <div className="border-t border-[var(--border-soft)] bg-[var(--elevated)]/20 px-4 md:px-8 py-4 shadow-inner">
              
              {/* Storage Info Section */}
              <div className="mb-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 flex items-center gap-4">
                <HardDrive size={24} className="text-[var(--text-3)] shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                    <span className="text-[var(--text-2)]">Kapasitas Storage</span>
                    {loadingStorage ? (
                      <span className="text-[var(--text-3)] flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Mengecek...</span>
                    ) : storage?.success ? (
                      <span className={storage.percentage > 90 ? 'text-red-500' : 'text-[#10b981]'}>{storage.percentage}% Terpakai</span>
                    ) : (
                      <span className="text-yellow-500">Tidak Terhubung</span>
                    )}
                  </div>
                  {storage?.success ? (
                    <div className="w-full h-2 bg-[var(--elevated)] rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${storage.percentage > 90 ? 'bg-red-500' : 'bg-[#10b981]'}`} 
                        style={{ width: `${storage.percentage}%` }}
                      ></div>
                    </div>
                  ) : !loadingStorage && storage?.notConnected ? (
                    <div className="text-xs text-[var(--text-3)]">{storage.message}</div>
                  ) : null}
                  {storage?.success && (
                    <div className="text-xs text-[var(--text-3)] mt-1">{storage.usageGB} GB / {storage.limitGB} GB</div>
                  )}
                </div>
              </div>

              {ws.allFiles && (
                <>
                  <h4 className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-3">Daftar Game:</h4>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {ws.allFiles.map(file => (
                      <li key={file.id} className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border-soft)] rounded-lg px-3 py-2">
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-medium text-[var(--text)] truncate">{file.name}</span>
                          <span className="text-xs text-[var(--text-3)] truncate">
                            {file.status === 'download_limit' ? 'Limit Kuota' : 'Aman'}
                          </span>
                        </div>
                        {file.status === 'download_limit' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopy(file, ws.email);
                            }}
                            className="flex items-center gap-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors"
                          >
                            <Copy size={14} />
                            Auto-Copy
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

export default function DriveStatusPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Copy Modal State
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [targetAccount, setTargetAccount] = useState('')
  const [copying, setCopying] = useState(false)
  const [copyStatus, setCopyStatus] = useState(null)

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/drive/status?t=' + Date.now())
      if (!res.ok) throw new Error('Gagal mengambil data status Drive')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts?.filter(a => a.status === 'active') || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchAccounts()
  }, [])

  const openCopyModal = (game, sourceEmail) => {
    setSelectedGame({ ...game, sourceEmail })
    setTargetAccount('')
    setCopyStatus(null)
    setCopyModalOpen(true)
  }

  const handleCopy = async () => {
    if (!targetAccount) return;
    
    setCopying(true)
    setCopyStatus(null)
    try {
      const res = await fetch('/api/drive/auto-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFileId: selectedGame.id,
          sourceFileName: selectedGame.name,
          targetEmail: targetAccount
        })
      })
      
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal copy file')
      
      setCopyStatus({ type: 'success', message: 'Berhasil dicopy! File baru ada di target workspace.' })
    } catch (err) {
      setCopyStatus({ type: 'error', message: err.message })
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Status Google Drive" />

      <div className="flex-1 overflow-y-auto px-[var(--pad-card)] pb-[var(--pad-card)] relative">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">Pantau Kuota Download</h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Status limitasi per email workspace secara real-time. Klik baris untuk melihat daftar game.
            </p>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[var(--primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Menyinkronkan...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* SUMMARY CARDS */}
        {data && (
          <div className="mb-8 grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
            {data.globalPooledStorage ? (
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 text-[var(--text-2)]">
                    <HardDrive size={18} className="text-blue-500" />
                    <span className="text-sm font-medium">Pooled Storage (Global)</span>
                  </div>
                  <span className={`text-xs font-bold ${data.globalPooledStorage.percentage > 90 ? 'text-red-500' : 'text-[var(--text-3)]'}`}>
                    {data.globalPooledStorage.percentage}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[var(--elevated)] rounded-full overflow-hidden mb-3">
                  <div 
                    className={`h-full rounded-full ${data.globalPooledStorage.percentage > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                    style={{ width: `${data.globalPooledStorage.percentage}%` }}
                  />
                </div>
                <div className="text-[11px] text-[var(--text-3)] font-medium">
                  {data.globalPooledStorage.usageGB} / {data.globalPooledStorage.limitGB} GB
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
                <div className="flex items-center gap-3 text-[var(--text-2)]">
                  <HardDrive size={18} />
                  <span className="text-sm font-medium">Storage Global</span>
                </div>
                <div className="mt-3 text-sm text-[var(--text-3)]">
                  Tidak terdeteksi Pooled Storage.
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 text-[var(--text-2)]">
                <HardDrive size={18} />
                <span className="text-sm font-medium">Total Workspace</span>
              </div>
              <div className="mt-3 text-3xl font-bold text-[var(--text)]">
                {data.workspaces?.length || 0}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 text-[var(--text-2)]">
                <CheckCircle2 size={18} className="text-[#10b981]" />
                <span className="text-sm font-medium">Workspace Aman</span>
              </div>
              <div className="mt-3 text-3xl font-bold text-[#10b981]">
                {(data.workspaces?.length || 0) - (data.limited?.length || 0)}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm relative overflow-hidden flex flex-col justify-center">
              <div className={`absolute inset-0 opacity-10 ${data.limited?.length > 0 ? 'bg-red-500 animate-pulse' : ''}`} />
              <div className="relative flex items-center gap-3 text-[var(--text-2)]">
                <AlertTriangle size={18} className={data.limited?.length > 0 ? 'text-red-500' : ''} />
                <span className="text-sm font-medium">Terkena Limit</span>
              </div>
              <div className={`relative mt-3 text-3xl font-bold ${data.limited?.length > 0 ? 'text-red-500' : 'text-[var(--text)]'}`}>
                {data.limited?.length || 0}
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACES TABLE */}
        <div className="md:overflow-hidden md:rounded-2xl md:border border-[var(--border-soft)] md:bg-[var(--surface)] md:shadow-sm">
          <div className="hidden md:block border-b border-[var(--border-soft)] bg-[var(--elevated)] px-5 py-4">
            <h3 className="font-semibold text-[var(--text)]">Detail per Email Workspace</h3>
          </div>
          <div className="w-full">
            <table className="w-full text-left text-sm block md:table">
              <thead className="hidden md:table-header-group bg-[var(--elevated)]/50 text-[var(--text-2)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Email Workspace</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-center">Total Game</th>
                  <th className="px-5 py-3 font-medium text-center">Game Ter-limit</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y-0 md:divide-y divide-[var(--border-soft)]">
                {loading && !data ? (
                  <tr className="block md:table-row">
                    <td colSpan="4" className="px-5 py-8 text-center text-[var(--text-3)] block md:table-cell">
                      Memuat data dari Google Drive...
                    </td>
                  </tr>
                ) : data?.workspaces?.length === 0 ? (
                  <tr className="block md:table-row">
                    <td colSpan="4" className="px-5 py-8 text-center text-[var(--text-3)] block md:table-cell">
                      Belum ada file di folder utama.
                    </td>
                  </tr>
                ) : (
                  data?.workspaces?.map((ws) => (
                    <WorkspaceRow key={ws.email} ws={ws} onCopy={openCopyModal} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* COPY MODAL */}
        {copyModalOpen && selectedGame && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-[var(--text)] mb-2">Auto-Copy Game</h3>
              <p className="text-sm text-[var(--text-2)] mb-4">
                Pilih workspace tujuan yang statusnya AMAN untuk membuat salinan baru dari game <strong>{selectedGame.name}</strong>.
              </p>
              
              <div className="mb-4">
                <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
                  Workspace Tujuan
                </label>
                <select
                  value={targetAccount}
                  onChange={(e) => setTargetAccount(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-4 py-2.5 text-sm font-medium text-[var(--text)] outline-none focus:border-[var(--primary)]"
                >
                  <option value="">-- Pilih Akun --</option>
                  {accounts.map(acc => (
                    <option key={acc.email} value={acc.email} disabled={acc.email === selectedGame.sourceEmail}>
                      {acc.email} {acc.email === selectedGame.sourceEmail ? '(Sedang limit)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {copyStatus && (
                <div className={`mb-4 rounded-xl border p-3 text-sm ${copyStatus.type === 'success' ? 'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]' : 'border-red-500/30 bg-red-500/10 text-red-500'}`}>
                  {copyStatus.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setCopyModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--elevated)]"
                  disabled={copying}
                >
                  Tutup
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!targetAccount || copying}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                  {copying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                  {copying ? 'Memproses...' : 'Copy Sekarang'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
