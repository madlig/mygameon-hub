'use client'

import { useState } from 'react'
import { Check, X, AlertTriangle, PartyPopper, Copy, CheckCheck, MessageSquare, Tag } from 'lucide-react'

/**
 * Panel hasil pengiriman game — sukses / sebagian / gagal.
 * report: [{ name, status: 'success'|'error', message? }]
 * chatMessage: template teks balasan pesan chat Shopee/WhatsApp
 */
export default function SendResult({
  report = [],
  email = '',
  invoice = '',
  chatMessage = '',
  onClose,
  onReset,
}) {
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedInvoice, setCopiedInvoice] = useState(false)
  const [copiedChat, setCopiedChat] = useState(false)

  const total = report.length
  const success = report.filter(r => r.status === 'success').length
  const failed = total - success

  const variant = success === total ? 'success' : success === 0 ? 'error' : 'partial'

  const hero = {
    success: {
      icon: PartyPopper,
      ring: '#22c55e',
      title: 'Pesanan Berhasil Diproses!',
      subtitle: `${success} game/lisensi telah aktif${email ? ' & email konfirmasi terkirim.' : '.'}`,
    },
    partial: {
      icon: AlertTriangle,
      ring: '#f59e0b',
      title: 'Sebagian Berhasil',
      subtitle: `${success} dari ${total} berhasil. ${failed} gagal — cek detail di bawah.`,
    },
    error: {
      icon: X,
      ring: '#ef4444',
      title: 'Gagal Terkirim',
      subtitle: `${total} game tidak berhasil dikirim. Periksa kendala lalu coba lagi.`,
    },
  }[variant]

  const HeroIcon = hero.icon

  function copyText(text, setter) {
    if (!text) return
    try {
      navigator.clipboard.writeText(text)
      setter(true)
      setTimeout(() => setter(false), 1800)
    } catch (_) {}
  }

  return (
    <div className="animate-scale overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl">
      {/* ── 1. Hero Header ── */}
      <div className="relative flex flex-col items-center gap-2.5 px-5 pt-6 pb-4 text-center">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--elevated)] text-[var(--text-3)] transition-colors hover:text-[var(--text)] hover:bg-[var(--border-soft)]"
            title="Tutup"
          >
            <X size={14} />
          </button>
        )}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-60"
          style={{ background: `radial-gradient(220px 90px at 50% 0%, ${hero.ring}33, transparent 70%)` }}
        />
        <span
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: `${hero.ring}1f`, color: hero.ring, boxShadow: `0 0 28px -6px ${hero.ring}88` }}
        >
          <HeroIcon size={26} strokeWidth={2.2} />
        </span>
        <h3 className="font-display relative text-lg font-extrabold tracking-tight text-[var(--text)]">{hero.title}</h3>
        <p className="relative max-w-[320px] text-[12px] leading-relaxed text-[var(--text-2)]">{hero.subtitle}</p>

        {/* Quick Copy Chips: Invoice & Email */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
          {invoice && (
            <button
              type="button"
              onClick={() => copyText(invoice, setCopiedInvoice)}
              className="pressable relative inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-1 text-[11px] font-mono text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
              title="Salin Nomor Pesanan Shopee"
            >
              <Tag size={11} className="text-[var(--primary)]" />
              <span>{invoice}</span>
              {copiedInvoice ? <CheckCheck size={12} className="text-[#22c55e]" /> : <Copy size={11} />}
            </button>
          )}

          {email && (
            <button
              type="button"
              onClick={() => copyText(email, setCopiedEmail)}
              className="pressable relative inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-1 text-[11px] font-medium text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
              title="Salin email pembeli"
            >
              <span className="max-w-[180px] truncate">{email}</span>
              {copiedEmail ? <CheckCheck size={12} className="text-[#22c55e]" /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Count Strip ── */}
      <div className="grid grid-cols-2 border-y border-[var(--border-soft)] bg-[var(--bg)]/40 text-center">
        <div className="border-r border-[var(--border-soft)] py-2">
          <p className="font-display text-base font-extrabold text-[#4ade80]">{success}</p>
          <p className="text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-3)]">Terkirim / Aktif</p>
        </div>
        <div className="py-2">
          <p className={`font-display text-base font-extrabold ${failed > 0 ? 'text-[#fca5a5]' : 'text-[var(--text-3)]'}`}>{failed}</p>
          <p className="text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-3)]">Gagal</p>
        </div>
      </div>

      {/* ── 3. Kartu Balasan Chat Shopee Siap-Salin (Fitur Utama Baru) ── */}
      {chatMessage && (
        <div className="p-3 bg-[var(--elevated)]/40 border-b border-[var(--border-soft)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text)] uppercase tracking-wider">
              <MessageSquare size={13} className="text-[var(--primary)]" />
              Pesan Balasan Chat Shopee
            </span>
            <span className="text-[10px] text-[var(--text-3)]">Siap-salin 1 klik</span>
          </div>

          <pre className="mono max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-2.5 text-[11px] leading-relaxed text-[var(--text-2)]">
            {chatMessage}
          </pre>

          <button
            type="button"
            onClick={() => copyText(chatMessage, setCopiedChat)}
            className="pressable mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-2.5 text-xs font-bold text-[var(--primary-fg)] transition-all hover:brightness-105"
          >
            {copiedChat ? (
              <><CheckCheck size={14} className="text-black" /> Pesan Chat Berhasil Disalin!</>
            ) : (
              <><Copy size={14} /> Salin Pesan untuk Chat Shopee</>
            )}
          </button>
        </div>
      )}

      {/* ── 4. Rincian Item Status ── */}
      <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto p-3">
        {report.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
              r.status === 'success'
                ? 'border-[var(--success)]/20 bg-[var(--success)]/[0.06]'
                : 'border-[var(--danger)]/25 bg-[var(--danger)]/[0.07]'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                r.status === 'success' ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--danger)]/15 text-[var(--danger)]'
              }`}
            >
              {r.status === 'success' ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-[var(--text)]">{r.name}</p>
              {r.message && <p className="truncate text-[10.5px] text-[#fca5a5]">{r.message}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── 5. Tombol Aksi ── */}
      <div className="flex gap-2 border-t border-[var(--border-soft)] p-3">
        {onReset && (
          <button
            onClick={onReset}
            className="pressable flex-1 rounded-xl bg-[var(--elevated)] border border-[var(--border-soft)] py-2 text-[12px] font-bold text-[var(--text)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            Pesanan Baru
          </button>
        )}
        <button
          onClick={onClose}
          className={`pressable rounded-xl border border-[var(--border-soft)] py-2 text-[12px] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] ${onReset ? 'px-4' : 'flex-1'}`}
        >
          Tutup
        </button>
      </div>
    </div>
  )
}
