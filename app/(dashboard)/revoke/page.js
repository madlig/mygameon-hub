'use client'

import { useState, useEffect } from 'react'
import {
  ShieldX, ShieldOff, AlertCircle, Check, X, Square, CheckSquare,
  ExternalLink, Clock,
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { isValidEmail } from '@/lib/validators'
import { loadJSON, saveJSON } from '@/lib/searchStore'

const REVOKE_EMAILS = 'mygameon_revoke_emails'

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return '-' }
}

function ago(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff)) return '-'
  if (diff < 0) return `dalam ${Math.ceil(-diff / 86400000)} hari`
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${Math.max(1, mins)} menit lalu`
  if (hours < 24) return `${hours} jam lalu`
  if (days < 60) return `${days} hari lalu`
  return fmtDate(iso)
}

function accessBadge(item) {
  if (item.sheetStatus === 'revoked') return { label: 'Sudah dicabut', cls: 'bg-white/[.06] text-[var(--text-3)]' }
  if (item.expiresAt) {
    const exp = new Date(item.expiresAt).getTime()
    if (!isNaN(exp) && exp < Date.now()) return { label: `Kadaluarsa ${ago(item.expiresAt)}`, cls: 'bg-[var(--danger)]/12 text-[#fca5a5]' }
    return { label: `Aktif s/d ${fmtDate(item.expiresAt)}`, cls: 'bg-[#f59e0b]/15 text-[#fbbf24]' }
  }
  return { label: 'Akses permanen', cls: 'bg-[var(--accent)]/15 text-[var(--accent-hi)]' }
}

export default function RevokePage() {
  const [email, setEmail]         = useState('')
  const [scannedEmail, setScannedEmail] = useState('')
  const [accessList, setAccessList] = useState([])
  const [selected, setSelected]   = useState(() => new Set())
  const [isScanning, setIsScanning] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [message, setMessage]     = useState(null)
  const [report, setReport]       = useState(null)
  const [hasScanned, setHasScanned] = useState(false)
  const [confirm, setConfirm]     = useState(null)
  const [recentEmails, setRecentEmails] = useState([])

  const emailValid = isValidEmail(email)
  const emailTouched = email.length > 0

  useEffect(() => { setRecentEmails(loadJSON(REVOKE_EMAILS)) }, [])

  function rememberEmail(value) {
    const v = (value || '').trim().toLowerCase()
    if (!v) return
    setRecentEmails(prev => {
      const next = [v, ...prev.filter(x => x !== v)].slice(0, 6)
      saveJSON(REVOKE_EMAILS, next)
      return next
    })
  }

  async function handleScan(targetEmail) {
    const em = (typeof targetEmail === 'string' ? targetEmail : email).trim()
    if (!isValidEmail(em)) return
    setIsScanning(true)
    setMessage(null)
    setReport(null)
    setAccessList([])
    setSelected(new Set())

    try {
      const res = await fetch(`/api/revoke?email=${encodeURIComponent(em)}`)
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Gagal scan (${res.status})` })
        return
      }
      setAccessList(data.accessList || [])
      setScannedEmail(em)
      setHasScanned(true)
      rememberEmail(em)
      if ((data.accessList || []).length === 0) {
        setMessage({ type: 'success', text: `Tidak ada akses aktif untuk ${em}.` })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal terhubung ke server. Coba lagi.' })
    } finally {
      setIsScanning(false)
    }
  }

  async function performRevoke(items) {
    setIsRevoking(true)
    setMessage(null)
    setReport(null)
    try {
      const res = await fetch('/api/revoke', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: scannedEmail,
          items: items.map(i => ({ fileId: i.fileId, permissionId: i.permissionId, fileName: i.fileName })),
        }),
      })
      const data = await res.json()
      const results = data.results || []
      const okIds = new Set(results.filter(r => r.status === 'success').map(r => r.fileId))
      setAccessList(prev => prev.filter(a => !okIds.has(a.fileId)))
      setSelected(prev => {
        const n = new Set(prev)
        okIds.forEach(id => n.delete(id))
        return n
      })
      const failCount = results.filter(r => r.status !== 'success').length
      if (items.length > 1 || failCount > 0) setReport(results)
      setMessage({
        type: failCount ? 'error' : 'success',
        text: `${okIds.size} akses dicabut${failCount ? `, ${failCount} gagal` : ''}.`,
      })
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal mencabut akses.' })
    } finally {
      setIsRevoking(false)
      setConfirm(null)
    }
  }

  function toggleSelect(fileId) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(fileId) ? n.delete(fileId) : n.add(fileId)
      return n
    })
  }
  const allSelected = accessList.length > 0 && accessList.every(a => selected.has(a.fileId))
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(accessList.map(a => a.fileId)))
  }

  const selectedItems = accessList.filter(a => selected.has(a.fileId))

  function askRevokeSingle(item) {
    setConfirm({
      title: 'Cabut akses ini?',
      description: `Akses "${item.fileName}" untuk ${scannedEmail} akan dicabut. Customer kehilangan akses download. Aksi ini tidak bisa dibatalkan.`,
      confirmLabel: 'Ya, cabut',
      onConfirm: () => performRevoke([item]),
    })
  }
  function askRevokeSelected() {
    if (selectedItems.length === 0) return
    setConfirm({
      title: `Cabut ${selectedItems.length} akses terpilih?`,
      description: `${selectedItems.length} akses milik ${scannedEmail} akan dicabut. Aksi ini tidak bisa dibatalkan.`,
      confirmLabel: `Ya, cabut ${selectedItems.length}`,
      onConfirm: () => performRevoke(selectedItems),
    })
  }
  function askRevokeAll() {
    setConfirm({
      title: `Cabut semua ${accessList.length} akses?`,
      description: `Seluruh akses milik ${scannedEmail} (${accessList.length} item) akan dicabut sekaligus. Aksi ini tidak bisa dibatalkan.`,
      confirmLabel: `Ya, cabut ${accessList.length}`,
      onConfirm: () => performRevoke(accessList),
    })
  }

  return (
    <div className="fadeUp">
      <TopBar title="Revoke akses" />

      {/* Scan form */}
      <div className="mb-2 flex gap-2">
        <input
          type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleScan()}
          list="revoke-emails" autoComplete="off"
          placeholder="Email customer..."
          className={`flex-1 rounded-2xl border bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors ${
            emailTouched && !emailValid ? 'border-[var(--danger)]' : 'border-[var(--border-soft)] focus:border-[var(--primary)]'
          }`}
        />
        <datalist id="revoke-emails">{recentEmails.map(e => <option key={e} value={e} />)}</datalist>
        <button
          onClick={() => handleScan()}
          disabled={!emailValid || isScanning}
          className="pressable rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-fg)] transition-all hover:brightness-105 disabled:opacity-50"
        >
          {isScanning ? '…' : 'Scan'}
        </button>
      </div>
      {emailTouched && !emailValid && (
        <p className="mb-2 flex items-center gap-1 text-[11px] text-[var(--danger)]"><AlertCircle size={12} /> Format email belum valid</p>
      )}

      {/* Riwayat email */}
      {recentEmails.length > 0 && !hasScanned && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {recentEmails.map(e => (
            <button
              key={e}
              onClick={() => { setEmail(e); handleScan(e) }}
              className="max-w-[200px] truncate rounded-full border border-[var(--border-soft)] px-2.5 py-0.5 text-[10.5px] font-medium text-[var(--text-3)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-2)]"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`mb-4 flex items-start gap-1.5 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[#4ade80]'
            : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[#fca5a5]'
        }`}>
          {message.type === 'success' ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Report per item */}
      {report && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">Hasil revoke</span>
            <button onClick={() => setReport(null)} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={15} /></button>
          </div>
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto p-2">
            {report.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                {r.status === 'success'
                  ? <Check size={13} className="shrink-0 text-[var(--success)]" />
                  : <X size={13} className="shrink-0 text-[var(--danger)]" />}
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-2)]">{r.fileName || r.fileId}</span>
                {r.message && <span className="shrink-0 text-[10px] text-[#fca5a5]">{r.message}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {accessList.length > 0 && (
        <>
          {/* Summary header */}
          <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3.5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--text)]">{scannedEmail}</p>
              <p className="text-[11px] text-[var(--text-3)]">{accessList.length} akses aktif{selected.size > 0 ? ` · ${selected.size} dipilih` : ''}</p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]">
                {allSelected ? <CheckSquare size={13} /> : <Square size={13} />} {allSelected ? 'Batal pilih' : 'Pilih semua'}
              </button>
              {selected.size > 0 && (
                <button onClick={askRevokeSelected} disabled={isRevoking} className="pressable flex items-center gap-1.5 rounded-lg border border-[var(--danger)] px-3 py-1.5 text-[11px] font-bold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 disabled:opacity-50">
                  <ShieldOff size={13} /> Cabut dipilih ({selected.size})
                </button>
              )}
              <button onClick={askRevokeAll} disabled={isRevoking} className="pressable flex items-center gap-1.5 rounded-lg bg-[var(--danger)] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
                <ShieldOff size={13} /> Cabut semua
              </button>
            </div>
          </div>

          {/* Grid kartu */}
          <div className="stagger mb-24 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 md:mb-4">
            {accessList.map(item => {
              const isSel = selected.has(item.fileId)
              const badge = accessBadge(item)
              return (
                <div key={item.fileId} className={`flex flex-col rounded-2xl border bg-[var(--surface)] p-3.5 transition-colors ${isSel ? 'border-[var(--primary)] bg-[var(--primary)]/[0.04]' : 'border-[var(--border-soft)]'}`}>
                  <div className="flex items-start gap-2.5">
                    <button onClick={() => toggleSelect(item.fileId)} className="mt-0.5 shrink-0 text-[var(--text-3)] transition-colors hover:text-[var(--primary)]" title="Pilih">
                      {isSel ? <CheckSquare size={18} className="text-[var(--primary)]" /> : <Square size={18} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">{item.fileName}</p>
                      {item.grantedAt && <p className="mt-0.5 text-[10.5px] text-[var(--text-3)]">Diberi {ago(item.grantedAt)}</p>}
                      <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                        <Clock size={10} /> {badge.label}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-soft)] pt-2.5">
                    <a
                      href={`https://drive.google.com/drive/folders/${item.fileId}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[10.5px] font-medium text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                    >
                      <ExternalLink size={12} /> Drive
                    </a>
                    <button
                      onClick={() => askRevokeSingle(item)}
                      disabled={isRevoking}
                      className="pressable ml-auto rounded-lg border border-[var(--danger)] px-3 py-1 text-[11px] font-bold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Empty / loading */}
      {!hasScanned && !isScanning && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <ShieldX size={30} className="text-[var(--text-3)]" />
          <p className="text-sm font-semibold text-[var(--text-2)]">Cabut akses customer</p>
          <p className="text-xs text-[var(--text-3)]">Masukkan email untuk scan semua aksesnya</p>
        </div>
      )}
      {isScanning && <p className="py-8 text-center text-sm text-[var(--text-3)]">Memindai akses…</p>}

      {/* Mobile action bar */}
      {accessList.length > 0 && (
        <div className="fixed bottom-[4.75rem] left-4 right-4 z-40 md:hidden">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--danger)] bg-[var(--danger)]/10 px-4 py-3 backdrop-blur-xl">
            <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-2)]">
              {allSelected ? <CheckSquare size={15} className="text-[var(--primary)]" /> : <Square size={15} />}
              {selected.size > 0 ? `${selected.size} dipilih` : `${accessList.length} akses`}
            </button>
            <button
              onClick={selected.size > 0 ? askRevokeSelected : askRevokeAll}
              disabled={isRevoking}
              className="pressable flex items-center gap-1.5 rounded-lg bg-[var(--danger)] px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <ShieldOff size={15} /> {isRevoking ? '…' : selected.size > 0 ? `Cabut ${selected.size}` : 'Cabut semua'}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        tone="danger"
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        loading={isRevoking}
        onConfirm={confirm?.onConfirm}
        onClose={() => !isRevoking && setConfirm(null)}
      />
    </div>
  )
}
