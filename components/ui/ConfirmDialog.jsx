'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

/**
 * Dialog konfirmasi untuk aksi destruktif / tak-bisa-dibatalkan.
 *
 * Pemakaian (controlled):
 *   const [confirm, setConfirm] = useState(null)
 *   <ConfirmDialog
 *     open={!!confirm}
 *     {...confirm}
 *     onClose={() => setConfirm(null)}
 *   />
 *   // buka: setConfirm({ title, description, confirmLabel, tone, onConfirm })
 */
export default function ConfirmDialog({
  open,
  title = 'Yakin?',
  description,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  tone = 'danger', // 'danger' | 'primary'
  loading = false,
  onConfirm,
  onClose,
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape' && !loading) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, loading, onClose])

  if (!open || !mounted) return null

  const confirmClasses =
    tone === 'danger'
      ? 'bg-[var(--danger)] text-white hover:brightness-110'
      : 'bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-105'

  // Portal ke body: dialog ini sering dirender di dalam <main> yang
  // overflow-y-auto; iOS Safari mengunci elemen fixed ke scroll container itu.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div
        className="animate-overlay absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !loading && onClose?.()}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-sheet relative w-full max-w-[400px] rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-2xl"
      >
        <button
          onClick={() => !loading && onClose?.()}
          className="absolute right-3.5 top-3.5 text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="flex gap-3.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              tone === 'danger'
                ? 'bg-[var(--danger)]/15 text-[var(--danger)]'
                : 'bg-[var(--primary)]/15 text-[var(--primary)]'
            }`}
          >
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h3 className="font-display text-base font-bold text-[var(--text)]">{title}</h3>
            {description && (
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">{description}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            onClick={() => !loading && onClose?.()}
            disabled={loading}
            className="pressable flex-1 rounded-xl border border-[var(--border-soft)] py-2.5 text-sm font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`pressable flex-1 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60 ${confirmClasses}`}
          >
            {loading ? 'Memproses…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
