'use client'

import { createPortal } from 'react-dom'
import { X, Sparkles, Zap, Wrench, Calendar, CheckCircle2 } from 'lucide-react'
import { CHANGELOG_HISTORY } from '@/lib/changelog'

export default function ChangelogModal({ isOpen, onClose }) {
  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-soft)] bg-black/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">Catatan Pembaruan Sistem</h3>
              <p className="text-[11px] text-[var(--text-3)]">Riwayat rilis & rincian perbaikan MyGameON Studio</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-4)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Changelog List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {CHANGELOG_HISTORY.map((entry, index) => (
            <div 
              key={entry.version}
              className={`rounded-2xl border p-5 transition-all ${
                index === 0 
                  ? 'border-purple-500/40 bg-purple-500/5 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
                  : 'border-[var(--border-soft)] bg-[var(--elevated)]/40'
              }`}
            >
              {/* Version & Date Bar */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold ${
                    index === 0 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-white/10 text-[var(--text-2)]'
                  }`}>
                    v{entry.version}
                  </span>
                  {index === 0 && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <CheckCircle2 size={10} /> Versi Saat Ini
                    </span>
                  )}
                  <h4 className="text-xs font-bold text-[var(--text)]">{entry.title}</h4>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-4)] font-mono">
                  <Calendar size={12} />
                  <span>{entry.date}</span>
                </div>
              </div>

              {/* Highlights List */}
              <div className="space-y-2 mt-3">
                {entry.highlights.map((item, hIdx) => {
                  const isFeature = item.type === 'feature'
                  const isFix = item.type === 'fix'
                  return (
                    <div key={hIdx} className="flex items-start gap-2.5 text-xs text-[var(--text-2)] leading-relaxed">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 mt-0.5 ${
                        isFeature 
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                          : isFix 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {item.tag}
                      </span>
                      <span>{item.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--border-soft)] bg-black/20 flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-4)] font-mono">
            MyGameON Studio Hub · Auto-Update Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
