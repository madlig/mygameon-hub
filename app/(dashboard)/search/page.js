'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import GameItem from '@/components/shared/GameItem'

// Data dummy — nanti diganti fetch dari API
const DUMMY_RESULTS = {
  'final fantasy': [
    { id: 'ff16',   name: 'Final Fantasy XVI',        meta: 'workspace-A · shortcut' },
    { id: 'ff7r',   name: 'Final Fantasy VII Remake', meta: 'workspace-B · shortcut' },
    { id: 'ff12',   name: 'Final Fantasy XII',        meta: 'workspace-A · shortcut' },
    { id: 'ff12-2', name: 'Final Fantasy XII-2',      meta: 'workspace-C · shortcut' },
  ],
  'elden': [
    { id: 'er',     name: 'Elden Ring',               meta: 'workspace-A · shortcut' },
    { id: 'er-dlc', name: 'Elden Ring Shadow DLC',    meta: 'workspace-B · shortcut' },
  ],
}

export default function SearchPage() {
  const [keyword, setKeyword]   = useState('')
  const [results, setResults]   = useState([])
  const [cart, setCart]         = useState([])
  const [isSearching, setIsSearching] = useState(false)

  function handleSearch(value) {
    setKeyword(value)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setIsSearching(true)
    // Simulasi delay seperti fetch API
    setTimeout(() => {
      const key = Object.keys(DUMMY_RESULTS).find(k =>
        value.toLowerCase().includes(k)
      )
      setResults(key ? DUMMY_RESULTS[key] : [])
      setIsSearching(false)
    }, 400)
  }

  function addToCart(item) {
    if (cart.find(c => c.id === item.id)) return
    setCart(prev => [...prev, item])
  }

  function removeFromCart(itemId) {
    setCart(prev => prev.filter(c => c.id !== itemId))
  }

  const isInCart = (id) => cart.some(c => c.id === id)

  return (
    <div>
      <TopBar title="Cari game" />

      {/* Search input */}
      <div className="relative mb-4">
        <input
          type="text"
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Ketik nama game..."
          className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          🔍
        </span>
      </div>

      {/* Hasil pencarian */}
      {isSearching && (
        <p className="text-xs text-muted-foreground mb-3">Mencari...</p>
      )}

      {!isSearching && results.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
            {results.length} hasil ditemukan
          </p>
          <div className="flex flex-col gap-2">
            {results.map((item) => (
              <GameItem
                key={item.id}
                name={item.name}
                meta={item.meta}
                inCart={isInCart(item.id)}
                onAdd={() => addToCart(item)}
                onRemove={() => removeFromCart(item.id)}
              />
            ))}
          </div>
        </div>
      )}

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

      {/* Cart bar — muncul kalau keranjang ada isinya */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between rounded-xl bg-primary px-4 py-3 md:bottom-4 md:left-64 md:right-4">
          <div>
            <p className="text-sm font-bold text-primary-foreground">
              {cart.length} game di keranjang
            </p>
            <p className="text-[10px] text-primary-foreground/70">
              {cart.map(c => c.name).join(', ')}
            </p>
          </div>
          <button className="text-sm font-bold text-primary-foreground">
            Kirim →
          </button>
        </div>
      )}
    </div>
  )
}