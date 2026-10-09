'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react'

const ToastContext = createContext(null)

/**
 * Toast types: 'success' | 'error' | 'info' | 'warning'
 * Supports both:
 * 1. String: toast('Message', 'success')
 * 2. Object: toast({ title: 'Title', description: 'Desc', variant: 'success' })
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((payload, fallbackType = 'success', duration = 4000) => {
    const id = Date.now() + Math.random()

    let title = null
    let description = null
    let text = ''
    let type = fallbackType

    if (typeof payload === 'object' && payload !== null) {
      title = payload.title || null
      description = payload.description || null
      text = payload.text || payload.message || ''
      type = payload.variant || payload.type || fallbackType
    } else {
      text = String(payload || '')
    }

    setToasts(prev => [...prev, { id, title, description, text, type }])
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const icons = {
    success: <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />,
    error: <AlertTriangle size={16} className="shrink-0 text-red-400" />,
    warning: <AlertTriangle size={16} className="shrink-0 text-amber-400" />,
    info: <Info size={16} className="shrink-0 text-blue-400" />
  }

  const colors = {
    success: 'border-emerald-500/40 bg-zinc-950/95 text-emerald-300 shadow-emerald-950/50',
    error: 'border-red-500/40 bg-zinc-950/95 text-red-300 shadow-red-950/50',
    warning: 'border-amber-500/40 bg-zinc-950/95 text-amber-300 shadow-amber-950/50',
    info: 'border-blue-500/40 bg-zinc-950/95 text-blue-300 shadow-blue-950/50'
  }

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-16 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-xs shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300 pointer-events-auto ${colors[toast.type] || colors.info}`}
          >
            <div className="mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 min-w-0">
              {toast.title && <div className="font-bold text-white leading-snug">{toast.title}</div>}
              {toast.description && (
                <div className="text-[11px] opacity-80 leading-relaxed mt-0.5 font-normal">
                  {toast.description}
                </div>
              )}
              {!toast.title && !toast.description && (
                <div className="font-semibold leading-snug">{toast.text}</div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer ml-1 mt-0.5"
              aria-label="Tutup"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * Hook to use toast from any client component.
 * Usage:
 *   const { toast } = useToast()
 *   toast('Game berhasil diupload!', 'success')
 *   toast({ title: 'Sukses', description: 'File dihapus', variant: 'success' })
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return { toast: ctx.addToast, dismiss: ctx.removeToast }
}
