'use client'

import { useState, useEffect, useRef } from 'react'
import TopBar from '@/components/layout/TopBar'
import GameItem from '@/components/shared/GameItem'

export default function SearchPage() {
  const [keyword, setKeyword]     = useState('')
  const [results, setResults]     = useState([])
  const [cart, setCart]           = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [email, setEmail]         = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [sendReport, setSendReport] = useState(null)
  const debounceRef = useRef(null)

  // Debounced search — tunggu 400ms setelah user berhenti mengetik
  useEffect(() => {
    if (keyword.trim().length < 2) {
      setResults([])
      return
    }

    clearTimeout(debounceRef.current)
    setIsSearching(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`)
        const data = await res.json()
        setResults(data.results || [])
      } catch (e) {
        console.error('Search error:', e)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => clearTimeout(debounceRef.current)
  }, [keyword])

  function addToCart(item) {
    if (cart.find(c => c.id === item.id)) return
    setCart(prev => [...prev, item])
  }

  function removeFromCart(itemId) {
    setCart(prev => prev.filter(c => c.id !== itemId))
  }

  function isInCart(id) {
    return cart.some(c => c.id === id)
  }

  async function handleSend() {
    if (!email || cart.length === 0) return
    setIsSending(true)
    setSendReport(null)

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cart }),
      })
      const data = await res.json()
      setSendReport(data.report || [])
      // Reset cart dan email setelah sukses
      setCart([])
      setEmail('')
      setShowEmailInput(false)
    } catch (e) {
      console.error('Send error:', e)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div>
      <TopBar title="Cari game" />

      {/* Search input */}
      <div className="relative mb-4">
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="Ketik nama game..."
          className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          🔍
        </span>
      </div>

      {/* Status pencarian */}
      {isSearching && (
        <p className="text-xs text-muted-foreground mb-3">Mencari...</p>
      )}

      {/* Hasil pencarian */}
      {!isSearching && results.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
            {results.length} hasil ditemukan
          </p>
          <div className="flex flex-col gap-2">
            {results.map(item => (
              <GameItem
                key={item.id}
                name={item.name}
                meta={item.isShortcut ? 'shortcut' : 'file'}
                inCart={isInCart(item.id)}
                onAdd={() => addToCart(item)}
                onRemove={() => removeFromCart(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty states */}
      {!isSearching && keyword.length >= 2 && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="text-3xl">🎮</span>
          <p className="text-sm font-medium text-muted-foreground">Game tidak ditemukan</p>
          <p className="text-xs text-muted-foreground">Coba kata kunci yang berbeda</p>
        </div>
      )}

      {keyword.length < 2 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="text-3xl">🔍</span>
          <p className="text-sm font-medium text-muted-foreground">Belum ada pencarian</p>
          <p className="text-xs text-muted-foreground">Ketik minimal 2 karakter untuk mulai</p>
        </div>
      )}

      {/* Send report */}
      {sendReport && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-foreground mb-2">📝 Laporan pengiriman:</p>
          {sendReport.map((r, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {r.status === 'success' ? '✅' : '❌'} {r.name}
              {r.message ? ` — ${r.message}` : ''}
            </p>
          ))}
        </div>
      )}

      {/* Cart bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 md:bottom-4 md:left-64 md:right-4">

          {/* Email input — muncul saat tombol kirim ditekan */}
          {showEmailInput && (
            <div className="bg-card border border-border rounded-xl p-3 mb-2 flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email pembeli..."
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
              <button
                onClick={handleSend}
                disabled={!email || isSending}
                className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {isSending ? '...' : 'Kirim'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-primary px-4 py-3">
            <div>
              <p className="text-sm font-bold text-primary-foreground">
                {cart.length} game di keranjang
              </p>
              <p className="text-[10px] text-primary-foreground/70 truncate max-w-[200px]">
                {cart.map(c => c.name).join(', ')}
              </p>
            </div>
            <button
              onClick={() => setShowEmailInput(prev => !prev)}
              className="text-sm font-bold text-primary-foreground"
            >
              {showEmailInput ? 'Tutup' : 'Kirim →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}