'use client'

import { useState, useEffect } from 'react'
import {
  Search, ShieldX, ShieldAlert, Check, X,
  ExternalLink, Clock, User, ShieldCheck, Gamepad2, AlertCircle, Save, DownloadCloud, Loader2, Plus, Trash2, Settings
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import BonusSettingsModal from '@/components/shared/BonusSettingsModal'
import { isValidEmail } from '@/lib/validators'
import { loadJSON, saveJSON } from '@/lib/searchStore'
import { AppButton } from '@/components/shared/design-system'

const REVOKE_EMAILS = 'mygameon_crm_emails'

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return '-' }
}

export default function CustomerCRMPage() {
  const [email, setEmail] = useState('')
  const [scannedEmail, setScannedEmail] = useState('')
  const [customer, setCustomer] = useState(null)
  const [accessList, setAccessList] = useState([])
  const [simsLicenses, setSimsLicenses] = useState([])
  
  const [isScanning, setIsScanning] = useState(false)
  const [isDeepScanning, setIsDeepScanning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [message, setMessage] = useState(null)
  const [hasScanned, setHasScanned] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [recentEmails, setRecentEmails] = useState([])

  const [allCustomers, setAllCustomers] = useState([])
  const [loadingAll, setLoadingAll] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all' or 'bonus'
  
  const [showBonusSettings, setShowBonusSettings] = useState(false)

  const [notes, setNotes] = useState('')

  const emailValid = isValidEmail(email)
  const emailTouched = email.length > 0

  useEffect(() => {
    setRecentEmails(loadJSON(REVOKE_EMAILS))
    fetch('/api/customers?all=true')
      .then(res => res.json())
      .then(data => {
        setAllCustomers(data.customers || [])
        setLoadingAll(false)
      })
      .catch(() => setLoadingAll(false))
  }, [])

  function rememberEmail(value) {
    const v = (value || '').trim().toLowerCase()
    if (!v) return
    setRecentEmails(prev => {
      const next = [v, ...prev.filter(x => x !== v)].slice(0, 6)
      saveJSON(REVOKE_EMAILS, next)
      return next
    })
  }

  async function handleSearch(targetEmail) {
    const em = (typeof targetEmail === 'string' ? targetEmail : email).trim()
    if (!isValidEmail(em)) return
    setIsScanning(true)
    setMessage(null)
    
    try {
      const res = await fetch(`/api/customers?email=${encodeURIComponent(em)}`)
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Gagal mengambil data' })
        return
      }
      setCustomer(data.customer)
      setAccessList(data.accessLogs || [])
      setSimsLicenses(data.sims4Licenses || [])
      setNotes(data.customer?.notes || '')
      setScannedEmail(em)
      setHasScanned(true)
      rememberEmail(em)
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal terhubung ke server.' })
    } finally {
      setIsScanning(false)
    }
  }

  async function handleDeepScan() {
    setIsDeepScanning(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/customers/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: scannedEmail })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: `Deep scan selesai. ${data.filesFound} akses ditemukan.` })
        handleSearch(scannedEmail) // Reload data
      } else {
        setMessage({ type: 'error', text: data.error || 'Gagal deep scan' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem.' })
    } finally {
      setIsDeepScanning(false)
    }
  }

  async function updateCustomerStatus(newStatus) {
    setIsUpdating(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: scannedEmail, status: newStatus })
      })
      if (res.ok) {
        const data = await res.json()
        setCustomer(data.customer)
        setMessage({ type: 'success', text: newStatus === 'blacklisted' ? 'Pelanggan diblokir.' : 'Pelanggan diaktifkan.' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal update status.' })
    } finally {
      setIsUpdating(false)
      setConfirm(null)
    }
  }

  async function saveNotes() {
    setIsUpdating(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: scannedEmail, notes })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Catatan berhasil disimpan.' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal menyimpan catatan.' })
    } finally {
      setIsUpdating(false)
    }
  }

  async function revokeAccess(item) {
    setConfirm({
      title: 'Cabut akses ini?',
      description: `Akses "${item.gameName}" akan dicabut dari Google Drive.`,
      confirmLabel: 'Cabut Akses',
      loading: false,
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, loading: true }))
        try {
          const res = await fetch('/api/customers', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [item] })
          })
          if (res.ok) {
            const data = await res.json()
            const errors = data.results?.filter(r => r.status === 'error')
            if (errors && errors.length > 0) {
              setMessage({ type: 'error', text: `Gagal: ${errors[0].message}` })
            } else {
              setMessage({ type: 'success', text: 'Akses berhasil dicabut.' })
              handleSearch(scannedEmail)
            }
          } else {
            const data = await res.json()
            setMessage({ type: 'error', text: data.error || 'Gagal mencabut akses.' })
          }
        } catch (e) {
          setMessage({ type: 'error', text: 'Terjadi kesalahan sistem.' })
        } finally {
          setConfirm(null)
        }
      }
    })
  }

  const activeAccess = accessList.filter(a => a.status === 'active')
  const inactiveAccess = accessList.filter(a => a.status !== 'active')

  return (
    <div className="fadeUp">
      <TopBar title="Pusat Data Pelanggan" />

      {/* Search form */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            list="revoke-emails" autoComplete="off"
            placeholder="Cari profil pelanggan berdasarkan email..."
            className={`w-full rounded-2xl border bg-[var(--surface)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors ${
              emailTouched && !emailValid ? 'border-[var(--danger)]' : 'border-[var(--border-soft)] focus:border-[var(--primary)]'
            }`}
          />
        </div>
        <datalist id="revoke-emails">{recentEmails.map(e => <option key={e} value={e} />)}</datalist>
        <button
          onClick={() => handleSearch()}
          disabled={!emailValid || isScanning}
          className="pressable rounded-2xl bg-[var(--primary)] px-6 py-3 text-sm font-bold text-[var(--primary-fg)] transition-all hover:brightness-105 disabled:opacity-50"
        >
          {isScanning ? 'Mencari...' : 'Cari'}
        </button>
      </div>

      {recentEmails.length > 0 && !hasScanned && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {recentEmails.map(e => (
            <button
              key={e}
              onClick={() => { setEmail(e); handleSearch(e) }}
              className="max-w-[200px] truncate rounded-full border border-[var(--border-soft)] px-3 py-1 text-[11px] font-medium text-[var(--text-3)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-2)]"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {message && (
        <div className={`mb-6 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
          message.type === 'success'
            ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[#4ade80]'
            : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[#fca5a5]'
        }`}>
          {message.type === 'success' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          {message.text}
        </div>
      )}

      {hasScanned && !isScanning && (
        <div className="space-y-6 pb-24">
          
          {/* PROFILE CARD */}
          <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
            <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] bg-[var(--elevated)]/50 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  customer?.status === 'blacklisted' ? 'bg-[var(--danger)]/15 text-[var(--danger)]' : 'bg-[var(--primary)]/15 text-[var(--primary)]'
                }`}>
                  <User size={28} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text)]">{scannedEmail}</h2>
                  <div className="mt-1 flex items-center gap-2 text-xs font-medium text-[var(--text-3)]">
                    <span>Bergabung {customer?.createdAt ? fmtDate(customer.createdAt) : 'Baru'}</span>
                    <span>•</span>
                    <span>{customer?.orderCount || accessList.length} Order</span>
                    {customer?.bonusPending > 0 && (
                        <>
                        <span>•</span>
                        <span className="text-[var(--primary)] font-bold">{customer.bonusPending} Hak Bonus Tersisa</span>
                        </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {customer?.status === 'blacklisted' ? (
                  <button onClick={() => updateCustomerStatus('active')} disabled={isUpdating} className="pressable flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--text)] transition hover:border-[var(--success)] hover:text-[var(--success)]">
                    <ShieldCheck size={16} /> Pulihkan
                  </button>
                ) : (
                  <button onClick={() => setConfirm({
                    title: 'Blacklist Pelanggan ini?',
                    description: 'Email ini akan diblokir dari semua pembelian baru di masa depan.',
                    confirmLabel: 'Ya, Blacklist',
                    loading: false,
                    onConfirm: async () => {
                      setConfirm(prev => ({ ...prev, loading: true }))
                      await updateCustomerStatus('blacklisted')
                      setConfirm(null)
                    }
                  })} disabled={isUpdating} className="pressable flex items-center gap-2 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2 text-sm font-bold text-[var(--danger)] transition hover:bg-[var(--danger)]/20">
                    <ShieldAlert size={16} /> Blacklist
                  </button>
                )}
              </div>
            </div>

            <div className="p-5">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">Catatan Internal</label>
              <div className="flex gap-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Tambahkan catatan khusus untuk pelanggan ini..."
                  className="h-20 flex-1 resize-none rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
                />
                <button onClick={saveNotes} disabled={isUpdating || notes === (customer?.notes || '')} className="pressable flex shrink-0 items-center justify-center rounded-xl bg-[var(--elevated)] px-4 text-[var(--text-2)] transition hover:bg-[var(--border-soft)] disabled:opacity-50">
                  <Save size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* SIMS 4 INTEGRATION */}
          {simsLicenses.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text)]">
                <Gamepad2 size={16} className="text-[var(--accent)]" /> The Sims 4 Licenses
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {simsLicenses.map(sims => (
                  <div key={sims._id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-[var(--text)]">{sims.invoice}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sims.hwid ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--warning)]/10 text-[var(--warning)]'}`}>
                        {sims.hwid ? 'HWID Terkunci' : 'HWID Kosong'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-2)]">
                      <span className="rounded bg-[var(--elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-3)]">
                        {sims.cc === 'Y' ? 'Premium CC' : 'Standard'}
                      </span>
                      <span>Dibuat: {fmtDate(sims.createdAt) || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVE ACCESS */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text)]">
                <DownloadCloud size={16} className="text-[var(--primary)]" /> Akses Game Aktif ({activeAccess.length})
              </h3>
              <button onClick={handleDeepScan} disabled={isDeepScanning} className="text-[11px] font-medium text-[var(--primary)] transition hover:underline">
                {isDeepScanning ? 'Scanning Google Drive...' : 'Sinkronkan dengan Google Drive'}
              </button>
            </div>
            
            {activeAccess.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] py-8 text-center text-sm text-[var(--text-3)]">
                Tidak ada akses aktif saat ini.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeAccess.map(item => (
                  <div key={item._id} className="flex flex-col justify-between rounded-xl border border-[var(--primary)]/30 bg-[var(--surface)] p-4 shadow-[0_4px_20px_-10px_rgba(255,209,0,0.1)]">
                    <div>
                      <p className="line-clamp-2 text-sm font-bold leading-tight text-[var(--text)]">{item.gameName}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-3)]">
                        <Clock size={11} /> {item.expiresAt ? `Berakhir: ${fmtDate(item.expiresAt)}` : 'Permanen'}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3">
                      <a href={`https://drive.google.com/drive/folders/${item.folderId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--primary)]">
                        <ExternalLink size={12} /> Buka Drive
                      </a>
                      <button onClick={() => revokeAccess(item)} className="rounded-lg bg-[var(--danger)]/10 px-3 py-1 text-[11px] font-bold text-[var(--danger)] transition hover:bg-[var(--danger)] hover:text-white">
                        Cabut Akses
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* INACTIVE ACCESS */}
          {inactiveAccess.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-3)]">
                <ShieldX size={16} /> Riwayat Akses Dicabut / Kadaluarsa ({inactiveAccess.length})
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {inactiveAccess.map(item => (
                  <div key={item._id} className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0">
                    <ShieldX size={16} className="shrink-0 text-[var(--danger)]" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--text)]">{item.gameName}</p>
                      <p className="text-[10px] text-[var(--text-3)]">Status: {item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* OVERVIEW TABS (When not searched) */}
      {!hasScanned && !isScanning && (
        <div className="pb-24">
           <div className="flex gap-6 mb-6 border-b border-[var(--border-soft)] items-center justify-between">
              <div className="flex gap-6">
                <button onClick={() => setActiveTab('all')} className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'all' ? 'text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
                    Semua Pelanggan ({allCustomers.length})
                    {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] shadow-[0_0_10px_rgba(255,209,0,0.5)]" />}
                </button>
                <button onClick={() => setActiveTab('bonus')} className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'bonus' ? 'text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
                    Klaim Bonus
                    {allCustomers.filter(c => c.bonusPending > 0).length > 0 && (
                        <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-black text-[var(--primary-fg)] shadow-[0_0_8px_rgba(255,209,0,0.4)]">
                            {allCustomers.filter(c => c.bonusPending > 0).length}
                        </span>
                    )}
                    {activeTab === 'bonus' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] shadow-[0_0_10px_rgba(255,209,0,0.5)]" />}
                </button>
              </div>
              {activeTab === 'bonus' && (
                <button onClick={() => setShowBonusSettings(true)} className="mb-3 flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-2)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">
                  <Settings size={14} /> Pengaturan Skema Bonus
                </button>
              )}
           </div>
           
           {loadingAll ? (
              <div className="py-20 text-center"><Loader2 className="mx-auto animate-spin text-[var(--primary)]" size={32} /></div>
           ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                 {allCustomers.filter(c => activeTab === 'all' || c.bonusPending > 0).sort((a,b) => b.orderCount - a.orderCount).map(c => (
                    <button key={c.email} onClick={() => { setEmail(c.email); handleSearch(c.email) }} className="text-left flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--primary)] hover:shadow-[0_10px_30px_-15px_rgba(255,209,0,0.2)]">
                        <div className="flex items-center gap-3">
                           <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.status === 'blacklisted' ? 'bg-red-500/10 text-red-500' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
                               <User size={20} />
                           </div>
                           <div className="min-w-0">
                               <p className="truncate font-bold text-[var(--text)] text-sm">{c.email}</p>
                               <p className="text-[11px] font-medium text-[var(--text-3)]">{c.orderCount || 0} Total Order</p>
                           </div>
                        </div>
                        {c.bonusPending > 0 && (
                            <div className="mt-1 flex items-center justify-between rounded-xl bg-[var(--primary)]/10 px-3 py-2 border border-[var(--primary)]/20">
                                <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider">Hak Bonus:</span>
                                <span className="text-[13px] font-black text-[var(--primary)]">{c.bonusPending} Game</span>
                            </div>
                        )}
                    </button>
                 ))}
                 {allCustomers.filter(c => activeTab === 'all' || c.bonusPending > 0).length === 0 && (
                     <div className="col-span-full py-16 text-center">
                         <span className="text-4xl block mb-3">📭</span>
                         <span className="text-sm font-semibold text-[var(--text-2)]">{activeTab === 'bonus' ? 'Tidak ada pelanggan yang berhak mendapat bonus saat ini.' : 'Belum ada data pelanggan.'}</span>
                     </div>
                 )}
              </div>
           )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        tone="danger"
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        loading={confirm?.loading}
        onConfirm={confirm?.onConfirm}
        onClose={() => setConfirm(null)}
      />

      {showBonusSettings && <BonusSettingsModal onClose={() => setShowBonusSettings(false)} />}
    </div>
  )
}
