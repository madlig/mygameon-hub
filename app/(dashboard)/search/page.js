'use client'

import { useState, useEffect, useRef } from 'react'
import TopBar from '@/components/layout/TopBar'
import GameItem from '@/components/shared/GameItem'

// ─── Expiry helpers (tidak berubah) ──────────────────────────────────
const EXPIRY_OPTIONS = [
  { label: 'Permanen',  value: null     },
  { label: '1 Hari',   value: 1        },
  { label: '1 Minggu', value: 7        },
  { label: '1 Bulan',  value: 30       },
  { label: '1 Tahun',  value: 365      },
  { label: 'Custom',   value: 'custom' },
]

function getExpirationTime(option, customDays) {
  if (!option) return null
  const days = option === 'custom' ? parseInt(customDays) : option
  if (!days || isNaN(days)) return null
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function getExpiryLabel(option, customDays) {
  if (!option) return 'Permanen'
  const days = option === 'custom' ? parseInt(customDays) : option
  if (!days || isNaN(days)) return 'Permanen'
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `Hingga ${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

const CART_KEY = 'mygameon_cart'

// ─── Desktop Cart Panel ───────────────────────────────────────────────
function CartPanel({
  cart, email, setEmail,
  expiryOption, setExpiryOption,
  customDays, setCustomDays,
  expiryLabel, sendReport, setSendReport,
  isSending, onSend, onClearCart, onRemoveFromCart,
}) {
  const [showExpiry, setShowExpiry] = useState(false)

  return (
    <div className="sticky top-4 flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-card p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Keranjang</p>
            {cart.length > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {cart.length}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={onClearCart}
              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Kosongkan
            </button>
          )}
        </div>

        {/* Empty state */}
        {cart.length === 0 && !sendReport && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="text-3xl">🛒</span>
            <p className="text-xs text-muted-foreground">Belum ada game dipilih</p>
            <p className="text-[10px] text-muted-foreground">Cari game lalu tekan + Keranjang</p>
          </div>
        )}

        {/* Send report */}
        {sendReport && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-foreground mb-2">📝 Laporan pengiriman:</p>
            <div className="flex flex-col gap-1">
              {sendReport.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {r.status === 'success' ? '✅' : '❌'} {r.name}
                  {r.message ? ` — ${r.message}` : ''}
                </p>
              ))}
            </div>
            <button
              onClick={() => setSendReport(null)}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Tutup laporan
            </button>
          </div>
        )}

        {/* Cart items */}
        {cart.length > 0 && (
          <>
            <div className="flex flex-col gap-2 mb-4">
              {cart.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {item.isShortcut ? 'shortcut' : 'file'}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveFromCart(item.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Expiry picker */}
            <div className="mb-3">
              <button
                onClick={() => setShowExpiry(p => !p)}
                className="flex items-center justify-between w-full text-left mb-2"
              >
                <span className="text-xs text-muted-foreground">
                  ⏱ Durasi: <span className="text-foreground font-medium">{expiryLabel}</span>
                </span>
                <span className="text-[10px] text-primary">
                  {showExpiry ? 'Tutup ▲' : 'Ubah ▼'}
                </span>
              </button>

              {showExpiry && (
                <div className="rounded-lg border border-border bg-secondary p-3">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {EXPIRY_OPTIONS.map(opt => (
                      <button
                        key={String(opt.value)}
                        onClick={() => {
                          setExpiryOption(opt.value)
                          if (opt.value !== 'custom') setCustomDays('')
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          expiryOption === opt.value
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border text-muted-foreground hover:bg-card'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {expiryOption === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={customDays}
                        onChange={e => setCustomDays(e.target.value)}
                        placeholder="Jumlah hari..."
                        min="1"
                        className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                      />
                      <span className="text-xs text-muted-foreground">hari</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Email input */}
            <div className="mb-3">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
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

            {/* Send button */}
            <button
              onClick={onSend}
              disabled={!email || isSending}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-opacity hover:opacity-90"
            >
              {isSending ? 'Mengirim...' : `Kirim ${cart.length} game →`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function SearchPage() {
  const [keyword, setKeyword]         = useState('')
  const [results, setResults]         = useState([])
  const [cart, setCart]               = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSending, setIsSending]     = useState(false)
  const [email, setEmail]             = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [sendReport, setSendReport]   = useState(null)
  const [expiryOption, setExpiryOption] = useState(null)
  const [customDays, setCustomDays]   = useState('')
  const [showExpiryPicker, setShowExpiryPicker] = useState(false)
  const debounceRef = useRef(null)

  // Load cart dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY)
      if (saved) setCart(JSON.parse(saved))
    } catch (e) {}
  }, [])

  // Simpan cart ke localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch (e) {}
  }, [cart])

  // Debounced search
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

  function clearCart() {
    setCart([])
    localStorage.removeItem(CART_KEY)
  }

  function isInCart(id) {
    return cart.some(c => c.id === id)
  }

  async function handleSend() {
    if (!email || cart.length === 0) return
    setIsSending(true)
    setSendReport(null)

    const expirationTime = getExpirationTime(expiryOption, customDays)

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cart, expirationTime }),
      })
      const data = await res.json()
      setSendReport(data.report || [])
      clearCart()
      setEmail('')
      setShowEmailInput(false)
      setExpiryOption(null)
      setCustomDays('')
    } catch (e) {
      console.error('Send error:', e)
    } finally {
      setIsSending(false)
    }
  }

  const expiryLabel = getExpiryLabel(expiryOption, customDays)

  return (
    <div>
      <TopBar title="Cari game" />

      {/*
        Layout:
        - Mobile  : satu kolom, cart bar fixed di bawah (existing behavior)
        - Desktop : dua kolom — search+hasil kiri, cart panel kanan (sticky)
      */}
      <div className="md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start">

        {/* ── Kolom kiri: search + hasil ── */}
        <div>
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

          {/* Status */}
          {isSearching && (
            <p className="text-xs text-muted-foreground mb-3">Mencari...</p>
          )}

          {/* Hasil */}
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

          {/* Send report — mobile only */}
          {sendReport && (
            <div className="mb-4 rounded-xl border border-border bg-card p-4 md:hidden">
              <p className="text-xs font-medium text-foreground mb-2">📝 Laporan pengiriman:</p>
              {sendReport.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {r.status === 'success' ? '✅' : '❌'} {r.name}
                  {r.message ? ` — ${r.message}` : ''}
                </p>
              ))}
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

          {keyword.length < 2 && cart.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="text-3xl">🔍</span>
              <p className="text-sm font-medium text-muted-foreground">Belum ada pencarian</p>
              <p className="text-xs text-muted-foreground">Ketik minimal 2 karakter untuk mulai</p>
            </div>
          )}
        </div>

        {/* ── Kolom kanan: cart panel — desktop only ── */}
        <div className="hidden md:block">
          <CartPanel
            cart={cart}
            email={email}
            setEmail={setEmail}
            expiryOption={expiryOption}
            setExpiryOption={setExpiryOption}
            customDays={customDays}
            setCustomDays={setCustomDays}
            expiryLabel={expiryLabel}
            sendReport={sendReport}
            setSendReport={setSendReport}
            isSending={isSending}
            onSend={handleSend}
            onClearCart={clearCart}
            onRemoveFromCart={removeFromCart}
          />
        </div>
      </div>

      {/* ── Mobile: cart bar fixed di bawah (existing behavior) ── */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 flex flex-col gap-2 md:hidden">

          {/* Expiry picker */}
          {showExpiryPicker && (
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Durasi akses
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {EXPIRY_OPTIONS.map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => {
                      setExpiryOption(opt.value)
                      if (opt.value !== 'custom') setCustomDays('')
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      expiryOption === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {expiryOption === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                    placeholder="Jumlah hari..."
                    min="1"
                    className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <span className="text-xs text-muted-foreground">hari</span>
                </div>
              )}
              {expiryOption && (
                <p className="text-[10px] text-primary mt-2">📅 {expiryLabel}</p>
              )}
            </div>
          )}

          {/* Email input */}
          {showEmailInput && (
            <div className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2">
              <button
                onClick={() => setShowExpiryPicker(prev => !prev)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-xs text-muted-foreground">
                  ⏱ Durasi akses: <span className="text-foreground font-medium">{expiryLabel}</span>
                </span>
                <span className="text-[10px] text-primary">
                  {showExpiryPicker ? 'Tutup ▲' : 'Ubah ▼'}
                </span>
              </button>
              <div className="flex gap-2">
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
            </div>
          )}

          {/* Cart summary bar */}
          <div className="flex items-center justify-between rounded-xl bg-primary px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary-foreground">
                {cart.length} game di keranjang
              </p>
              <p className="text-[10px] text-primary-foreground/70 truncate">
                {cart.map(c => c.name).join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={clearCart}
                className="text-[11px] text-primary-foreground/70 hover:text-primary-foreground"
              >
                Kosongkan
              </button>
              <button
                onClick={() => {
                  setShowEmailInput(prev => !prev)
                  setShowExpiryPicker(false)
                }}
                className="text-sm font-bold text-primary-foreground"
              >
                {showEmailInput ? 'Tutup' : 'Kirim →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
