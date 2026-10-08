'use client'

import { useState, useEffect } from 'react'
import {
  Smartphone, X, Copy, Check, QrCode, ShieldCheck,
  RefreshCw, Loader2, Globe, Radio, ExternalLink, Info, CheckCircle2,
  Sparkles, KeyRound
} from 'lucide-react'

export default function MobileConnectModal({ isOpen, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tunnelStarting, setTunnelStarting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedPin, setCopiedPin] = useState(false)
  const [showDomainInfo, setShowDomainInfo] = useState(false)

  const fetchNetworkInfo = async () => {
    try {
      const res = await fetch('/api/system/network-info')
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Failed to get network info:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetchNetworkInfo()
  }, [isOpen])

  // Handler restart / reconnect tunnel
  const handleToggleTunnel = async (action = 'start') => {
    setTunnelStarting(true)
    try {
      const res = await fetch('/api/system/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.success) {
        await fetchNetworkInfo()
      }
    } catch (err) {
      console.error('Failed to toggle tunnel:', err)
    } finally {
      setTunnelStarting(false)
    }
  }

  if (!isOpen) return null

  const remoteAvailable = !!data?.remoteUrl && data?.tunnelActive
  const currentUrl = data?.remoteUrl || ''
  const qrTarget = data?.quickLoginUrlRemote || currentUrl || 'http://localhost:3000'
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrTarget)}&bgcolor=0a0b0f&color=f59e0b&margin=1`

  function handleCopyUrl() {
    if (currentUrl) {
      navigator.clipboard.writeText(currentUrl)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[var(--surface)] p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/10 text-amber-400 border border-amber-500/40 shadow-md shadow-amber-500/10">
              <Globe size={20} />
            </span>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>Akses Remote HP (Cloudflare HTTPS)</span>
                {remoteAvailable ? (
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Remote Aktif
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                    Menghubungkan
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                Kendalikan studio dari iPhone 13 / Android via internet (4G/5G / di luar rumah)
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

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 text-[var(--text-3)]">
            <Loader2 size={26} className="animate-spin text-amber-400" />
            <span className="text-xs">Mendeteksi status tunnel remote...</span>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* JIKA TUNNEL BELUM AKTIF */}
            {!remoteAvailable && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs">
                  <Radio size={16} className="animate-pulse" />
                  <span>Remote Tunnel Cloudflare Belum Aktif</span>
                </div>
                <p className="text-[11px] text-[var(--text-3)] leading-relaxed max-w-sm mx-auto">
                  Tekan tombol di bawah untuk mengaktifkan koneksi HTTPS publik otomatis agar aplikasi dapat diakses langsung dari HP.
                </p>
                <button
                  type="button"
                  onClick={() => handleToggleTunnel('start')}
                  disabled={tunnelStarting}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-xs font-black shadow-lg shadow-amber-500/20 inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {tunnelStarting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Menghubungkan ke Cloudflare...</span>
                    </>
                  ) : (
                    <>
                      <Globe size={14} />
                      <span>Aktifkan Akses Remote</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* QR Code Container */}
            {remoteAvailable && (
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
                <div className="p-3 bg-[#0a0b0f] rounded-2xl border border-amber-500/30 shadow-xl">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code Akses HP"
                    className="w-48 h-48 rounded-xl object-contain"
                  />
                </div>
                <div className="text-center space-y-0.5">
                  <span className="text-xs font-black text-white flex items-center justify-center gap-1.5">
                    <QrCode size={13} className="text-amber-400" />
                    <span>Scan QR Code dari Kamera iPhone 13</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-3)] block">
                    Otomatis membuka domain HTTPS aman &amp; login Admin secara instan
                  </span>
                </div>
              </div>
            )}

            {/* URL Input Box */}
            {remoteAvailable && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-4)] uppercase font-bold">
                  <span className="flex items-center gap-1.5">
                    <Globe size={13} className="text-emerald-400" />
                    <span>Alamat Domain HTTPS Remote:</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {data?.isCustomDomain ? (
                      <span className="text-[10px] text-amber-400/90 font-mono font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                        <Sparkles size={11} />
                        <span>Permanen</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleTunnel('start')}
                        disabled={tunnelStarting}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                        title="Generate URL baru jika diperlukan"
                      >
                        <RefreshCw size={10} className={tunnelStarting ? 'animate-spin' : ''} />
                        <span>Ganti URL</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="text-amber-300 hover:text-white flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      <span>{copied ? 'Tersalin!' : 'Salin URL'}</span>
                    </button>
                  </div>
                </div>
                <div className="font-mono text-xs text-amber-300 font-bold bg-black/60 px-3 py-2 rounded-xl border border-white/10 select-all break-all">
                  {currentUrl}
                </div>
              </div>
            )}

            {/* Kredensial Admin Mobile (Email + PIN) */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white block text-[11px]">Email Admin:</span>
                    <span className="text-[11px] font-mono text-emerald-300 font-bold">{data?.adminEmail || 'admin@mygameon.store'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white block text-[11px]">PIN Admin:</span>
                    <span className="text-[11px] font-mono text-amber-300 font-bold">{data?.pin}</span>
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
            </div>

            {/* Penjelasan Custom Domain */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowDomainInfo(!showDomainInfo)}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>
                    {data?.isCustomDomain
                      ? 'Domain Permanen Terhubung (hub.mygameon.store)'
                      : 'Apakah nama domain remote bisa diubah?'}
                  </span>
                </div>
                <span className="text-[10px] text-amber-400 font-bold hover:underline">
                  {showDomainInfo ? 'Sembunyikan' : (data?.isCustomDomain ? 'Detail Status' : 'Pelajari Cara Ubah')}
                </span>
              </div>
              {showDomainInfo && (
                <div className="text-[11px] text-[var(--text-3)] space-y-2 pt-1 border-t border-white/5 leading-relaxed">
                  {data?.isCustomDomain ? (
                    <div className="space-y-1.5 text-[11px] text-zinc-300">
                      <p className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        <span>Domain Cloudflare Zero Trust Aktif!</span>
                      </p>
                      <p>
                        Aplikasi telah terkunci permanen ke <code>https://hub.mygameon.store</code>. Alamat ini tidak akan berubah meskipun PC Anda direstart.
                      </p>
                      <p className="text-zinc-400 text-[10px]">
                        Anda cukup menyimpan alamat ini di Layar Utama (Home Screen) iPhone 13 Anda satu kali saja untuk seterusnya.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p>
                        Saat ini aplikasi menggunakan <b>Cloudflare Quick Tunnel</b> (gratis, tanpa akun), sehingga nama subdomain dihasilkan otomatis dan acak (contoh: <code>xxx.trycloudflare.com</code>).
                      </p>
                      <p>
                        <b>Jika ingin nama domain rapi &amp; tetap permanen (misal: <code>hub.mygameon.store</code>):</b>
                      </p>
                      <ol className="list-decimal pl-4 space-y-1 text-[10px] text-zinc-300">
                        <li>Hubungkan domain ke <b>Cloudflare Zero Trust</b>.</li>
                        <li>Tambahkan Published Application route ke <code>localhost:3000</code>.</li>
                        <li>Masukkan <code>CLOUDFLARE_TUNNEL_DOMAIN=hub.mygameon.store</code> ke <code>.env.local</code>.</li>
                      </ol>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Petunjuk iPhone 13 PWA */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-3 space-y-1.5 text-[11px] text-blue-200/90">
              <div className="flex items-center gap-1.5 font-bold text-blue-300 text-xs">
                <Info size={14} className="shrink-0" />
                <span>Tips Penggunaan iPhone 13:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[10px] leading-relaxed text-blue-200/80">
                <li>Bisa diakses dari mana saja menggunakan <b>kuota data seluler 4G/5G</b> tanpa perlu satu Wi-Fi dengan PC.</li>
                <li><b>Jadikan Aplikasi Layar Utama:</b> Di Safari, ketuk tombol <i>Share</i> (kotak panah ke atas) &rarr; pilih <b>&quot;Add to Home Screen&quot;</b> agar tampilan menjadi fullscreen seperti aplikasi iOS native.</li>
              </ul>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 size={11} /> Sesi 30 hari aman di iPhone
          </div>
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
