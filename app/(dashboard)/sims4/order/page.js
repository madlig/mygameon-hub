'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'

export default function Sims4OrderPage() {
  const [email, setEmail]     = useState('')
  const [invoice, setInvoice] = useState('')
  const [allowCC, setAllowCC] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult]   = useState(null)

  async function handleSubmit() {
    if (!email || !invoice) return
    setIsLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/sims4/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, invoice, allowCC }),
      })
      const data = await res.json()

      if (data.success) {
        setResult({ type: 'success', text: '✅ Order berhasil! Akses dan email telah dikirim.' })
        setEmail('')
        setInvoice('')
        setAllowCC(false)
      } else {
        setResult({ type: 'error', text: `❌ Gagal: ${data.error}` })
      }
    } catch (e) {
      setResult({ type: 'error', text: '❌ Terjadi kesalahan. Coba lagi.' })
    } finally {
      setIsLoading(false)
    }
  }

  const isReady = email && invoice

  return (
    <div>
      <TopBar title="Order Sims 4" />

      {/* Result message */}
      {result && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          result.type === 'success'
            ? 'border-green-500/30 bg-green-500/10 text-green-500'
            : 'border-red-500/30 bg-red-500/10 text-red-500'
        }`}>
          {result.text}
        </div>
      )}

      {/* Form */}
      <div className="flex flex-col gap-3 mb-6">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
            Email pembeli
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="customer@gmail.com"
            className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
            Kode pesanan Shopee
          </label>
          <input
            type="text"
            value={invoice}
            onChange={e => setInvoice(e.target.value)}
            placeholder="2501XXXXXXXXX"
            className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Tier selection */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
            Pilih paket
          </label>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setAllowCC(false)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                !allowCC
                  ? 'border-primary bg-secondary'
                  : 'border-border bg-card hover:bg-secondary'
              }`}
            >
              <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                !allowCC ? 'border-primary' : 'border-border'
              }`}>
                {!allowCC && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Standard</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Game Only — The Sims 4 base game tanpa mod & CC
                </p>
              </div>
            </button>

            <button
              onClick={() => setAllowCC(true)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                allowCC
                  ? 'border-primary bg-secondary'
                  : 'border-border bg-card hover:bg-secondary'
              }`}
            >
              <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                allowCC ? 'border-primary' : 'border-border'
              }`}>
                {allowCC && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Premium</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Game + Mods & CC — Akses penuh termasuk custom content
                </p>
                {allowCC && (
                  <p className="text-xs text-primary mt-1 font-medium">✓ CC Flag aktif</p>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Ringkasan konfirmasi */}
      {isReady && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Ringkasan order
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Email</span>
              <span className="text-foreground font-medium truncate max-w-[200px]">{email}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Invoice / License key</span>
              <span className="text-info font-mono">{invoice}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Paket</span>
              <span className={`font-medium ${allowCC ? 'text-purple-400' : 'text-muted-foreground'}`}>
                {allowCC ? 'Premium CC' : 'Standard'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Aksi</span>
              <span className="text-foreground">Share Drive + Catat DB + Kirim email</span>
            </div>
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!isReady || isLoading}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-opacity hover:opacity-90"
      >
        {isLoading ? 'Memproses...' : 'Kirim akses & email →'}
      </button>
    </div>
  )
}