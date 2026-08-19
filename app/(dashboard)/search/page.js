'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, ShoppingCart, CornerDownLeft, ListPlus, AlertCircle, Star, Package, Copy, Trash2, Loader2, Database, Box, Gamepad2, HardDrive, Check, Plus } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import GameItem from '@/components/shared/GameItem'
import QuickPick from '@/components/shared/QuickPick'
import CheckoutBody, { getExpiryLabel } from '@/components/shared/CheckoutBody'
import SendResult from '@/components/shared/SendResult'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { isValidEmail } from '@/lib/validators'
import { SK, loadJSON, saveJSON, uid, slimGame } from '@/lib/searchStore'
import { AppButton } from '@/components/shared/design-system'

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
      {[0, 1, 2, 3, 4, 5].map(i => (
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
  const [isSearching, setIsSearching] = useState(true) // default true for initial load
  const [page, setPage]               = useState(1)
  const [hasMore, setHasMore]         = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
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
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, item: null, info: null, loading: false, error: null })
  const [cartSheetOpen, setCartSheetOpen] = useState(false)
  const [isBonus, setIsBonus]         = useState(false)
  const [mounted, setMounted]         = useState(false)
  
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null, isDeleting: false })
  const [backupModal, setBackupModal] = useState({ isOpen: false, item: null, targetEmail: '', accounts: [], isLoading: false, progressText: '', progressValue: 0, isCopying: false })
  const [moveModal, setMoveModal] = useState({ isOpen: false, item: null, targetEmail: '', accounts: [], isLoading: false, isMoving: false })

  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)
  const abortRef = useRef(null)
  const observerRef = useRef(null)
  const loadMoreRef = useRef(null)

  const emailValid = isValidEmail(email)

  useEffect(() => {
    setMounted(true)
    setCart(loadJSON(SK.cart))
    
    // Fallback load lokal biar instan
    setRecentEmails(loadJSON(SK.emails))
    setRecentGames(loadJSON(SK.games))
    setFavs(loadJSON(SK.favs))
    setBundles(loadJSON(SK.bundles))

    // Timpa dengan data dari database (tersinkron antar perangkat)
    fetch('/api/preferences')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          if (data.recentEmails) { setRecentEmails(data.recentEmails); saveJSON(SK.emails, data.recentEmails) }
          if (data.recentGames) { setRecentGames(data.recentGames); saveJSON(SK.games, data.recentGames) }
          if (data.favGames) { setFavs(data.favGames); saveJSON(SK.favs, data.favGames) }
          if (data.bundles) { setBundles(data.bundles); saveJSON(SK.bundles, data.bundles) }
        }
      })
      .catch(console.error)
  }, [])

  async function syncPreferences(data) {
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
    } catch (e) { console.error('Failed to sync preferences:', e) }
  }

  useEffect(() => { saveJSON(SK.cart, cart) }, [cart])

  const fetchData = async (p, kw) => {
    const myId = ++reqIdRef.current
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(kw)}&page=${p}&limit=30`, { signal: ctrl.signal })
      const data = await res.json()
      if (myId !== reqIdRef.current) return
      
      if (p === 1) {
        setResults(data.results || [])
      } else {
        setResults(prev => [...prev, ...(data.results || [])])
      }
      setHasMore(data.hasMore)
    } catch (e) {
      if (myId !== reqIdRef.current) return
      if (p === 1) setResults([])
    } finally {
      if (myId === reqIdRef.current) {
        setIsSearching(false)
        setIsLoadingMore(false)
      }
    }
  }

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    setIsSearching(true)
    setPage(1)
    debounceRef.current = setTimeout(() => {
      fetchData(1, keyword)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [keyword])

  // Infinite scroll (Intersection Observer)
  useEffect(() => {
    if (isLoadingMore || !hasMore || isSearching) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoadingMore(true)
          setPage(p => {
            const next = p + 1
            fetchData(next, keyword)
            return next
          })
        }
      },
      { rootMargin: '100px' }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current)
    }
  }, [hasMore, isSearching, isLoadingMore, keyword])

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
      syncPreferences({ favGames: next })
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
      syncPreferences({ bundles: next })
      return next
    })
  }
  function deleteBundle(id) {
    setBundles(prev => {
      const next = prev.filter(b => b.id !== id)
      saveJSON(SK.bundles, next)
      syncPreferences({ bundles: next })
      return next
    })
  }

  // ── Preview ukuran (Deprecated) ──
  // Hapus handleInfo karena ukuran diambil instan dari DB

  // ── Action Buttons (Backup & Delete) ──
  async function handleDeleteConfirm() {
    const { item } = deleteModal
    if (!item) return
    setDeleteModal(prev => ({ ...prev, isDeleting: true }))
    
    // Hapus satu per satu dari setiap sumber
    for (const source of item.sources) {
        await fetch('/api/catalog/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: source.folderId, ownerEmail: source.ownerEmail })
        })
    }
    
    // Hapus dari UI
    setResults(prev => prev.filter(r => r.id !== item.id))
    removeFromCart(item.id)
    setDeleteModal({ isOpen: false, item: null, isDeleting: false })
  }

  async function openBackupModal(item) {
    setBackupModal({ isOpen: true, item, targetEmail: '', accounts: [], isLoading: true, progressText: '', progressValue: 0, isCopying: false })
    try {
        const res = await fetch('/api/drive/status')
        const data = await res.json()
        if (data.workspaces) {
            const sorted = data.workspaces.sort((a, b) => {
                const percA = a.storage?.percentage ?? 100
                const percB = b.storage?.percentage ?? 100
                return percA - percB
            })
            const existingEmails = new Set(item.sources?.map(s => s.ownerEmail) || [])
            const available = sorted.filter(a => !existingEmails.has(a.email) && a.status !== 'limit')
            
            setBackupModal(prev => ({ ...prev, accounts: available, targetEmail: available[0]?.email || '', isLoading: false }))
        } else {
             setBackupModal(prev => ({ ...prev, isLoading: false }))
        }
    } catch (e) {
        console.error(e)
        setBackupModal(prev => ({ ...prev, isLoading: false }))
    }
  }

  async function handleBackupStart() {
    const { item, targetEmail } = backupModal
    if (!item || !targetEmail) return
    setBackupModal(prev => ({ ...prev, isCopying: true, progressText: 'Memulai koneksi...', progressValue: 0 }))
    
    try {
        const source = item.sources[0] // Ambil sumber pertama
        const res = await fetch('/api/catalog/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceFolderId: source.folderId,
                sourceOwnerEmail: source.ownerEmail,
                targetEmail,
                gameName: item.name
            })
        })
        
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        
        while (true) {
            const { value, done } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(l => l.trim())
            for (const line of lines) {
                try {
                    const data = JSON.parse(line)
                    if (data.status === 'progress') {
                        const pct = Math.round((data.copied / data.total) * 100)
                        setBackupModal(prev => ({ ...prev, progressText: data.text, progressValue: pct }))
                    } else if (data.status === 'info' || data.status === 'success') {
                        setBackupModal(prev => ({ ...prev, progressText: data.text }))
                    } else if (data.status === 'error') {
                        alert(`Error: ${data.text}`)
                        setBackupModal(prev => ({ ...prev, isCopying: false }))
                        return
                    }
                } catch(e) {}
            }
        }
        
        setTimeout(() => {
            setBackupModal({ isOpen: false, item: null, targetEmail: '', accounts: [], isLoading: false, progressText: '', progressValue: 0, isCopying: false })
            fetchData(1, keyword) // reload
        }, 2000)
        
    } catch (e) {
        alert('Gagal menyalin: ' + e.message)
        setBackupModal(prev => ({ ...prev, isCopying: false }))
    }
  }

  // ── Action Buttons (Move via Shared Drive) ──
  async function openDetailsModal(item) {
    setDetailsModal({ isOpen: true, item, info: null, loading: true, error: null })
    try {
        const fId = item.sources?.[0]?.folderId || item.id
        const res = await fetch(`/api/check?id=${encodeURIComponent(fId)}`)
        const data = await res.json()
        if (!res.ok || data.error) {
            setDetailsModal(prev => ({ ...prev, loading: false, error: data.error || 'Gagal mengecek ukuran' }))
            return
        }
        setDetailsModal(prev => ({ ...prev, loading: false, info: data }))
    } catch (e) {
        setDetailsModal(prev => ({ ...prev, loading: false, error: e.message }))
    }
  }

  async function openMoveModal(item) {
    setMoveModal({ isOpen: true, item, targetEmail: '', accounts: [], isLoading: true, isMoving: false })
    try {
        const res = await fetch('/api/drive/status')
        const data = await res.json()
        if (data.workspaces) {
            const sorted = data.workspaces.sort((a, b) => {
                const percA = a.storage?.percentage ?? 100
                const percB = b.storage?.percentage ?? 100
                return percA - percB
            })
            const existingEmails = new Set(item.sources?.map(s => s.ownerEmail) || [])
            const available = sorted.filter(a => !existingEmails.has(a.email) && a.status !== 'limit')
            
            setMoveModal(prev => ({ ...prev, accounts: available, targetEmail: available[0]?.email || '', isLoading: false }))
        } else {
            setMoveModal(prev => ({ ...prev, isLoading: false }))
        }
    } catch (e) {
        console.error(e)
        setMoveModal(prev => ({ ...prev, isLoading: false }))
    }
  }

  async function handleMoveStart() {
      const { item, targetEmail } = moveModal
      if (!item || !targetEmail) return

      setMoveModal(prev => ({ ...prev, isMoving: true }))
      try {
          const source = item.sources[0] // Asumsi mindahin copy pertama
          
          const res = await fetch('/api/catalog/move', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  sourceEmail: source.ownerEmail,
                  targetEmail: targetEmail,
                  folderId: source.folderId,
                  gameName: item.name
              })
          })
          
          if (!res.ok) {
              const data = await res.json()
              throw new Error(data.error || 'Gagal memindahkan')
          }
          
          setTimeout(() => {
              setMoveModal({ isOpen: false, item: null, targetEmail: '', accounts: [], isLoading: false, isMoving: false })
              fetchData(1, keyword) // reload
          }, 1000)
          
      } catch (err) {
          console.error(err)
          alert('Gagal Pindah: ' + err.message)
          setMoveModal(prev => ({ ...prev, isMoving: false }))
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
      syncPreferences({ recentEmails: next })
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
      syncPreferences({ recentGames: next })
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
    <div className="fadeUp pb-24">
      <TopBar title="Katalog Game" />

      <datalist id="recent-emails">
        {recentEmails.map(e => <option key={e} value={e} />)}
      </datalist>

      {/* Hero */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">Pusat Data</p>
          <h2 className="font-display mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--text)] md:text-[28px]">
            Katalog <span className="gradient-text">Game</span>
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

      <div className="xl:grid xl:grid-cols-[1fr_350px] xl:gap-6 xl:items-start">
        <div className="min-w-0">
          <div className="relative mb-6">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input
              type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Cari game di katalog..."
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-3 pl-11 pr-10 text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus:border-[var(--primary)]"
            />
            {keyword && (
              <button onClick={() => setKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] transition-colors hover:text-[var(--text)]" title="Bersihkan">
                <X size={15} />
              </button>
            )}
          </div>

          {!keyword && (
            <div className="mb-6">
              <QuickPick
                favorites={favs}
                recentGames={recentGames}
                bundles={bundles}
                isInCart={isInCart}
                onAdd={addToCart}
                onAddBundle={addBundleToCart}
                onToggleFav={toggleFav}
                onDeleteBundle={deleteBundle}
              />
            </div>
          )}

          {/* Hasil kirim — mobile */}
          {sendReport && (
            <div className="mb-4 md:hidden">
              <SendResult report={sendReport} email={sentTo} onClose={() => setSendReport(null)} onReset={() => { setSendReport(null); setKeyword('') }} />
            </div>
          )}

          {/* Loading awal */}
          {isSearching && page === 1 && <ResultSkeleton />}

          {/* Hasil katalog */}
          {!isSearching && (
            results.length > 0 ? (
              <div className="mb-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">{keyword ? 'Hasil Pencarian' : 'Semua Game'}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addManyToCart(results)}
                      className="pressable flex items-center gap-1 rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    >
                      <ListPlus size={13} /> Tambah halaman ini
                    </button>
                  </div>
                </div>
                <div className="stagger grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                  {results.map((item, index) => {
                    const isActive = index === activeIndex
                    return (
                      <GameItem 
                        key={item.id}
                        name={item.name} 
                        meta={item.sources?.length === 1 ? item.sources[0].ownerEmail : `${item.availableIn} Workspace`}
                        size={item.size}
                        totalFiles={item.totalFiles}
                        inCart={cart.some(c => c.id === item.id)}
                        onAdd={() => addToCart(item)}
                        onRemove={() => removeFromCart(item.id)}
                        active={isActive}
                        isFav={isFav(item.id)}
                        onToggleFav={() => toggleFav(item)}
                        onClick={() => openDetailsModal(item)}
                      />
                    )
                  })}
                </div>
                
                {/* Loader Pagination / Intersection Observer Target */}
                <div ref={loadMoreRef} className="mt-6 flex justify-center pb-4">
                  {isLoadingMore && <Loader2 className="animate-spin text-[var(--text-3)]" size={24} />}
                </div>

                {!hasMore && results.length > 0 && (
                    <div className="mt-2 pb-8 text-center text-xs text-[var(--text-3)]">
                        — Akhir dari katalog —
                    </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="text-3xl">🎮</span>
                <p className="text-sm font-semibold text-[var(--text-2)]">Katalog kosong atau game tidak ditemukan</p>
                <p className="text-xs text-[var(--text-3)]">Coba kata kunci yang berbeda</p>
              </div>
            )
          )}
        </div>

        {/* ── Kolom kanan: checkout — desktop ── */}
        <div className="hidden xl:block">
          <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col gap-3 overflow-y-auto scrollbar-hide">
            {sendReport && (
              <SendResult report={sendReport} email={sentTo} onClose={() => setSendReport(null)} onReset={() => { setSendReport(null); setKeyword('') }} />
            )}
            <div className="flex-1 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] flex flex-col">
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
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <CheckoutBody {...checkoutProps} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Hapus ── */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="animate-overlay absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deleteModal.isDeleting && setDeleteModal({ isOpen: false, item: null, isDeleting: false })} />
            <div className="animate-scale relative w-full max-w-sm rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-2xl">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                    <Trash2 size={24} />
                </div>
                <h3 className="mb-2 text-center text-lg font-bold text-[var(--text)]">Hapus Game Permanen?</h3>
                <p className="mb-6 text-center text-sm text-[var(--text-2)]">
                    Anda akan menghapus <strong>{deleteModal.item?.name}</strong>. Game ini akan dihancurkan secara permanen dari <strong>{deleteModal.item?.availableIn} Workspace</strong> yang menyimpannya, tanpa melewati recycle bin. Aksi ini tidak bisa dibatalkan!
                </p>
                <div className="flex gap-3">
                    <button onClick={() => setDeleteModal({ isOpen: false, item: null, isDeleting: false })} disabled={deleteModal.isDeleting} className="flex-1 rounded-xl bg-[var(--elevated)] py-2.5 text-sm font-bold text-[var(--text)] hover:brightness-110 disabled:opacity-50">Batal</button>
                    <button onClick={handleDeleteConfirm} disabled={deleteModal.isDeleting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                        {deleteModal.isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'Hapus Total'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ── Modal Backup ── */}
      {backupModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="animate-overlay absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !backupModal.isCopying && setBackupModal({ isOpen: false, item: null, targetEmail: '', accounts: [], isLoading: false, progressText: '', progressValue: 0, isCopying: false })} />
            <div className="animate-scale relative w-full max-w-md rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-2xl">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
                        <Database size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text)]">Backup Game</h3>
                        <p className="line-clamp-1 text-xs text-[var(--text-3)]">{backupModal.item?.name}</p>
                    </div>
                </div>

                {!backupModal.isCopying ? (
                    <>
                        <div className="mb-4">
                            <label className="mb-1.5 block text-xs font-bold text-[var(--text-2)]">Pilih Workspace Tujuan</label>
                            {backupModal.isLoading ? (
                                <div className="flex h-[42px] items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)]">
                                    <Loader2 size={16} className="animate-spin text-[var(--text-3)]" />
                                </div>
                            ) : backupModal.accounts.length > 0 ? (
                                <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto scrollbar-hide pb-2">
                                    {backupModal.accounts.map((acc, i) => (
                                        <button
                                            key={acc.email}
                                            onClick={() => setBackupModal(prev => ({ ...prev, targetEmail: acc.email }))}
                                            className={`text-left flex flex-col gap-1.5 rounded-2xl border p-3.5 transition-all ${backupModal.targetEmail === acc.email ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40 shadow-[0_0_15px_rgba(255,209,0,0.15)]' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--elevated)]/50'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${backupModal.targetEmail === acc.email ? 'bg-[var(--primary)] text-[var(--primary-fg)]' : 'bg-[var(--elevated)] text-[var(--text-3)]'}`}>
                                                        <Check size={12} strokeWidth={3} className={backupModal.targetEmail === acc.email ? 'opacity-100' : 'opacity-0'} />
                                                    </div>
                                                    <span className="text-[13px] font-bold text-[var(--text)] tracking-tight">{acc.email}</span>
                                                </div>
                                                {i === 0 && <span className="text-[9px] bg-[#10b981]/20 text-[#10b981] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Prioritas</span>}
                                            </div>
                                            
                                            <div className="mt-1 pl-8">
                                                <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-3)] mb-1.5">
                                                    <span>Terpakai: {acc.storage?.usageGB || '?'} / {acc.storage?.limitGB || '?'} GB</span>
                                                    <span className={acc.storage?.percentage > 85 ? 'text-red-400 font-bold' : 'text-[#10b981] font-bold'}>
                                                        Sisa: {acc.storage?.limitGB ? Math.max(0, parseFloat(acc.storage.limitGB) - parseFloat(acc.storage.usageGB || 0)).toFixed(1) : '?'} GB
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full rounded-full bg-[var(--elevated)] overflow-hidden shadow-inner">
                                                    <div 
                                                        className={`h-full rounded-full transition-all ${acc.storage?.percentage > 85 ? 'bg-red-500' : 'bg-[#10b981]'}`} 
                                                        style={{ width: `${Math.min(100, acc.storage?.percentage || 0)}%` }} 
                                                    />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                                    Semua workspace yang ada sudah memiliki game ini.
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setBackupModal({ isOpen: false, item: null, targetEmail: '', accounts: [], isLoading: false, progressText: '', progressValue: 0, isCopying: false })} className="flex-1 rounded-xl bg-[var(--elevated)] py-2.5 text-sm font-bold text-[var(--text)] hover:brightness-110">Batal</button>
                            <button onClick={handleBackupStart} disabled={backupModal.isLoading || backupModal.accounts.length === 0} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-bold text-[var(--primary-fg)] hover:brightness-105 disabled:opacity-50">
                                Mulai Backup
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="py-2">
                        <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-medium text-[var(--text-2)]">{backupModal.progressText}</span>
                            <span className="font-bold text-[var(--text)]">{backupModal.progressValue}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${backupModal.progressValue}%` }} />
                        </div>
                        {backupModal.progressValue === 100 && (
                             <div className="mt-4 rounded-xl bg-green-500/10 px-3 py-2 text-center text-xs font-bold text-green-500">
                                Berhasil disalin!
                             </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* ── Modal Pindah (Move Instan) ── */}
      {moveModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="animate-overlay absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !moveModal.isMoving && setMoveModal({ isOpen: false, item: null, targetEmail: '', accounts: [], isLoading: false, isMoving: false })} />
            <div className="animate-scale relative w-full max-w-md rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-2xl">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-500/10 text-green-500">
                        <Box size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text)]">Pindah Instan via KEBERSAMAAN</h3>
                        <p className="text-sm text-[var(--text-2)] line-clamp-1">{moveModal.item?.name}</p>
                    </div>
                </div>

                {moveModal.isLoading ? (
                    <div className="flex h-20 items-center justify-center">
                        <Loader2 className="animate-spin text-[var(--primary)]" />
                    </div>
                ) : (
                    <>
                        <div className="mb-6">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                                Pindahkan ke Workspace:
                            </label>
                            {moveModal.accounts.length > 0 ? (
                                <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto scrollbar-hide pb-2">
                                    {moveModal.accounts.map((acc, i) => (
                                        <button
                                            key={acc.email}
                                            onClick={() => setMoveModal(prev => ({ ...prev, targetEmail: acc.email }))}
                                            className={`text-left flex flex-col gap-1.5 rounded-2xl border p-3.5 transition-all ${moveModal.targetEmail === acc.email ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40 shadow-[0_0_15px_rgba(255,209,0,0.15)]' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--elevated)]/50'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${moveModal.targetEmail === acc.email ? 'bg-[var(--primary)] text-[var(--primary-fg)]' : 'bg-[var(--elevated)] text-[var(--text-3)]'}`}>
                                                        <Check size={12} strokeWidth={3} className={moveModal.targetEmail === acc.email ? 'opacity-100' : 'opacity-0'} />
                                                    </div>
                                                    <span className="text-[13px] font-bold text-[var(--text)] tracking-tight">{acc.email}</span>
                                                </div>
                                                {i === 0 && <span className="text-[9px] bg-[#10b981]/20 text-[#10b981] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Prioritas</span>}
                                            </div>
                                            
                                            <div className="mt-1 pl-8">
                                                <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-3)] mb-1.5">
                                                    <span>Terpakai: {acc.storage?.usageGB || '?'} / {acc.storage?.limitGB || '?'} GB</span>
                                                    <span className={acc.storage?.percentage > 85 ? 'text-red-400 font-bold' : 'text-[#10b981] font-bold'}>
                                                        Sisa: {acc.storage?.limitGB ? Math.max(0, parseFloat(acc.storage.limitGB) - parseFloat(acc.storage.usageGB || 0)).toFixed(1) : '?'} GB
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full rounded-full bg-[var(--elevated)] overflow-hidden shadow-inner">
                                                    <div 
                                                        className={`h-full rounded-full transition-all ${acc.storage?.percentage > 85 ? 'bg-red-500' : 'bg-[#10b981]'}`} 
                                                        style={{ width: `${Math.min(100, acc.storage?.percentage || 0)}%` }} 
                                                    />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                                    Semua workspace yang ada sudah memiliki game ini.
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setMoveModal({ isOpen: false, item: null, targetEmail: '', accounts: [], isLoading: false, isMoving: false })} className="flex-1 rounded-xl bg-[var(--elevated)] py-2.5 text-sm font-bold text-[var(--text)] hover:brightness-110">Batal</button>
                            <button onClick={handleMoveStart} disabled={moveModal.isMoving || moveModal.accounts.length === 0} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50">
                                {moveModal.isMoving ? <Loader2 size={16} className="animate-spin" /> : 'Pindahkan'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
      )}

      {/* ── Modal Detail Game ── */}
      {detailsModal.isOpen && detailsModal.item && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="animate-overlay absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailsModal({ isOpen: false, item: null, info: null, loading: false, error: null })} />
            <div className="animate-scale relative w-full max-w-lg rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="mb-6 flex items-start justify-between gap-4 shrink-0">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                                <Gamepad2 size={16} />
                            </span>
                            <h3 className="text-xl font-bold text-[var(--text)] leading-tight">{detailsModal.item.name}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-2)] font-medium">
                            {detailsModal.loading ? (
                                <span className="flex items-center gap-2 text-[var(--primary)]">
                                    <Loader2 size={14} className="animate-spin" /> Mengkalkulasi ukuran...
                                </span>
                            ) : detailsModal.error ? (
                                <span className="text-red-500">{detailsModal.error}</span>
                            ) : detailsModal.info ? (
                                <>
                                    <span className="flex items-center gap-1 rounded-md bg-[var(--elevated)] px-2 py-1"><HardDrive size={14}/> {detailsModal.info.total.size}</span>
                                    <span className="flex items-center gap-1 rounded-md bg-[var(--elevated)] px-2 py-1"><Database size={14}/> {detailsModal.info.total.count} files</span>
                                </>
                            ) : (
                                <span className="text-[var(--text-3)]">Ukuran tidak diketahui</span>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setDetailsModal({ isOpen: false, item: null, info: null, loading: false, error: null })} className="pressable rounded-full p-2 text-[var(--text-3)] hover:bg-[var(--elevated)] hover:text-[var(--text)]">
                        <X size={20} />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2 mb-6">
                    
                    {/* Size Breakdown */}
                    {detailsModal.info && (
                        <div className="mb-6">
                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">Struktur & Part File</h4>
                            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-1">
                                {detailsModal.info.root.count > 0 && (
                                    <div className="border-b border-[var(--border-soft)] p-3 last:border-0">
                                        <div className="flex justify-between text-sm font-semibold text-[var(--text)]">
                                            <span>Root Files</span>
                                            <span>{detailsModal.info.root.size}</span>
                                        </div>
                                        <div className="mt-1 text-xs text-[var(--text-3)]">{detailsModal.info.root.count} part(s)</div>
                                        <ul className="mt-2 space-y-1">
                                            {detailsModal.info.root.files.map((f, i) => (
                                                <li key={i} className="flex justify-between text-xs text-[var(--text-2)] pl-3 relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-px before:bg-[var(--border-strong)]">
                                                    <span className="truncate pr-2">{f.name}</span>
                                                    <span className="shrink-0">{f.size}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {detailsModal.info.subfolders?.map((sub, idx) => (
                                    <div key={idx} className="border-b border-[var(--border-soft)] p-3 last:border-0">
                                        <div className="flex justify-between text-sm font-semibold text-[var(--text)]">
                                            <span>{sub.name}</span>
                                            <span>{sub.size}</span>
                                        </div>
                                        <div className="mt-1 text-xs text-[var(--text-3)]">{sub.count} part(s)</div>
                                        <ul className="mt-2 space-y-1">
                                            {sub.files.map((f, i) => (
                                                <li key={i} className="flex justify-between text-xs text-[var(--text-2)] pl-3 relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-px before:bg-[var(--border-strong)]">
                                                    <span className="truncate pr-2">{f.name}</span>
                                                    <span className="shrink-0">{f.size}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">Tersedia di {detailsModal.item.availableIn} Workspace</h4>
                    <div className="flex flex-col gap-2">
                        {detailsModal.item.sources?.map((src, i) => (
                            <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-[var(--text)]">{src.ownerEmail}</span>
                                    <span className="text-[10px] font-mono text-[var(--text-3)] mt-0.5">{src.folderId}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="shrink-0 pt-4 border-t border-[var(--border-soft)]">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <button 
                            onClick={() => { setDetailsModal({ isOpen: false, item: null, info: null, loading: false, error: null }); openMoveModal(detailsModal.item); }}
                            className="flex items-center justify-center gap-2 rounded-xl bg-green-500/10 text-green-500 py-3 text-sm font-bold transition-colors hover:bg-green-500 hover:text-white"
                        >
                            <Box size={16} /> Pindah
                        </button>
                        <button 
                            onClick={() => { setDetailsModal({ isOpen: false, item: null, info: null, loading: false, error: null }); openBackupModal(detailsModal.item); }}
                            className="flex items-center justify-center gap-2 rounded-xl bg-blue-500/10 text-blue-500 py-3 text-sm font-bold transition-colors hover:bg-blue-500 hover:text-white"
                        >
                            <Copy size={16} /> Backup
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => {
                                const inCart = cart.some(c => c.id === detailsModal.item.id);
                                if (inCart) removeFromCart(detailsModal.item.id);
                                else addToCart(detailsModal.item);
                            }}
                            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${
                                cart.some(c => c.id === detailsModal.item.id) 
                                ? 'bg-[var(--elevated)] text-[var(--primary)] border border-[var(--primary)]/30' 
                                : 'bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-105'
                            }`}
                        >
                            {cart.some(c => c.id === detailsModal.item.id) ? (
                                <><Check size={16} /> Dihapus dari Keranjang</>
                            ) : (
                                <><Plus size={16} /> Tambah Keranjang</>
                            )}
                        </button>
                        <button 
                            onClick={() => { setDetailsModal({ isOpen: false, item: null, info: null, loading: false, error: null }); setDeleteModal({ isOpen: true, item: detailsModal.item, isDeleting: false }); }}
                            className="flex items-center justify-center gap-2 rounded-xl bg-red-500/10 text-red-500 py-3 text-sm font-bold transition-colors hover:bg-red-500 hover:text-white"
                        >
                            <Trash2 size={16} /> Hapus
                        </button>
                    </div>
                </div>

            </div>
        </div>
      )}

      {/* ── Mobile & Tablet: bar keranjang + sheet ── */}
      {mounted && createPortal(
        <>
          {cart.length > 0 && !cartSheetOpen && (
            <button
              onClick={() => setCartSheetOpen(true)}
              className="pressable fixed left-4 right-4 z-[55] flex items-center justify-between rounded-2xl bg-[var(--primary)] px-4 py-3 shadow-[0_10px_30px_-12px_rgba(255,209,0,0.6)] xl:hidden max-w-[500px] mx-auto"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 12px) + 2rem)' }}
            >
              <span className="flex items-center gap-2 text-sm font-extrabold text-[var(--primary-fg)]">
                <ShoppingCart size={16} /> {cart.length} game di keranjang
              </span>
              <span className="rounded-lg bg-[var(--primary-fg)]/10 px-3 py-1 text-sm font-extrabold text-[var(--primary-fg)]">Lihat &amp; kirim →</span>
            </button>
          )}

          {cartSheetOpen && (
            <div className="fixed inset-0 z-[70] xl:hidden flex justify-center">
              <div className="animate-overlay absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCartSheetOpen(false)} />
              <div className="animate-sheet absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl border-t border-[var(--border-strong)] bg-[var(--surface)] max-w-[600px] mx-auto w-full">
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
        </>,
        document.body
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
