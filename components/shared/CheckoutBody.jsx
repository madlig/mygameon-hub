'use client'

import { useState } from 'react'
import { X, Mail, Clock, FileBox, AlertCircle, Package, ShoppingCart, Gift, Check, Tag, Hash, Sparkles } from 'lucide-react'
import { isSims4Game } from '@/lib/sims4'

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
  cart, onRemove, onSaveBundle, onToggleSimsCC,
  invoice = '', setInvoice,
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
        <p className="text-[10.5px] text-[var(--text-3)]">Cari game di katalog atau pakai akses cepat</p>
      </div>
    )
  }

  const hasSims4 = cart.some(item => item.isSims4 || isSims4Game(item.name))
  const hasPCGames = cart.some(item => !(item.isSims4 || isSims4Game(item.name)))
  const invoiceValid = invoice.trim().length > 0

  // Validasi tombol submit:
  // Jika ada PC Games -> email wajib valid + jika ada Sims 4 invoice wajib ada
  // Jika hanya Sims 4 -> invoice wajib ada + email opsional (tapi jika diisi harus valid)
  const canSubmit = hasPCGames
    ? (emailValid && (!hasSims4 || invoiceValid))
    : (invoiceValid && (email.length === 0 || emailValid))

  function confirmSaveBundle() {
    const nm = bundleName.trim()
    if (!nm) return
    onSaveBundle(nm)
    setBundleName('')
    setSavingBundle(false)
  }

  return (
    <div className="p-4 space-y-4">
      {/* ── 1. Nomor Pesanan Shopee / Invoice ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]">
            <Tag size={12} className={hasSims4 ? "text-[var(--primary)]" : "text-[var(--text-3)]"} />
            No. Pesanan Shopee
            {hasSims4 ? (
              <span className="text-[9px] font-extrabold text-[var(--primary)] bg-[var(--primary)]/15 px-1.5 py-0.5 rounded-full uppercase tracking-tight">Wajib (License Key)</span>
            ) : (
              <span className="text-[9px] text-[var(--text-3)] font-normal">(Opsional)</span>
            )}
          </label>
          {invoice && (
            <button type="button" onClick={() => setInvoice?.('')} className="text-[10px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
              Bersihkan
            </button>
          )}
        </div>
        <div className="relative">
          <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="text"
            value={invoice}
            onChange={e => setInvoice?.(e.target.value)}
            placeholder="2501XXXXXXXXX"
            className={`w-full rounded-xl border bg-[var(--elevated)] py-2.5 pl-9 pr-3 text-xs font-mono text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors ${
              hasSims4 && !invoiceValid ? 'border-[var(--primary)]/60 focus:border-[var(--primary)]' : 'border-[var(--border-soft)] focus:border-[var(--primary)]'
            }`}
          />
        </div>
        {hasSims4 && (
          <p className="mt-1 text-[10px] text-[var(--text-3)] leading-relaxed">
            Nomor ini otomatis dijadikan <strong>License Key</strong> launcher The Sims 4.
          </p>
        )}
      </div>

      {/* ── 2. Daftar Game di Keranjang ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]">
            Daftar Game ({cart.length})
          </span>
          {cart.length > 1 && (
            <span className="text-[10px] text-[var(--text-3)]">
              1 Pesanan Terpadu
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {cart.map(item => {
            const isSims = item.isSims4 || isSims4Game(item.name)
            return (
              <div key={item.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] p-2.5 transition-all">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isSims ? 'bg-[var(--accent)]/15 text-[var(--accent-hi)]' : 'bg-[var(--surface)] text-[var(--text-3)]'}`}>
                    {isSims ? <Sparkles size={14} /> : <FileBox size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[var(--text)]">{item.name}</p>
                    <p className="mono truncate text-[10px] text-[var(--text-3)]">
                      {isSims
                        ? (item.allowCC ? '💎 Varian Premium (Full Mods/CC)' : '🎮 Varian Standard (Game Only)')
                        : (item.availableIn > 1 ? `Tersedia di ${item.availableIn} Workspace` : (item.ownerEmail || 'Google Drive'))
                      }
                    </p>
                  </div>
                  <button onClick={() => onRemove(item.id)} className="shrink-0 text-[var(--text-3)] transition-colors hover:text-[var(--danger)] p-1" title="Hapus dari keranjang">
                    <X size={15} />
                  </button>
                </div>

                {/* Switch khusus The Sims 4: Standard vs Premium CC */}
                {isSims && (
                  <div className="mt-2.5 pt-2 border-t border-[var(--border-soft)]/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-[var(--text-3)]">Pilihan Paket The Sims 4:</span>
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${item.allowCC ? 'bg-[var(--accent)]/15 text-[var(--accent-hi)]' : 'bg-[var(--primary)]/15 text-[var(--primary)]'}`}>
                        {item.allowCC ? 'Premium CC' : 'Standard'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface)] p-1 border border-[var(--border-soft)]">
                      <button
                        type="button"
                        onClick={() => onToggleSimsCC?.(item.id, false)}
                        className={`py-1 text-[11px] font-bold rounded-md transition-all ${
                          !item.allowCC
                            ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm'
                            : 'text-[var(--text-2)] hover:bg-[var(--elevated)]'
                        }`}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSimsCC?.(item.id, true)}
                        className={`py-1 text-[11px] font-bold rounded-md transition-all ${
                          item.allowCC
                            ? 'bg-[var(--accent)] text-white shadow-sm'
                            : 'text-[var(--text-2)] hover:bg-[var(--elevated)]'
                        }`}
                      >
                        Premium CC
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 3. Simpan Sebagai Paket ── */}
      <div>
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
            <button onClick={() => { setSavingBundle(false); setBundleName('') }} className="text-[var(--text-3)] hover:text-[var(--text)] p-1">
              <X size={15} />
            </button>
          </div>
        ) : (
          <button onClick={() => setSavingBundle(true)} className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-hi)] transition-colors hover:text-[var(--accent)]">
            <Package size={13} /> Simpan keranjang ini sebagai paket
          </button>
        )}
      </div>

      {/* ── 4. Durasi Akses Google Drive ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]">
            <Clock size={12} /> Durasi Akses Drive
          </label>
          {hasSims4 && (
            <span className="text-[9px] text-[#22c55e] font-semibold">Sims 4: Permanen</span>
          )}
        </div>
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
              className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
            <span className="text-xs text-[var(--text-3)]">hari</span>
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-[var(--text-3)]">
          {hasSims4 && hasPCGames ? (
            <>📅 {expiryLabel} (berlaku untuk Game PC biasa. Lisensi Sims 4 selalu permanen).</>
          ) : hasSims4 ? (
            <>📅 Akses folder Google Drive Sims 4. Lisensi launcher selalu permanen.</>
          ) : (
            <>📅 Akses Google Drive: {expiryLabel}</>
          )}
        </p>
      </div>

      {/* ── 5. Email Pembeli ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]">
            <Mail size={12} /> Email Pembeli
            {hasPCGames ? (
              <span className="text-[9px] font-extrabold text-[var(--danger)] bg-[var(--danger)]/10 px-1.5 py-0.5 rounded-full uppercase tracking-tight">Wajib</span>
            ) : (
              <span className="text-[9px] text-[var(--text-3)] font-normal normal-case">(Opsional jika lisensi saja)</span>
            )}
          </label>
        </div>
        <div className="relative">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            list={EMAIL_LIST_ID} autoComplete="off"
            placeholder={!hasPCGames && hasSims4 ? "customer@gmail.com (boleh dikosongkan)" : "customer@gmail.com"}
            className={`w-full rounded-xl border bg-[var(--elevated)] py-2.5 pl-9 pr-3 text-xs text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors ${
              emailTouched && !emailValid ? 'border-[var(--danger)]' : 'border-[var(--border-soft)] focus:border-[var(--primary)]'
            }`}
          />
        </div>

        {recentEmails.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recentEmails.slice(0, 4).map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEmail(e)}
                className={`max-w-[180px] truncate rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
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

      {/* ── 6. Opsi Bonus ── */}
      {hasSims4 ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-2.5 text-[11px] text-[var(--text-3)]">
          <Gift size={14} className="shrink-0 text-[var(--text-3)]" />
          <span>The Sims 4 tidak dapat dikirim sebagai bonus (hanya game PC biasa).</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsBonus?.(!isBonus)}
          className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
            isBonus ? 'border-[var(--accent)] bg-[var(--accent)]/[0.07]' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
          }`}
        >
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isBonus ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]'}`}>
            {isBonus && <Check size={11} className="text-white" strokeWidth={3} />}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <Gift size={13} className={isBonus ? 'text-[var(--accent-hi)]' : 'text-[var(--text-3)]'} />
            <span className="min-w-0">
              <span className="block text-[11.5px] font-bold text-[var(--text)]">Kirim sebagai bonus</span>
              <span className="block text-[9.5px] leading-tight text-[var(--text-3)]">Tidak dihitung sebagai order baru di dashboard</span>
            </span>
          </span>
        </button>
      )}

      {/* ── 7. Pesan Error Kirim ── */}
      {sendError && (
        <div className="flex items-start gap-1.5 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[11.5px] text-[#fca5a5]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{sendError}</span>
        </div>
      )}

      {/* ── 8. Tombol Eksekusi Submit ── */}
      {!hideSubmit && (
        <button
          onClick={onSend}
          disabled={!canSubmit || isSending}
          className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] transition-all hover:brightness-105 hover:shadow-[0_10px_28px_-10px_rgba(255,209,0,0.6)] disabled:opacity-50 disabled:hover:shadow-none"
        >
          {isSending ? (
            'Memproses Pesanan…'
          ) : (
            <>
              {hasSims4 && hasPCGames ? `Kirim ${cart.length} Game & Buat Lisensi Sims 4` :
               hasSims4 ? `Proses Order The Sims 4` :
               `Kirim ${cart.length} Game via Google Drive`}
              <span aria-hidden>→</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
