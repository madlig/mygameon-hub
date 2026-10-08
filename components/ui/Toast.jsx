'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react'

const ToastContext = createContext(null)

/**
 * Toast types: 'success' | 'error' | 'info' | 'warning'
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((text, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, text, type }])
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
    success: <CheckCircle2 size={16} className="shrink-0" />,
    error: <AlertTriangle size={16} className="shrink-0" />,
    warning: <AlertTriangle size={16} className="shrink-0" />,
    info: <Info size={16} className="shrink-0" />
  }

  const colors = {
    success: 'border-emerald-500/40 bg-zinc-950/95 text-emerald-400 shadow-emerald-950/50',
    error: 'border-red-500/40 bg-zinc-950/95 text-red-400 shadow-red-950/50',
    warning: 'border-amber-500/40 bg-zinc-950/95 text-amber-400 shadow-amber-950/50',
    info: 'border-blue-500/40 bg-zinc-950/95 text-blue-400 shadow-blue-950/50'
  }

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-16 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300 pointer-events-auto ${colors[toast.type] || colors.info}`}
          >
            {icons[toast.type]}
            <span className="flex-1 leading-snug">{toast.text}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer ml-1"
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
 *   toast('Gagal konek ke server', 'error')
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return { toast: ctx.addToast, dismiss: ctx.removeToast }
}
