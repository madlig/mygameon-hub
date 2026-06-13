'use client'

import { useState } from 'react'
import { X, Mail, Clock, FileBox, Link2, AlertCircle, Package, ShoppingCart, Gift, Check } from 'lucide-react'

export const EXPIRY_OPTIONS = [
  { label: 'Permanen', value: null },
  { label: '1 Hari', value: 1 },
  { label: '1 Minggu', value: 7 },
  { label: '1 Bulan', value: 30 },
  { label: '1 Tahun', value: 365 },
  { label: 'Custom', value: 'custom' },
]

export function getExpiryLabel(option, customDays) {
  if (!option) return 'Permanen'
  const days = option === 'custom' ? parseInt(customDays) : option
  if (!days || isNaN(days)) return 'Permanen'
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `Hingga ${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

const EMAIL_LIST_ID = 'recent-emails'

export default function CheckoutBody({
  cart, onRemove, onSaveBundle,
  email, setEmail, emailValid, recentEmails = [],
  expiryOption, setExpiryOption, customDays, setCustomDays,
  isBonus, setIsBonus,
  sendError, isSending, onSend,
  hideSubmit = false,
}) {
  const [savingBundle, setSavingBundle] = useState(false)
  const [bundleName, setBundleName] = useState('')
  const emailTouched = email.length > 0
  const expiryLabel = getExpiryLabel(expiryOption, customDays)

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--elevated)] text-[var(--text-3)]">
          <ShoppingCart size={22} />
        </span>
        <p className="text-xs font-semibold text-[var(--text-2)]">Keranjang masih kosong</p>
        <p className="text-[10.5px] text-[var(--text-3)]">Cari game atau pakai akses cepat di kiri</p>
      </div>
    )
  }

  function confirmSaveBundle() {
    const nm = bundleName.trim()
    if (!nm) return
    onSaveBundle(nm)
    setBundleName('')
    setSavingBundle(false)
  }

  return (
    <div className="p-4">
      {/* Items */}
      <div className="mb-3 flex flex-col gap-2">
        {cart.map(item => (
          <div key={item.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--text-3)]">
              {item.isShortcut ? <Link2 size={13} /> : <FileBox size={13} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--text)]">{item.name}</p>
              <p className="mono text-[10px] text-[var(--text-3)]">{item.isShortcut ? 'shortcut' : 'file'}</p>
            </div>
            <button onClick={() => onRemove(item.id)} className="shrink-0 text-[var(--text-3)] transition-colors hover:text-[var(--danger)]" title="Hapus">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Simpan sebagai paket */}
      <div className="mb-4">
        {savingBundle ? (
          <div className="flex gap-2">
            <input
              value={bundleName} onChange={e => setBundleName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmSaveBundle()}
              autoFocus placeholder="Nama paket (mis. Starter Pack)"
              className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            <button onClick={confirmSaveBundle} disabled={!bundleName.trim()} className="pressable rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
              Simpan
            </button>
            <button onClick={() => { setSavingBundle(false); setBundleName('') }} className="text-[var(--text-3)] hover:text-[var(--text)]">
              <X size={15} />
            </button>
          </div>
        ) : (
          <button onClick={() => setSavingBundle(true)} className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-hi)] transition-colors hover:text-[var(--accent)]">
            <Package size={13} /> Simpan keranjang ini sebagai paket
          </button>
        )}
      </div>

      {/* Durasi — selalu tampil */}
      <div className="mb-3">
        <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
          <Clock size={12} /> Durasi akses
        </label>
        <div className="flex flex-wrap gap-1.5">
          {EXPIRY_OPTIONS.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => { setExpiryOption(opt.value); if (opt.value !== 'custom') setCustomDays('') }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                expiryOption === opt.value
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'border border-[var(--border-soft)] text-[var(--text-2)] hover:bg-[var(--elevated)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {expiryOption === 'custom' && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number" value={customDays} onChange={e => setCustomDays(e.target.value)}
              placeholder="Jumlah hari..." min="1"
              className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
            <span className="text-xs text-[var(--text-3)]">hari</span>
          </div>
        )}
        {expiryOption && <p className="mt-1.5 text-[10px] text-[var(--primary)]">📅 {expiryLabel}</p>}
      </div>

      {/* Email + chip email terakhir */}
      <div className="mb-3">
        <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
          <Mail size={12} /> Email pembeli
        </label>
        <div className="relative">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            list={EMAIL_LIST_ID} autoComplete="off"
            placeholder="customer@gmail.com"
            className={`w-full rounded-xl border bg-[var(--elevated)] py-2.5 pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors ${
              emailTouched && !emailValid ? 'border-[var(--danger)]' : 'border-[var(--border-soft)] focus:border-[var(--primary)]'
            }`}
          />
        </div>
        {recentEmails.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recentEmails.slice(0, 4).map(e => (
              <button
                key={e}
                onClick={() => setEmail(e)}
                className={`max-w-[180px] truncate rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition-colors ${
                  email === e ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border-soft)] text-[var(--text-3)] hover:border-[var(--border-strong)] hover:text-[var(--text-2)]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {emailTouched && !emailValid && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--danger)]"><AlertCircle size={12} /> Format email belum valid</p>
        )}
      </div>

      {/* Game bonus — tidak dihitung di dashboard */}
      <button
        type="button"
        onClick={() => setIsBonus?.(!isBonus)}
        className={`mb-3 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          isBonus ? 'border-[var(--accent)] bg-[var(--accent)]/[0.07]' : 'border-[var(--border-soft)] bg-[var(--bg)]/40 hover:border-[var(--border-strong)]'
        }`}
      >
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${isBonus ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]'}`}>
          {isBonus && <Check size={12} className="text-white" strokeWidth={3} />}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Gift size={14} className={isBonus ? 'text-[var(--accent-hi)]' : 'text-[var(--text-3)]'} />
          <span className="min-w-0">
            <span className="block text-[12px] font-bold text-[var(--text)]">Kirim sebagai bonus</span>
            <span className="block text-[10px] leading-snug text-[var(--text-3)]">Tidak dihitung sebagai order/game baru di dashboard</span>
          </span>
        </span>
      </button>

      {sendError && (
        <div className="mb-3 flex items-start gap-1.5 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[12px] text-[#fca5a5]">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {sendError}
        </div>
      )}

      {/* Send */}
      {!hideSubmit && (
        <button
          onClick={onSend}
          disabled={!emailValid || isSending}
          className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] transition-all hover:brightness-105 hover:shadow-[0_10px_28px_-10px_rgba(255,209,0,0.6)] disabled:opacity-50 disabled:hover:shadow-none"
        >
          {isSending ? 'Mengirim…' : <>Kirim {cart.length} game <span aria-hidden>→</span></>}
        </button>
      )}
    </div>
  )
}
