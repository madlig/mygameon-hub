'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'

export default function RevokePage() {
  const [email, setEmail]         = useState('')
  const [accessList, setAccessList] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [message, setMessage]     = useState(null)
  const [hasScanned, setHasScanned] = useState(false)

  async function handleScan() {
    if (!email) return
    setIsScanning(true)
    setMessage(null)
    setAccessList([])

    try {
      const res = await fetch(`/api/revoke?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      setAccessList(data.accessList || [])
      setHasScanned(true)

      if ((data.accessList || []).length === 0) {
        setMessage({ type: 'success', text: '✅ Tidak ada akses aktif untuk email ini.' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '❌ Gagal scan. Coba lagi.' })
    } finally {
      setIsScanning(false)
    }
  }

  async function handleRevokeSingle(item) {
    setIsRevoking(true)
    try {
      const res = await fetch('/api/revoke', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: item.fileId,
          permissionId: item.permissionId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAccessList(prev => prev.filter(a => a.fileId !== item.fileId))
        setMessage({ type: 'success', text: `✅ Akses "${item.fileName}" berhasil dicabut.` })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '❌ Gagal mencabut akses.' })
    } finally {
      setIsRevoking(false)
    }
  }

  async function handleRevokeAll() {
    if (accessList.length === 0) return
    setIsRevoking(true)
    setMessage(null)

    try {
      const res = await fetch('/api/revoke', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeAll: true, accessList }),
      })
      const data = await res.json()
      const successCount = (data.results || []).filter(r => r.status === 'success').length
      setAccessList([])
      setMessage({ type: 'success', text: `✅ ${successCount} akses berhasil dicabut.` })
    } catch (e) {
      setMessage({ type: 'error', text: '❌ Gagal mencabut semua akses.' })
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <div>
      <TopBar title="Revoke akses" />

      {/* Input email */}
      <div className="flex gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleScan()}
          placeholder="Email customer..."
          className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
        <button
          onClick={handleScan}
          disabled={!email || isScanning}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {isScanning ? '...' : 'Scan'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-green-500/30 bg-green-500/10 text-green-500'
            : 'border-red-500/30 bg-red-500/10 text-red-500'
        }`}>
          {message.text}
        </div>
      )}

      {/* Hasil scan */}
      {accessList.length > 0 && (
        <>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
            {accessList.length} akses aktif ditemukan
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {accessList.map(item => (
              <div
                key={item.fileId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.fileName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">reader access</p>
                </div>
                <button
                  onClick={() => handleRevokeSingle(item)}
                  disabled={isRevoking}
                  className="shrink-0 rounded-lg border border-destructive px-3 py-1.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>

          {/* Revoke all bar */}
          <div className="fixed bottom-20 left-4 right-4 z-40 md:bottom-4 md:left-[var(--sb-w)] md:right-4">
            <div className="flex items-center justify-between rounded-xl border border-destructive bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive font-medium">
                Cabut semua {accessList.length} akses
              </p>
              <button
                onClick={handleRevokeAll}
                disabled={isRevoking}
                className="rounded-lg bg-destructive px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {isRevoking ? '...' : '⛔ Revoke All'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!hasScanned && !isScanning && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="text-3xl">⛔</span>
          <p className="text-sm font-medium text-muted-foreground">Cabut akses customer</p>
          <p className="text-xs text-muted-foreground">Masukkan email untuk scan semua aksesnya</p>
        </div>
      )}
    </div>
  )
}