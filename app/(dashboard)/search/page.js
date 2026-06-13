'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, ShoppingCart, CornerDownLeft, ListPlus, AlertCircle, Star, Package } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import GameItem from '@/components/shared/GameItem'
import QuickPick from '@/components/shared/QuickPick'
import CheckoutBody, { getExpiryLabel } from '@/components/shared/CheckoutBody'
import SendResult from '@/components/shared/SendResult'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { isValidEmail } from '@/lib/validators'
import { SK, loadJSON, saveJSON, uid, slimGame } from '@/lib/searchStore'

function getExpirationTime(option, customDays) {
  if (!option) return null
  const days = option === 'custom' ? parseInt(customDays) : option
  if (!days || isNaN(days)) return null
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex items-center justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3.5">
          <div className="flex-1">
            <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--elevated)]" />
            <div className="mt-2 h-2 w-16 animate-pulse rounded bg-[var(--elevated)]" />
          </div>
          <div className="h-7 w-20 animate-pulse rounded-xl bg-[var(--elevated)]" />
        </div>
      ))}
    </div>
  )
}

export default function SearchPage() {
  const [keyword, setKeyword]         = useState('')
  const [results, setResults]         = useState([])
  const [cart, setCart]               = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSending, setIsSending]     = useState(false)
  const [email, setEmail]             = useState('')
  const [sendReport, setSendReport]   = useState(null)
  const [sentTo, setSentTo]           = useState('')
  const [sendError, setSendError]     = useState(null)
  const [recentEmails, setRecentEmails] = useState([])
  const [recentGames, setRecentGames] = useState([])
  const [favs, setFavs]               = useState([])
  const [bundles, setBundles]         = useState([])
  const [expiryOption, setExpiryOption] = useState(null)
  const [customDays, setCustomDays]   = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [infoMap, setInfoMap]         = useState({})
  const [cartSheetOpen, setCartSheetOpen] = useState(false)
  const [isBonus, setIsBonus]         = useState(false)
  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)
  const abortRef = useRef(null)

  const emailValid = isValidEmail(email)

  // Load semua dari localStorage
  useEffect(() => {
    setCart(loadJSON(SK.cart))
    setRecentEmails(loadJSON(SK.emails))
    setRecentGames(loadJSON(SK.games))
    setFavs(loadJSON(SK.favs))
    setBundles(loadJSON(SK.bundles))
  }, [])

  useEffect(() => { saveJSON(SK.cart, cart) }, [cart])

  // Debounced search — tahan race
  useEffect(() => {
    if (keyword.trim().length < 2) {
      setResults([])
      setIsSearching(false)
      return
    }
    clearTimeout(debounceRef.current)
    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      const myId = ++reqIdRef.current
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`, { signal: ctrl.signal })
        const data = await res.json()
        if (myId !== reqIdRef.current) return
        setResults(data.results || [])
      } catch (e) {
        if (myId !== reqIdRef.current) return
        setResults([])
      } finally {
        if (myId === reqIdRef.current) setIsSearching(false)
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [keyword])

  useEffect(() => { setActiveIndex(-1) }, [results])

  // ── Cart ──
  function addToCart(item) {
    setCart(prev => (prev.some(c => c.id === item.id) ? prev : [...prev, slimGame(item)]))
  }
  function addManyToCart(items) {
    setCart(prev => {
      const ids = new Set(prev.map(c => c.id))
      const add = items.filter(it => !ids.has(it.id)).map(slimGame)
      return add.length ? [...prev, ...add] : prev
    })
  }
  function removeFromCart(itemId) {
    setCart(prev => prev.filter(c => c.id !== itemId))
  }
  function clearCart() {
    setCart([])
    saveJSON(SK.cart, [])
  }
  function isInCart(id) {
    return cart.some(c => c.id === id)
  }

  // ── Favorit ──
  function isFav(id) {
    return favs.some(f => f.id === id)
  }
  function toggleFav(item) {
    setFavs(prev => {
      const exists = prev.some(f => f.id === item.id)
      const next = exists ? prev.filter(f => f.id !== item.id) : [slimGame(item), ...prev].slice(0, 30)
      saveJSON(SK.favs, next)
      return next
    })
  }

  // ── Bundle ──
  function addBundleToCart(bundle) {
    addManyToCart(bundle.items || [])
  }
  function saveBundle(name) {
    const nm = (name || '').trim()
    if (!nm || cart.length === 0) return
    setBundles(prev => {
      const next = [{ id: uid(), name: nm, items: cart.map(slimGame) }, ...prev].slice(0, 20)
      saveJSON(SK.bundles, next)
      return next
    })
  }
  function deleteBundle(id) {
    setBundles(prev => {
      const next = prev.filter(b => b.id !== id)
      saveJSON(SK.bundles, next)
      return next
    })
  }

  // ── Preview ukuran (#5) ──
  async function handleInfo(item) {
    const cur = infoMap[item.id]
    if (cur?.loading || cur?.text) return
    setInfoMap(m => ({ ...m, [item.id]: { loading: true } }))
    try {
      const res = await fetch(`/api/check?id=${encodeURIComponent(item.id)}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setInfoMap(m => ({ ...m, [item.id]: { error: true } }))
        return
      }
      const sub = data.subfolders?.length || 0
      const text = `${data.root.count} file · ${data.root.size}${sub ? ` · ${sub} subfolder` : ''}`
      setInfoMap(m => ({ ...m, [item.id]: { text } }))
    } catch (e) {
      setInfoMap(m => ({ ...m, [item.id]: { error: true } }))
    }
  }

  // ── Keyboard nav (#4) ──
  function onSearchKeyDown(e) {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[activeIndex >= 0 ? activeIndex : 0]
      if (item) (isInCart(item.id) ? removeFromCart(item.id) : addToCart(item))
    }
  }

  function rememberEmail(value) {
    const v = (value || '').trim().toLowerCase()
    if (!v) return
    setRecentEmails(prev => {
      const next = [v, ...prev.filter(x => x !== v)].slice(0, 6)
      saveJSON(SK.emails, next)
      return next
    })
  }

  function rememberSentGames(items) {
    if (!items.length) return
    setRecentGames(prev => {
      const map = new Map()
      ;[...items, ...prev].forEach(g => { if (!map.has(g.id)) map.set(g.id, g) })
      const next = [...map.values()].slice(0, 10)
      saveJSON(SK.games, next)
      return next
    })
  }

  function requestSend() {
    setSendError(null)
    if (!emailValid || cart.length === 0) return
    setConfirmOpen(true)
  }

  async function doSend() {
    setConfirmOpen(false)
    setIsSending(true)
    setSendReport(null)
    setSendError(null)
    const currentEmail = email
    const expirationTime = getExpirationTime(expiryOption, customDays)

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, cart, expirationTime, isBonus }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error || `Gagal mengirim (${res.status})`)
        return
      }
      const report = data.report || []
      setSentTo(currentEmail)
      setSendReport(report)
      rememberEmail(currentEmail)
      setIsBonus(false)

      const successNames = new Set(report.filter(r => r.status === 'success').map(r => r.name))
      const sentItems = cart.filter(c => successNames.has(c.name)).map(slimGame)
      rememberSentGames(sentItems)

      // Sisakan game yang gagal untuk dikirim ulang.
      const remaining = cart.filter(c => !successNames.has(c.name))
      setCart(remaining)
      setCartSheetOpen(false)

      if (remaining.length === 0) {
        setEmail('')
        setExpiryOption(null)
        setCustomDays('')
      }
    } catch (e) {
      setSendError('Gagal terhubung ke server. Coba lagi.')
    } finally {
      setIsSending(false)
    }
  }

  const expiryLabel = getExpiryLabel(expiryOption, customDays)

  const checkoutProps = {
    cart, onRemove: removeFromCart, onSaveBundle: saveBundle,
    email, setEmail, emailValid, recentEmails,
    expiryOption, setExpiryOption, customDays, setCustomDays,
    isBonus, setIsBonus,
    sendError, isSending, onSend: requestSend,
  }

  return (
    <div className="fadeUp">
      <TopBar title="Cari game" />

      <datalist id="recent-emails">
        {recentEmails.map(e => <option key={e} value={e} />)}
      </datalist>

      {/* Hero */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">Pengiriman game</p>
          <h2 className="font-display mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--text)] md:text-[28px]">
            Cari &amp; kirim <span className="gradient-text">game</span>
          </h2>
        </div>
        <div className="flex gap-2">
          {[
            { icon: ShoppingCart, label: 'Keranjang', value: cart.length, accent: '#ffd100' },
            { icon: Star, label: 'Favorit', value: favs.length, accent: '#ffd100' },
            { icon: Package, label: 'Paket', value: bundles.length, accent: '#a78bfa' },
          ].map(s => {
            const Ic = s.icon
            return (
              <div key={s.label} className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${s.accent}1f`, color: s.accent }}><Ic size={14} /></span>
                <div className="leading-tight">
                  <p className="font-display text-base font-extrabold text-[var(--text)]">{s.value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-3)]">{s.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start">
        {/* ── Kolom kiri ── */}
        <div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input
              type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Ketik nama game..."
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-2.5 pl-11 pr-10 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
            />
            {keyword && (
              <button onClick={() => setKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] transition-colors hover:text-[var(--text)]" title="Bersihkan">
                <X size={15} />
              </button>
            )}
          </div>

          {/* Hasil kirim — mobile */}
          {sendReport && (
            <div className="mb-4 md:hidden">
              <SendResult report={sendReport} email={sentTo} onClose={() => setSendReport(null)} onReset={() => { setSendReport(null); setKeyword('') }} />
            </div>
          )}

          {/* Loading */}
          {isSearching && <ResultSkeleton />}

          {/* Hasil pencarian */}
          {!isSearching && keyword.length >= 2 && (
            results.length > 0 ? (
              <div className="mb-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">{results.length} hasil</p>
                  <div className="flex items-center gap-2">
                    <p className="hidden items-center gap-1 text-[10px] text-[var(--text-3)] md:flex">
                      <kbd className="rounded border border-[var(--border-soft)] bg-[var(--elevated)] px-1">↑↓</kbd> pilih
                      <kbd className="ml-1 flex items-center rounded border border-[var(--border-soft)] bg-[var(--elevated)] px-1"><CornerDownLeft size={9} /></kbd> tambah
                    </p>
                    <button
                      onClick={() => addManyToCart(results)}
                      className="pressable flex items-center gap-1 rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    >
                      <ListPlus size={13} /> Tambah semua
                    </button>
                  </div>
                </div>
                <div className="stagger grid grid-cols-1 gap-2 xl:grid-cols-2">
                  {results.map((item, index) => {
                    const info = infoMap[item.id]
                    return (
                      <GameItem
                        key={item.id} name={item.name}
                        meta={item.isShortcut ? 'shortcut' : 'file'}
                        inCart={isInCart(item.id)}
                        active={index === activeIndex}
                        info={info?.text} infoLoading={info?.loading} infoError={info?.error}
                        onInfo={() => handleInfo(item)}
                        isFav={isFav(item.id)} onToggleFav={() => toggleFav(item)}
                        onAdd={() => addToCart(item)}
                        onRemove={() => removeFromCart(item.id)}
                      />
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="text-3xl">🎮</span>
                <p className="text-sm font-semibold text-[var(--text-2)]">Game tidak ditemukan</p>
                <p className="text-xs text-[var(--text-3)]">Coba kata kunci yang berbeda</p>
              </div>
            )
          )}

          {/* Akses cepat — saat belum mengetik */}
          {!isSearching && keyword.length < 2 && (
            <QuickPick
              favorites={favs} recentGames={recentGames} bundles={bundles}
              isInCart={isInCart} onAdd={addToCart} onAddBundle={addBundleToCart}
              onToggleFav={toggleFav} onDeleteBundle={deleteBundle}
            />
          )}
        </div>

        {/* ── Kolom kanan: checkout — desktop ── */}
        <div className="hidden md:block">
          <div className="sticky top-4 flex flex-col gap-3">
            {sendReport && (
              <SendResult report={sendReport} email={sentTo} onClose={() => setSendReport(null)} onReset={() => { setSendReport(null); setKeyword('') }} />
            )}
            <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]"><ShoppingCart size={15} /></span>
                  <p className="font-display text-sm font-bold text-[var(--text)]">Keranjang</p>
                  {cart.length > 0 && <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--primary-fg)]">{cart.length}</span>}
                </div>
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-[11px] font-medium text-[var(--text-3)] transition-colors hover:text-[var(--danger)]">Kosongkan</button>
                )}
              </div>
              <CheckoutBody {...checkoutProps} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: bar keranjang ── */}
      {cart.length > 0 && !cartSheetOpen && (
        <button
          onClick={() => setCartSheetOpen(true)}
          className="pressable fixed left-4 right-4 z-40 flex items-center justify-between rounded-2xl bg-[var(--primary)] px-4 py-3 shadow-[0_10px_30px_-12px_rgba(255,209,0,0.6)] md:hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 12px) + 4.5rem)' }}
        >
          <span className="flex items-center gap-2 text-sm font-extrabold text-[var(--primary-fg)]">
            <ShoppingCart size={16} /> {cart.length} game di keranjang
          </span>
          <span className="rounded-lg bg-[var(--primary-fg)]/10 px-3 py-1 text-sm font-extrabold text-[var(--primary-fg)]">Lihat & kirim →</span>
        </button>
      )}

      {/* ── Mobile: sheet checkout ── */}
      {cartSheetOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="animate-overlay absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCartSheetOpen(false)} />
          <div className="animate-sheet absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-[var(--border-strong)] bg-[var(--surface)]">
            <div className="shrink-0 px-5 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]"><ShoppingCart size={15} /></span>
                  <p className="font-display text-base font-bold text-[var(--text)]">Keranjang</p>
                  {cart.length > 0 && <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--primary-fg)]">{cart.length}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {cart.length > 0 && <button onClick={clearCart} className="text-[11px] font-medium text-[var(--text-3)] hover:text-[var(--danger)]">Kosongkan</button>}
                  <button onClick={() => setCartSheetOpen(false)} className="text-[var(--text-3)] hover:text-[var(--text)]" aria-label="Tutup"><X size={18} /></button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CheckoutBody {...checkoutProps} hideSubmit />
            </div>
            <div className="shrink-0 border-t border-[var(--border-soft)] px-4 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 0.75rem)' }}>
              <button
                onClick={requestSend}
                disabled={!emailValid || isSending}
                className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] transition-all hover:brightness-105 hover:shadow-[0_10px_28px_-10px_rgba(255,209,0,0.6)] disabled:opacity-50 disabled:hover:shadow-none"
              >
                {isSending ? 'Mengirim…' : <>Kirim {cart.length} game <span aria-hidden>→</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        tone="primary"
        title="Kirim akses game?"
        description={`${cart.length} game akan dibagikan ke ${email} dan email pengiriman dikirim otomatis. Durasi: ${expiryLabel}.${isBonus ? ' Mode BONUS — tidak dihitung sebagai order/game baru di dashboard.' : ''} Pastikan email sudah benar — aksi ini tidak bisa dibatalkan.`}
        confirmLabel={`Ya, kirim ${cart.length} game`}
        onConfirm={doSend}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}
