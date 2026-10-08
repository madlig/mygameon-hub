'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X, Loader2 } from 'lucide-react'

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
  message, // Fallback alias untuk description
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  tone = 'danger', // 'danger' | 'warning' | 'primary'
  variant, // Fallback alias untuk tone
  loading = false,
  onConfirm,
  onClose,
}) {
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const isLoading = loading || isSubmitting
  const displayDescription = description || message
  const activeTone = tone || variant || 'danger'

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape' && !isLoading) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, isLoading, onClose])

  if (!open || !mounted) return null

  const confirmClasses =
    activeTone === 'danger'
      ? 'bg-[var(--danger)] text-white hover:brightness-110'
      : activeTone === 'warning'
      ? 'bg-amber-500 text-black hover:brightness-110'
      : 'bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-105'

  const iconClasses =
    activeTone === 'danger'
      ? 'bg-[var(--danger)]/15 text-[var(--danger)]'
      : activeTone === 'warning'
      ? 'bg-amber-500/15 text-amber-400'
      : 'bg-[var(--primary)]/15 text-[var(--primary)]'

  const handleConfirmClick = async () => {
    if (isLoading) return
    try {
      const result = onConfirm?.()
      if (result && typeof result.then === 'function') {
        setIsSubmitting(true)
        await result
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Portal ke body: dialog ini sering dirender di dalam <main> yang
  // overflow-y-auto; iOS Safari mengunci elemen fixed ke scroll container itu.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div
        className="animate-overlay absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !isLoading && onClose?.()}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-sheet relative w-full max-w-[400px] rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-2xl"
      >
        <button
          onClick={() => !isLoading && onClose?.()}
          disabled={isLoading}
          className="absolute right-3.5 top-3.5 text-[var(--text-3)] transition-colors hover:text-[var(--text)] disabled:opacity-50"
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="flex gap-3.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClasses}`}
          >
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h3 className="font-display text-base font-bold text-[var(--text)]">{title}</h3>
            {displayDescription && (
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">{displayDescription}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            onClick={() => !isLoading && onClose?.()}
            disabled={isLoading}
            className="pressable flex-1 rounded-xl border border-[var(--border-soft)] py-2.5 text-sm font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={isLoading}
            className={`pressable flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60 cursor-pointer ${confirmClasses}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 size={14} className="animate-spin" />
                <span>Memproses…</span>
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
