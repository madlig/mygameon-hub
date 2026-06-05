'use client'

import { useState } from 'react'
import { Check, X, AlertTriangle, PartyPopper, Copy, CheckCheck } from 'lucide-react'

/**
 * Panel hasil pengiriman game — sukses / sebagian / gagal.
 * report: [{ name, status: 'success'|'error', message? }]
 */
export default function SendResult({ report = [], email, onClose, onReset }) {
  const [copied, setCopied] = useState(false)

  const total = report.length
  const success = report.filter(r => r.status === 'success').length
  const failed = total - success

  const variant = success === total ? 'success' : success === 0 ? 'error' : 'partial'

  const hero = {
    success: {
      icon: PartyPopper,
      ring: '#22c55e',
      title: 'Berhasil terkirim!',
      subtitle: `${success} game dibagikan & email pengiriman sudah dikirim.`,
    },
    partial: {
      icon: AlertTriangle,
      ring: '#f59e0b',
      title: 'Sebagian terkirim',
      subtitle: `${success} dari ${total} game berhasil. ${failed} gagal — cek detail di bawah.`,
    },
    error: {
      icon: X,
      ring: '#ef4444',
      title: 'Gagal terkirim',
      subtitle: `${total} game tidak berhasil dikirim. Periksa detail lalu coba lagi.`,
    },
  }[variant]

  const HeroIcon = hero.icon

  function copyEmail() {
    if (!email) return
    try {
      navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch (e) {}
  }

  return (
    <div className="animate-scale overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
      {/* Hero */}
      <div className="relative flex flex-col items-center gap-2.5 px-5 pt-6 pb-5 text-center">
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
        <p className="relative max-w-[280px] text-[12.5px] leading-relaxed text-[var(--text-2)]">{hero.subtitle}</p>

        {email && (
          <button
            onClick={copyEmail}
            className="pressable relative mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-1 text-[11px] font-medium text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
            title="Salin email"
          >
            {copied ? <CheckCheck size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
            <span className="max-w-[200px] truncate">{copied ? 'Email disalin' : email}</span>
          </button>
        )}
      </div>

      {/* Count strip */}
      <div className="grid grid-cols-2 border-y border-[var(--border-soft)] bg-[var(--bg)]/40 text-center">
        <div className="border-r border-[var(--border-soft)] py-2.5">
          <p className="font-display text-lg font-extrabold text-[#4ade80]">{success}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">Terkirim</p>
        </div>
        <div className="py-2.5">
          <p className={`font-display text-lg font-extrabold ${failed > 0 ? 'text-[#fca5a5]' : 'text-[var(--text-3)]'}`}>{failed}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">Gagal</p>
        </div>
      </div>

      {/* Item list */}
      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto p-3">
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

      {/* Actions */}
      <div className="flex gap-2 border-t border-[var(--border-soft)] p-3">
        {onReset && (
          <button
            onClick={onReset}
            className="pressable flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-[13px] font-bold text-[var(--primary-fg)] transition-all hover:brightness-105"
          >
            Kirim lagi
          </button>
        )}
        <button
          onClick={onClose}
          className={`pressable rounded-xl border border-[var(--border-soft)] py-2.5 text-[13px] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] ${onReset ? 'px-4' : 'flex-1'}`}
        >
          Tutup
        </button>
      </div>
    </div>
  )
}
