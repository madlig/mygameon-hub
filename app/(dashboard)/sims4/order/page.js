'use client'

import { useState } from 'react'
import { AlertCircle, Check, Sparkles, Mail, KeyRound, Copy, CheckCheck, RotateCcw } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { isValidEmail } from '@/lib/validators'
import { buildSims4DeliveryMessage } from '@/lib/sims4'

const TABS = [
  { key: 'email', label: 'Kirim via Email', icon: Mail, desc: 'Share Drive + email otomatis' },
  { key: 'license', label: 'Lisensi saja', icon: KeyRound, desc: 'Tanpa email — kartu siap-kirim' },
]

export default function Sims4OrderPage() {
  const [mode, setMode]       = useState('email')
  const [email, setEmail]     = useState('')
  const [invoice, setInvoice] = useState('')
  const [allowCC, setAllowCC] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [deliveryCard, setDeliveryCard] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [copied, setCopied]   = useState(false)

  const emailValid = isValidEmail(email)
  const emailTouched = email.length > 0
  const invoiceReady = invoice.trim().length > 0

  const isLicenseMode = mode === 'license'
  const isReady = isLicenseMode
    ? invoiceReady && (email.length === 0 || emailValid)
    : invoiceReady && emailValid

  function switchMode(m) {
    setMode(m)
    setResult(null)
    setDeliveryCard(null)
  }

  function requestSubmit() {
    setResult(null)
    if (!isReady) return
    setConfirmOpen(true)
  }

  async function doSubmit() {
    setConfirmOpen(false)
    setIsLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/sims4/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, email, invoice, allowCC }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        if (isLicenseMode) {
          setDeliveryCard({
            key: invoice,
            allowCC,
            message: buildSims4DeliveryMessage(invoice, allowCC),
          })
          setInvoice('')
          setEmail('')
        } else {
          setResult({ type: 'success', text: 'Order berhasil! Akses dan email telah dikirim.' })
          setEmail('')
          setInvoice('')
          setAllowCC(false)
        }
      } else {
        setResult({ type: 'error', text: data.error || `Gagal memproses order (${res.status})` })
      }
    } catch (e) {
      setResult({ type: 'error', text: 'Gagal terhubung ke server. Coba lagi.' })
    } finally {
      setIsLoading(false)
    }
  }

  function copyMessage() {
    if (!deliveryCard) return
    try {
      navigator.clipboard.writeText(deliveryCard.message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (e) {}
  }

  return (
    <div className="fadeUp">
      <TopBar title="Order Sims 4" />

      {/* Tab switcher */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-1">
        {TABS.map(t => {
          const Icon = t.icon
          const isActive = mode === t.key
          return (
            <button
              key={t.key}
              onClick={() => switchMode(t.key)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 text-center transition-all ${
                isActive ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-[0_6px_20px_-8px_rgba(255,209,0,0.6)]' : 'text-[var(--text-2)] hover:bg-[var(--elevated)]'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-bold"><Icon size={15} /> {t.label}</span>
              <span className={`text-[10px] ${isActive ? 'text-[var(--primary-fg)]/70' : 'text-[var(--text-3)]'}`}>{t.desc}</span>
            </button>
          )
        })}
      </div>

      {deliveryCard ? (
        // ── Kartu pengiriman (mode lisensi) ──
        <div className="animate-scale">
          <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-[var(--success)]/30 bg-[var(--success)]/[0.07] px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--success)]/15 text-[var(--success)]"><Check size={18} /></span>
            <div>
              <p className="font-display text-sm font-bold text-[var(--text)]">Lisensi berhasil dibuat</p>
              <p className="text-[11px] text-[var(--text-2)]">Salin pesan di bawah, lalu kirim ke pembeli via chat Shopee / WhatsApp.</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                <KeyRound size={12} className="text-[var(--primary)]" /> Pesan pengiriman
              </span>
              <button
                onClick={copyMessage}
                className="pressable flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[11px] font-bold text-[var(--primary-fg)] transition hover:brightness-105"
              >
                {copied ? <><CheckCheck size={13} /> Tersalin</> : <><Copy size={13} /> Salin</>}
              </button>
            </div>
            <pre className="mono whitespace-pre-wrap px-4 py-3 text-[12px] leading-relaxed text-[var(--text-2)]">{deliveryCard.message}</pre>
          </div>

          <button
            onClick={() => { setDeliveryCard(null); setAllowCC(false) }}
            className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] py-2.5 text-sm font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          >
            <RotateCcw size={15} /> Buat order baru
          </button>
        </div>
      ) : (
        <>
          {/* Result message */}
          {result && (
            <div className={`mb-4 flex items-start gap-1.5 rounded-xl border px-4 py-3 text-sm ${
              result.type === 'success'
                ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[#4ade80]'
                : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[#fca5a5]'
            }`}>
              {result.type === 'success' ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {result.text}
            </div>
          )}

          {/* Form */}
          <div className="mb-6 flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">Kode pesanan Shopee</label>
              <input
                type="text" value={invoice} onChange={e => setInvoice(e.target.value)}
                placeholder="2501XXXXXXXXX"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
              />
              <p className="mt-1 text-[10.5px] text-[var(--text-3)]">Dipakai sebagai License Key untuk launcher.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                Email pembeli {isLicenseMode && <span className="normal-case text-[var(--text-3)]">(opsional — untuk arsip)</span>}
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder={isLicenseMode ? 'Boleh dikosongkan' : 'customer@gmail.com'}
                className={`w-full rounded-2xl border bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors ${
                  emailTouched && !emailValid ? 'border-[var(--danger)]' : 'border-[var(--border-soft)] focus:border-[var(--primary)]'
                }`}
              />
              {emailTouched && !emailValid && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--danger)]"><AlertCircle size={12} /> Format email belum valid</p>
              )}
              {isLicenseMode && (
                <p className="mt-1 text-[10.5px] text-[var(--text-3)]">Mode ini tidak mengirim email & tidak share Drive.</p>
              )}
            </div>

            {/* Tier selection */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">Pilih paket</label>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setAllowCC(false)}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    !allowCC ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${!allowCC ? 'border-[var(--primary)]' : 'border-[var(--border-strong)]'}`}>
                    {!allowCC && <div className="h-2 w-2 rounded-full bg-[var(--primary)]" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text)]">Standard</p>
                    <p className="mt-0.5 text-xs text-[var(--text-3)]">Game Only — The Sims 4 base game tanpa mod & CC</p>
                  </div>
                </button>

                <button
                  onClick={() => setAllowCC(true)}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    allowCC ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${allowCC ? 'border-[var(--accent)]' : 'border-[var(--border-strong)]'}`}>
                    {allowCC && <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text)]">Premium</p>
                    <p className="mt-0.5 text-xs text-[var(--text-3)]">Game + Mods & CC — Akses penuh termasuk custom content</p>
                    {allowCC && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--accent-hi)]"><Check size={12} /> CC Flag aktif</p>}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Ringkasan */}
          {isReady && (
            <div className="mb-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">Ringkasan order</p>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-3)]">License Key</span>
                  <span className="mono text-[var(--info)]">{invoice}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-3)]">Email</span>
                  <span className="max-w-[200px] truncate font-semibold text-[var(--text)]">{email || (isLicenseMode ? '— (tidak diisi)' : '')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-3)]">Paket</span>
                  <span className={`font-semibold ${allowCC ? 'text-[var(--accent-hi)]' : 'text-[var(--text-2)]'}`}>{allowCC ? 'Premium CC' : 'Standard'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-3)]">Aksi</span>
                  <span className="text-right text-[var(--text)]">{isLicenseMode ? 'Catat lisensi + kartu salin' : 'Share Drive + Catat DB + Kirim email'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={requestSubmit}
            disabled={!isReady || isLoading}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] transition-all hover:brightness-105 hover:shadow-[0_8px_24px_-10px_rgba(255,209,0,0.55)] disabled:opacity-50 disabled:hover:shadow-none"
          >
            {isLicenseMode ? <KeyRound size={16} /> : <Sparkles size={16} />}
            {isLoading ? 'Memproses…' : isLicenseMode ? 'Buat lisensi & kartu' : 'Kirim akses & email'}
          </button>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        tone="primary"
        title={isLicenseMode ? 'Buat lisensi?' : 'Proses order Sims 4?'}
        description={isLicenseMode
          ? `Lisensi ${invoice} (${allowCC ? 'Premium CC' : 'Standard'}) akan didaftarkan Active. Tanpa kirim email & tanpa share Drive. Anda akan dapat kartu siap-kirim.`
          : `Akses folder Sims 4 (${allowCC ? 'Premium CC' : 'Standard'}) akan dibagikan ke ${email} dan email pengiriman dikirim otomatis. Pastikan email & kode pesanan benar.`}
        confirmLabel={isLicenseMode ? 'Ya, buat lisensi' : 'Ya, proses order'}
        onConfirm={doSubmit}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}
