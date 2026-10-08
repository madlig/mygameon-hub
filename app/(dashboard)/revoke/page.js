'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, ShieldX, ShieldAlert, Check, X,
  ExternalLink, Clock, User, ShieldCheck, Gamepad2, AlertCircle, Save, DownloadCloud, Loader2, Plus, Trash2, Settings,
  Copy, CheckCheck, KeyRound, Send, Sparkles, ShoppingBag, ArrowUpDown, Flame, Filter
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import BonusSettingsModal from '@/components/shared/BonusSettingsModal'
import Sims4LicensesTab from '@/components/shared/Sims4LicensesTab'
import { buildSims4DeliveryMessage } from '@/lib/sims4'
import { isValidEmail } from '@/lib/validators'
import { SK, loadJSON, saveJSON } from '@/lib/searchStore'
import { AppButton } from '@/components/shared/design-system'

const REVOKE_EMAILS = 'mygameon_crm_emails'

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return '-' }
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function isToday(isoOrDate) {
  if (!isoOrDate) return false
  try {
    const d = new Date(isoOrDate)
    const now = new Date()
    return d.getDate() === now.getDate() &&
           d.getMonth() === now.getMonth() &&
           d.getFullYear() === now.getFullYear()
  } catch {
    return false
  }
}

function fmtActivity(iso) {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    const now = new Date()
    const isTdy = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (isTdy) {
      return `Hari ini, ${fmtTime(iso)}`
    }
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    const isYest = d.getDate() === yest.getDate() && d.getMonth() === yest.getMonth() && d.getFullYear() === yest.getFullYear()
    if (isYest) {
      return `Kemarin, ${fmtTime(iso)}`
    }
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

export default function CustomerCRMPage() {
  const [email, setEmail] = useState('')
  const [scannedEmail, setScannedEmail] = useState('')
  const [customer, setCustomer] = useState(null)
  const [accessList, setAccessList] = useState([])
  const [simsLicenses, setSimsLicenses] = useState([])
  const [orderHistory, setOrderHistory] = useState([])
  
  const [isScanning, setIsScanning] = useState(false)
  const [isDeepScanning, setIsDeepScanning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [message, setMessage] = useState(null)
  const [hasScanned, setHasScanned] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [recentEmails, setRecentEmails] = useState([])

  const [allCustomers, setAllCustomers] = useState([])
  const [loadingAll, setLoadingAll] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'today', 'licenses', 'bonus'
  const [sortBy, setSortBy] = useState('recent') // 'recent', 'orders'
  const [listQuery, setListQuery] = useState('')
  const [displayLimit, setDisplayLimit] = useState(36)
  
  const [showBonusSettings, setShowBonusSettings] = useState(false)
  const [resend, setResend] = useState(null)
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  const [copiedInvoice, setCopiedInvoice] = useState(null)
  const [mounted, setMounted] = useState(false)

  const [notes, setNotes] = useState('')

  const emailValid = isValidEmail(email)
  const emailTouched = email.length > 0

  useEffect(() => {
    setMounted(true)
    const kasirEmails = loadJSON(SK.emails, [])
    const crmEmails = loadJSON(REVOKE_EMAILS, [])
    const merged = [...new Set([...kasirEmails, ...crmEmails])].filter(e => e && typeof e === 'string' && e.includes('@')).slice(0, 8)
    setRecentEmails(merged)

    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab')
      if (tab === 'licenses') setActiveTab('licenses')
      else if (tab === 'bonus') setActiveTab('bonus')
      else if (tab === 'today') setActiveTab('today')
    }

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
    if (!v || !v.includes('@')) return
    setRecentEmails(prev => {
      const next = [v, ...prev.filter(x => x !== v)].slice(0, 8)
      saveJSON(REVOKE_EMAILS, next)
      saveJSON(SK.emails, next)
      return next
    })
  }

  async function handleSearch(targetEmail) {
    const em = (typeof targetEmail === 'string' ? targetEmail : email).trim()
    if (!em) return
    setIsScanning(true)
    setMessage(null)
    
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(em)}`)
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Gagal mengambil data' })
        return
      }
      setCustomer(data.customer)
      setAccessList(data.accessLogs || [])
      setSimsLicenses(data.sims4Licenses || [])
      setOrderHistory(data.orders || [])
      setNotes(data.customer?.notes || '')
      setScannedEmail(data.customer?.email || em)
      setHasScanned(true)
      if (data.customer?.email && data.customer.email.includes('@')) {
        rememberEmail(data.customer.email)
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal terhubung ke server.' })
    } finally {
      setIsScanning(false)
    }
  }

  function copyInvoice(inv) {
    if (!inv) return
    try {
      navigator.clipboard.writeText(inv)
      setCopiedInvoice(inv)
      setTimeout(() => setCopiedInvoice(null), 1500)
    } catch (e) {}
  }

  async function runLicenseAction(invoice, action) {
    setIsUpdating(true)
    setMessage(null)
    try {
      const res = await fetch('/api/sims4/licenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice, action }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Lisensi ${invoice}: aksi ${action} berhasil disimpan.` })
        handleSearch(scannedEmail)
      } else {
        setMessage({ type: 'error', text: data.error || 'Terjadi kesalahan sistem.' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal terhubung ke server.' })
    } finally {
      setIsUpdating(false)
      setConfirm(null)
    }
  }

  function handleLicenseAction(lic, action) {
    if (action === 'ban') {
      setConfirm({
        title: 'Ban lisensi ini?',
        description: `Lisensi ${lic.invoice} (${lic.email || 'tanpa email'}) akan di-ban dan tidak bisa dipakai. Anda bisa unban lagi nanti.`,
        confirmLabel: 'Ya, Ban Lisensi',
        onConfirm: () => runLicenseAction(lic.invoice, 'ban'),
      })
    } else if (action === 'resetHwid') {
      setConfirm({
        title: 'Reset HWID lisensi ini?',
        description: `HWID untuk lisensi ${lic.invoice} akan dikosongkan. Customer dapat mengikat ulang perangkat saat login berikutnya.`,
        confirmLabel: 'Ya, Reset HWID',
        onConfirm: () => runLicenseAction(lic.invoice, 'resetHwid'),
      })
    } else {
      runLicenseAction(lic.invoice, action)
    }
  }

  function copyKey(invoice) {
    try {
      navigator.clipboard.writeText(invoice)
      setCopiedKey(invoice)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch (e) {}
  }

  function openResend(lic) {
    setCopiedMsg(false)
    setResend({ invoice: lic.invoice, message: buildSims4DeliveryMessage(lic.invoice, lic.cc === 'Y') })
  }

  function copyResend() {
    if (!resend) return
    try {
      navigator.clipboard.writeText(resend.message)
      setCopiedMsg(true)
      setTimeout(() => setCopiedMsg(false), 1800)
    } catch (e) {}
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
      <TopBar title="CRM &amp; Layanan Lisensi" />

      {/* Search form */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="text" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            list="revoke-emails" autoComplete="off"
            placeholder="Cari pelanggan via email atau no. pesanan Shopee (invoice)..."
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
          />
        </div>
        <datalist id="revoke-emails">{recentEmails.map(e => <option key={e} value={e} />)}</datalist>
        <button
          onClick={() => handleSearch()}
          disabled={!email.trim() || isScanning}
          className="pressable rounded-2xl bg-[var(--primary)] px-6 py-3 text-sm font-bold text-[var(--primary-fg)] transition-all hover:brightness-105 disabled:opacity-50"
        >
          {isScanning ? 'Mencari...' : 'Cari'}
        </button>
        {hasScanned && (
          <button
            onClick={() => { setHasScanned(false); setEmail(''); }}
            className="pressable rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--text-2)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          >
            Kembali
          </button>
        )}
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
                <Gamepad2 size={16} className="text-purple-400" /> Lisensi The Sims 4 ({simsLicenses.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {simsLicenses.map(sims => {
                  const isLocked = !!(sims.hwid || (Array.isArray(sims.hwids) && sims.hwids.length > 0))
                  return (
                    <div key={sims._id || sims.invoice} className="flex flex-col justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => copyKey(sims.invoice)}
                            className="group flex items-center gap-1.5 font-bold text-sm text-[var(--primary)] hover:underline"
                            title="Salin License Key"
                          >
                            <span>{sims.invoice}</span>
                            {copiedKey === sims.invoice ? (
                              <CheckCheck size={13} className="text-[var(--success)]" />
                            ) : (
                              <Copy size={13} className="text-[var(--text-3)] group-hover:text-[var(--text)]" />
                            )}
                          </button>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            sims.status === 'Active' ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                          }`}>
                            {sims.status || 'Active'}
                          </span>
                        </div>

                        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-2)]">
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            sims.cc === 'Y' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' : 'bg-[var(--elevated)] text-[var(--text-3)]'
                          }`}>
                            {sims.cc === 'Y' ? '💎 Premium CC' : '🎮 Standard'}
                          </span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            isLocked ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20' : 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/20'
                          }`}>
                            {isLocked ? '🔒 HWID Terkunci' : '🔓 HWID Kosong'}
                          </span>
                          <span className="text-[10px] text-[var(--text-3)]">
                            Dibuat: {fmtDate(sims.createdAt) || '-'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-soft)] pt-3">
                        <button
                          type="button"
                          onClick={() => handleLicenseAction(sims, 'resetHwid')}
                          disabled={isUpdating}
                          className="pressable rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
                        >
                          Reset HWID
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLicenseAction(sims, 'toggleCC')}
                          disabled={isUpdating}
                          className="pressable rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] transition hover:border-purple-400 hover:text-purple-300 disabled:opacity-50"
                        >
                          {sims.cc === 'Y' ? 'Jadikan Std' : 'Jadikan CC'}
                        </button>
                        {sims.status === 'Active' ? (
                          <button
                            type="button"
                            onClick={() => handleLicenseAction(sims, 'ban')}
                            disabled={isUpdating}
                            className="pressable rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--danger)] transition hover:bg-[var(--danger)]/20 disabled:opacity-50"
                          >
                            Ban
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleLicenseAction(sims, 'unban')}
                            disabled={isUpdating}
                            className="pressable rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--success)] transition hover:bg-[var(--success)]/20 disabled:opacity-50"
                          >
                            Unban
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openResend(sims)}
                          className="pressable ml-auto flex items-center gap-1 rounded-xl bg-[var(--primary)]/15 px-2.5 py-1 text-[11px] font-bold text-[var(--primary)] transition hover:bg-[var(--primary)]/25"
                        >
                          <Send size={11} /> Kirim Ulang
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* RIWAYAT PESANAN SHOPEE */}
          {orderHistory.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text)]">
                <ShoppingBag size={16} className="text-amber-400" /> Riwayat Pesanan Shopee ({orderHistory.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {orderHistory.map(ord => (
                  <div key={ord._id || ord.invoice} className="flex flex-col justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        {ord.invoice ? (
                          <button
                            type="button"
                            onClick={() => copyInvoice(ord.invoice)}
                            className="group flex items-center gap-1.5 font-mono text-xs font-bold text-[var(--primary)] hover:underline"
                            title="Salin No. Pesanan Shopee"
                          >
                            <span>{ord.invoice}</span>
                            {copiedInvoice === ord.invoice ? (
                              <CheckCheck size={13} className="text-[var(--success)]" />
                            ) : (
                              <Copy size={13} className="text-[var(--text-3)] group-hover:text-[var(--text)]" />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-[var(--text-3)] italic">Tanpa Invoice</span>
                        )}
                        <span className="text-[10px] font-medium text-[var(--text-3)]">
                          {fmtDate(ord.orderDate)} • {fmtTime(ord.orderDate)}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 mt-2">
                        {ord.cartItems?.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-xs rounded-lg bg-[var(--elevated)]/50 px-2.5 py-1">
                            <span className="truncate font-semibold text-[var(--text)]">🎮 {it.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {it.isBonus && (
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Bonus</span>
                              )}
                              {it.isSims4 && (
                                <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">Sims 4</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {ord.bonusEligible > 0 && (
                      <div className="mt-3 flex items-center justify-between border-t border-[var(--border-soft)] pt-2 text-[10px]">
                        <span className="text-[var(--text-3)]">Bonus didapat:</span>
                        <span className="font-bold text-[var(--primary)]">
                          {ord.bonusClaimed || 0}/{ord.bonusEligible} terpakai
                        </span>
                      </div>
                    )}
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
      {!hasScanned && !isScanning && (() => {
        const todayCustomers = allCustomers.filter(c => isToday(c.lastOrderDate || c.updatedAt || c.createdAt))
        const bonusCustomers = allCustomers.filter(c => c.bonusPending > 0)

        const displayedCustomers = allCustomers.filter(c => {
          if (activeTab === 'today') {
            if (!isToday(c.lastOrderDate || c.updatedAt || c.createdAt)) return false
          } else if (activeTab === 'bonus') {
            if (!c.bonusPending || c.bonusPending <= 0) return false
          }
          if (listQuery.trim()) {
            const q = listQuery.trim().toLowerCase()
            const matchEmail = (c.email || '').toLowerCase().includes(q)
            const matchInv = (c.lastInvoice || '').toLowerCase().includes(q)
            const matchGame = c.lastGames?.some(g => (g || '').toLowerCase().includes(q))
            if (!matchEmail && !matchInv && !matchGame) return false
          }
          return true
        }).sort((a, b) => {
          if (sortBy === 'orders') {
            return (b.orderCount || 0) - (a.orderCount || 0)
          }
          const timeA = new Date(a.lastOrderDate || a.updatedAt || a.createdAt || 0).getTime()
          const timeB = new Date(b.lastOrderDate || b.updatedAt || b.createdAt || 0).getTime()
          return timeB - timeA
        })

        const visibleCustomers = displayedCustomers.slice(0, displayLimit)

        return (
          <div className="pb-24">
            <div className="flex gap-4 sm:gap-6 mb-4 border-b border-[var(--border-soft)] items-center justify-between flex-wrap">
              <div className="flex gap-4 sm:gap-6 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setActiveTab('all'); setDisplayLimit(36) }}
                  className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'all' ? 'text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
                >
                  Semua Pelanggan ({allCustomers.length})
                  {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] shadow-[0_0_10px_rgba(255,209,0,0.5)]" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('today'); setDisplayLimit(36) }}
                  className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-1.5 ${activeTab === 'today' ? 'text-amber-400' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
                >
                  <Flame size={15} className={activeTab === 'today' ? 'text-amber-400' : 'text-[var(--text-3)]'} />
                  Hari Ini ({todayCustomers.length})
                  {activeTab === 'today' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('licenses')}
                  className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-1.5 ${activeTab === 'licenses' ? 'text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
                >
                  <KeyRound size={15} className={activeTab === 'licenses' ? 'text-purple-400' : 'text-[var(--text-3)]'} />
                  Kelola Lisensi Sims 4
                  {activeTab === 'licenses' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('bonus'); setDisplayLimit(36) }}
                  className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'bonus' ? 'text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
                >
                  Klaim Bonus
                  {bonusCustomers.length > 0 && (
                    <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-black text-[var(--primary-fg)] shadow-[0_0_8px_rgba(255,209,0,0.4)]">
                      {bonusCustomers.length}
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

            {activeTab === 'licenses' ? (
              <Sims4LicensesTab onSelectEmail={(em) => { setEmail(em); handleSearch(em); }} />
            ) : loadingAll ? (
              <div className="py-20 text-center"><Loader2 className="mx-auto animate-spin text-[var(--primary)]" size={32} /></div>
            ) : (
              <div>
                {/* Search & Sort Toolbar */}
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                    <input
                      type="text"
                      value={listQuery}
                      onChange={e => setListQuery(e.target.value)}
                      placeholder="Saring daftar (email / no. invoice / game)..."
                      className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] py-2 pl-9 pr-8 text-xs text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
                    />
                    {listQuery && (
                      <button onClick={() => setListQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)]">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[11px] text-[var(--text-3)] hidden sm:inline">
                      Menampilkan {Math.min(visibleCustomers.length, displayedCustomers.length)} dari {displayedCustomers.length}
                    </span>
                    <div className="flex items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-0.5">
                      <button
                        type="button"
                        onClick={() => setSortBy('recent')}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${sortBy === 'recent' ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm' : 'text-[var(--text-3)] hover:text-[var(--text)]'}`}
                      >
                        Terbaru
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortBy('orders')}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${sortBy === 'orders' ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm' : 'text-[var(--text-3)] hover:text-[var(--text)]'}`}
                      >
                        Order Terbanyak
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cards Grid */}
                {displayedCustomers.length === 0 ? (
                  <div className="col-span-full py-16 text-center">
                    <span className="text-4xl block mb-3">📭</span>
                    <span className="text-sm font-semibold text-[var(--text-2)]">
                      {activeTab === 'today'
                        ? 'Belum ada pengiriman game hari ini.'
                        : activeTab === 'bonus'
                        ? 'Tidak ada pelanggan yang berhak mendapat bonus saat ini.'
                        : listQuery
                        ? `Tidak ada pelanggan yang cocok dengan pencarian "${listQuery}".`
                        : 'Belum ada data pelanggan.'}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {visibleCustomers.map(c => (
                        <button
                          key={c.email}
                          onClick={() => { setEmail(c.email); handleSearch(c.email) }}
                          className="text-left flex flex-col justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 transition-all hover:border-[var(--primary)] hover:shadow-[0_10px_30px_-15px_rgba(255,209,0,0.2)] group"
                        >
                          <div>
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.status === 'blacklisted' ? 'bg-red-500/10 text-red-500' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
                                <User size={20} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-bold text-[var(--text)] text-sm group-hover:text-[var(--primary)] transition-colors">{c.email}</p>
                                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] font-medium">
                                  <span>{c.orderCount || 0} Order</span>
                                  <span>•</span>
                                  <span className="truncate">{fmtActivity(c.lastOrderDate || c.updatedAt || c.createdAt)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Aktivitas Terakhir */}
                            {(c.lastInvoice || (c.lastGames && c.lastGames.length > 0)) && (
                              <div className="mt-3 rounded-xl bg-[var(--elevated)]/60 px-2.5 py-1.5 text-[11px] border border-[var(--border-soft)]/50">
                                <div className="flex items-center justify-between gap-1 text-[10px] text-[var(--text-3)] mb-0.5">
                                  <span className="font-semibold uppercase tracking-wider">Aktivitas Terakhir</span>
                                  {c.lastInvoice && <span className="font-mono text-[var(--text-2)] font-semibold">{c.lastInvoice}</span>}
                                </div>
                                {c.lastGames && c.lastGames.length > 0 && (
                                  <p className="truncate font-medium text-[var(--text)] text-[11px]">
                                    🎮 {c.lastGames.join(', ')}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {c.bonusPending > 0 && (
                            <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--primary)]/10 px-3 py-1.5 border border-[var(--primary)]/20">
                              <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider">Hak Bonus:</span>
                              <span className="text-[12px] font-black text-[var(--primary)]">{c.bonusPending} Game</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Pagination / Load more */}
                    {displayedCustomers.length > displayLimit && (
                      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setDisplayLimit(prev => prev + 36)}
                          className="pressable rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-2 text-xs font-bold text-[var(--text)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                        >
                          Muat 36 Pelanggan Lagi ({displayedCustomers.length - displayLimit} tersisa)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDisplayLimit(displayedCustomers.length)}
                          className="pressable rounded-xl bg-[var(--elevated)] px-4 py-2 text-xs font-bold text-[var(--text-3)] transition hover:text-[var(--text)]"
                        >
                          Tampilkan Semua ({displayedCustomers.length})
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Resend Modal Portal */}
      {mounted && resend && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
          <div className="animate-overlay absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setResend(null)} />
          <div className="animate-sheet relative w-full max-w-[460px] overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-3.5 bg-[var(--elevated)]/40">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                <Send size={13} className="text-[var(--primary)]" /> Pesan Balasan The Sims 4
              </span>
              <button
                type="button"
                onClick={() => setResend(null)}
                className="rounded-lg p-1 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--elevated)]"
              >
                <X size={18} />
              </button>
            </div>
            <pre className="mono max-h-[50vh] overflow-y-auto whitespace-pre-wrap p-5 text-xs leading-relaxed text-[var(--text-2)] bg-[var(--surface)]">
              {resend.message}
            </pre>
            <div className="border-t border-[var(--border-soft)] p-4 bg-[var(--elevated)]/20">
              <button
                type="button"
                onClick={copyResend}
                className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] transition hover:brightness-105 shadow-md shadow-[var(--primary)]/20"
              >
                {copiedMsg ? (
                  <>
                    <CheckCheck size={16} /> Tersalin! Siap dipaste ke Shopee / WA
                  </>
                ) : (
                  <>
                    <Copy size={16} /> Salin Pesan Balasan Chat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
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
