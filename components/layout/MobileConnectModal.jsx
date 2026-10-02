'use client'

import { useState, useEffect } from 'react'
import {
  Smartphone, X, Copy, Check, QrCode, Wifi, ShieldCheck,
  RefreshCw, Loader2, ExternalLink, Info
} from 'lucide-react'

export default function MobileConnectModal({ isOpen, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copiedPin, setCopiedPin] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/system/network-info')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setData(json.data)
        }
      })
      .catch((err) => console.error('Failed to get network info:', err))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const targetUrl = data?.quickLoginUrl || data?.mobileUrl || 'http://localhost:3000'
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}&bgcolor=0a0b0f&color=f59e0b&margin=1`

  function handleCopyUrl() {
    if (data?.mobileUrl) {
      navigator.clipboard.writeText(data.mobileUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleCopyPin() {
    if (data?.pin) {
      navigator.clipboard.writeText(data.pin)
      setCopiedPin(true)
      setTimeout(() => setCopiedPin(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/40 bg-[var(--surface)] p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Smartphone size={18} />
            </span>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>Hubungkan HP / Akses Mobile</span>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">
                  Online
                </span>
              </h2>
              <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                Monitoring &amp; kendalikan studio game langsung dari browser HP Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-4)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 text-[var(--text-3)]">
            <Loader2 size={24} className="animate-spin text-amber-400" />
            <span className="text-xs">Mendeteksi alamat IP PC...</span>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-black/50 border border-white/10 space-y-3">
              <div className="p-2 bg-[#0a0b0f] rounded-xl border border-amber-500/30 shadow-lg">
                <img
                  src={qrCodeUrl}
                  alt="QR Code Akses HP"
                  className="w-44 h-44 rounded-lg object-contain"
                />
              </div>
              <div className="text-center space-y-0.5">
                <span className="text-xs font-bold text-white block">
                  Scan QR Code dengan Kamera HP
                </span>
                <span className="text-[10px] text-[var(--text-3)] block">
                  Otomatis membuka web &amp; login sebagai Admin tanpa ketik password
                </span>
              </div>
            </div>

            {/* URL Input Box */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-4)] uppercase font-bold">
                <span className="flex items-center gap-1">
                  <Wifi size={12} className="text-amber-400" />
                  <span>Alamat Browser HP (LAN/Wi-Fi):</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="text-amber-300 hover:text-white flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 transition-colors cursor-pointer"
                >
                  {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  <span>{copied ? 'Tersalin!' : 'Salin URL'}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-amber-300 font-bold bg-black/60 px-3 py-2 rounded-lg border border-white/10 select-all break-all">
                {data?.mobileUrl || 'http://localhost:3000'}
              </div>
            </div>

            {/* Admin PIN */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white block text-xs">PIN Admin Mobile:</span>
                  <span className="text-[10px] font-mono text-emerald-300 font-bold">{data?.pin}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyPin}
                className="text-[10px] font-mono text-[var(--text-3)] hover:text-white flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 transition-colors cursor-pointer"
              >
                {copiedPin ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>{copiedPin ? 'Tersalin' : 'Salin PIN'}</span>
              </button>
            </div>

            {/* Syarat & Panduan */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-3 space-y-1.5 text-[11px] text-blue-200/90">
              <div className="flex items-center gap-1.5 font-bold text-blue-300 text-xs">
                <Info size={14} className="shrink-0" />
                <span>Petunjuk Penggunaan:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[10px] leading-relaxed text-blue-200/80">
                <li>Pastikan HP dan PC Anda terhubung ke <b>jaringan Wi-Fi / Router yang sama</b>.</li>
                <li>Buka aplikasi browser di HP (Chrome / Safari), lalu scan QR atau ketik URL di atas.</li>
                <li><b>Tips PWA:</b> Ketuk tombol menu browser HP lalu pilih <b>&quot;Tambahkan ke Layar Utama&quot;</b> agar tampilan menyerupai aplikasi HP asli.</li>
              </ul>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  )
}
