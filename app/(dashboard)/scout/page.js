'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Search, Loader2, Sparkles, Copy, ExternalLink, Image as ImageIcon, 
  FolderOpen, Check, RefreshCw, AlertCircle, CheckCircle2, Layers, HardDrive, ChevronDown
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { useToast } from '@/components/ui/Toast'

export default function ShopeeListingStudio() {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState({ status: 'idle', data: null, error: null })
  const searchAbortRef = useRef(null)
  
  // Pipeline & Catalog Integration State
  const [catalogGames, setCatalogGames] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [showCatalogPanel, setShowCatalogPanel] = useState(true)
  const [activeCatalogGame, setActiveCatalogGame] = useState(null)
  const [markListedState, setMarkListedState] = useState({ status: 'idle', shopeeUrl: '' })

  // Editable fields before generation
  const [title, setTitle] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [screenshots, setScreenshots] = useState([])
  const [customOutputDir, setCustomOutputDir] = useState('D:\\Shopee\\3-listing_output')

  // Generation state
  const [generateState, setGenerateState] = useState({ status: 'idle', result: null, error: null })
  const [copyFeedback, setCopyFeedback] = useState({ title: false, desc: false })
  const [isOpeningFolder, setIsOpeningFolder] = useState(false)
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [aiError, setAiError] = useState(null)

  // Navigation Guard during rendering
  useNavigationGuard(
    generateState.status === 'generating',
    'Slide Shopee sedang dirender. Yakin ingin meninggalkan halaman?'
  )

  // Load listingOutputDir from preferences on mount
  useEffect(() => {
    fetch('/api/preferences')
      .then(r => r.json())
      .then(json => {
        if (json?.listingOutputDir) {
          setCustomOutputDir(json.listingOutputDir)
        }
      })
      .catch(() => {})
  }, [])

  // Auto-save listingOutputDir preference when changed (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customOutputDir) {
        fetch('/api/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingOutputDir: customOutputDir })
        }).catch(() => {})
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [customOutputDir])

  // 0. Racik SEO & Deskripsi dengan Gemini AI
  async function handleAiGenerate() {
    if (!title) return
    setIsAiGenerating(true)
    setAiError(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: title,
          gameSynopsis: searchState.data?.synopsis || description || title
        })
      })
      const json = await res.json()
      if (json.success && json.data) {
        if (json.data.title) setSeoTitle(json.data.title)
        if (json.data.description) setDescription(json.data.description)
      } else {
        setAiError(json.error || 'Gagal meracik SEO dengan AI')
      }
    } catch (err) {
      setAiError(err.message || 'Gagal menghubungi server Gemini AI')
    } finally {
      setIsAiGenerating(false)
    }
  }

  // 1. Search Steam API
  async function handleSearch(e, overrideQuery = null) {
    if (e) e.preventDefault()
    const searchQuery = overrideQuery || query
    if (!searchQuery.trim()) return

    if (searchAbortRef.current) searchAbortRef.current.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller

    setSearchState({ status: 'searching', data: null, error: null })
    setGenerateState({ status: 'idle', result: null, error: null })

    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    try {
      const res = await fetch(
        `/api/listing/search?query=${encodeURIComponent(searchQuery.trim())}`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)
      const json = await res.json()

      if (json.success && json.data) {
        setSearchState({ status: 'success', data: json.data, error: null })
        setTitle(json.data.title || '')
        setSeoTitle(json.data.seoTitle || '')
        setDescription(json.data.description || '')
        setCoverUrl(json.data.coverUrl || '')
        setScreenshots(json.data.screenshots || [])
      } else {
        setSearchState({ status: 'error', data: null, error: json.error || 'Game tidak ditemukan' })
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        setSearchState({
          status: 'error',
          data: null,
          error: 'Pencarian timeout (>15 detik). Steam API mungkin sedang lambat. Coba lagi atau gunakan Steam AppID langsung.'
        })
      } else {
        setSearchState({ status: 'error', data: null, error: err.message || 'Gagal menghubungi server' })
      }
    }
  }

  // Fetch unlisted games from catalog pipeline
  async function fetchUnlistedGames() {
    setCatalogLoading(true)
    try {
      const res = await fetch('/api/catalog/pipeline?shopeeListed=false&status=on_drive,listing_ready&limit=50')
      const json = await res.json()
      if (json.success) {
        setCatalogGames(json.data)
      }
    } catch (err) {
      console.error('Gagal memuat daftar game dari catalog:', err)
    } finally {
      setCatalogLoading(false)
    }
  }

  useEffect(() => {
    fetchUnlistedGames()

    const params = new URLSearchParams(window.location.search)
    const prefill = params.get('prefill') || params.get('game') || params.get('query')
    if (prefill) {
      const decodedPrefill = decodeURIComponent(prefill)
      setQuery(decodedPrefill)
      setTimeout(() => handleSearch(null, decodedPrefill), 100)
    }
  }, [])

  async function handleMarkListed() {
    if (!activeCatalogGame?._id) {
      toast('Pilih game dari panel "Belum Di-Listing" terlebih dahulu, atau cari game yang sudah ada di katalog.', 'warning')
      return
    }

    setMarkListedState(prev => ({ ...prev, status: 'saving' }))
    try {
      const res = await fetch(`/api/catalog/${activeCatalogGame._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopeeListed: true,
          shopeeListedAt: new Date().toISOString(),
          shopeeUrl: markListedState.shopeeUrl || '',
          pipelineStatus: 'listed',
          listingAssets: {
            seoTitle,
            description,
            slidesFolderPath: generateState.result?.targetDir || '',
            generatedAt: new Date().toISOString()
          }
        })
      })
      const json = await res.json()
      if (json.success) {
        setMarkListedState({ status: 'done', shopeeUrl: markListedState.shopeeUrl })
        toast('Game berhasil ditandai sebagai Live di Shopee!', 'success')
        fetchUnlistedGames()
      } else {
        setMarkListedState(prev => ({ ...prev, status: 'error' }))
        toast('Gagal menyimpan status: ' + (json.error || 'Unknown error'), 'error')
      }
    } catch (err) {
      setMarkListedState(prev => ({ ...prev, status: 'error' }))
      toast('Gagal menghubungi server: ' + err.message, 'error')
    }
  }

  // 2. Generate 6 Slides with Pillow Engine
  async function handleGenerate() {
    if (!title || !coverUrl) return

    setGenerateState({ status: 'generating', result: null, error: null })

    try {
      const res = await fetch('/api/listing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          coverUrl,
          screenshots,
          seoTitle,
          description,
          customOutputDir
        })
      })

      const json = await res.json()

      if (json.success) {
        setGenerateState({ status: 'success', result: json, error: null })
      } else {
        setGenerateState({ status: 'error', result: null, error: json.error || 'Gagal membuat slide listing' })
      }
    } catch (err) {
      setGenerateState({ status: 'error', result: null, error: err.message || 'Terjadi kesalahan saat generate slide' })
    }
  }

  // 3. Open Folder in Explorer
  async function handleOpenFolder() {
    const targetDir = generateState.result?.targetDir || customOutputDir
    setIsOpeningFolder(true)
    try {
      await fetch('/api/listing/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: targetDir })
      })
    } catch (err) {
      console.error('Gagal membuka folder:', err)
    } finally {
      setIsOpeningFolder(false)
    }
  }

  // Copy helpers
  function copyToClipboard(text, field) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopyFeedback(prev => ({ ...prev, [field]: true }))
    setTimeout(() => {
      setCopyFeedback(prev => ({ ...prev, [field]: false }))
    }, 2000)
  }

  function handleReset() {
    setQuery('')
    setSearchState({ status: 'idle', data: null, error: null })
    setGenerateState({ status: 'idle', result: null, error: null })
    setTitle('')
    setSeoTitle('')
    setDescription('')
    setCoverUrl('')
    setScreenshots([])
    setMarkListedState({ status: 'idle', shopeeUrl: '' })
    setActiveCatalogGame(null)
  }

  const titleLength = seoTitle.length
  const isTitleTooLong = titleLength > 120

  return (
    <div className="fadeUp pb-24 h-full flex flex-col">
      <TopBar title="Shopee Listing Studio" />

      <div className="flex flex-col flex-1 mt-6 max-w-6xl mx-auto w-full px-4">
        
        {/* Panel Game Belum Di-Listing */}
        <div className="mb-6 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden">
          <button
            onClick={() => setShowCatalogPanel(p => !p)}
            className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-[var(--text-2)] hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <HardDrive size={14} className="text-[var(--primary)]" />
              <span>Game di GDrive — Belum Di-Listing</span>
              {catalogGames.length > 0 && (
                <span className="rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
                  {catalogGames.length} game
                </span>
              )}
            </div>
            <ChevronDown size={14} className={`transition-transform ${showCatalogPanel ? 'rotate-180' : ''}`} />
          </button>

          {showCatalogPanel && (
            <div className="border-t border-[var(--border-soft)] p-4">
              {catalogLoading ? (
                <div className="flex items-center gap-2 text-xs text-[var(--text-4)]">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Memuat dari catalog...</span>
                </div>
              ) : catalogGames.length === 0 ? (
                <p className="text-xs text-[var(--text-4)] text-center py-2">
                  Semua game di GDrive sudah di-listing 🎉
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {catalogGames.map(game => (
                    <button
                      key={game._id}
                      onClick={() => {
                        setQuery(game.cleanTitle || game.name)
                        handleSearch(null, game.cleanTitle || game.name)
                        setActiveCatalogGame(game)
                      }}
                      className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-3 py-2 text-xs font-medium text-[var(--text-2)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all cursor-pointer text-left"
                    >
                      {game.coverImageUrl && (
                        <img src={game.coverImageUrl} alt="" className="w-6 h-8 object-cover rounded shrink-0" />
                      )}
                      <span className="truncate max-w-[160px]">{game.cleanTitle || game.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Header Hero */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 text-xs font-semibold mb-3">
            <Sparkles size={14} />
            <span>Zero-CLI Shopee Fast Listing Engine</span>
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--text)]">
            Shopee <span className="gradient-text">Listing Studio</span>
          </h2>
          <p className="text-sm text-[var(--text-3)] mt-2 max-w-2xl mx-auto">
            Ketik nama game atau paste link Steam. Sistem akan mengambil aset resmi, merender 6 slide Shopee siap upload via Pillow, dan meracik judul & deskripsi 100% aman dalam 3 detik.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-8 shadow-xl max-w-3xl mx-auto w-full">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={20} className="text-[var(--text-4)]" />
          </div>
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik judul game (misal: Black Myth Wukong, Elden Ring, atau link Steam)..." 
            className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl py-4 pl-12 pr-36 text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all text-sm"
            required
          />
          {searchState.status === 'searching' && (
            <button
              type="button"
              onClick={() => {
                if (searchAbortRef.current) searchAbortRef.current.abort()
                setSearchState({ status: 'idle', data: null, error: null })
              }}
              className="absolute right-36 top-2 bottom-2 px-3 rounded-xl text-xs font-bold text-[var(--text-3)] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              Batalkan
            </button>
          )}
          <button 
            type="submit"
            disabled={searchState.status === 'searching'}
            className="absolute right-2 top-2 bottom-2 bg-[var(--primary)] text-black font-bold px-6 rounded-xl hover:brightness-105 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {searchState.status === 'searching' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Mencari...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Cari Game</span>
              </>
            )}
          </button>
        </form>

        {/* Error Alert */}
        {searchState.status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center text-red-400 mb-8 max-w-3xl mx-auto w-full flex items-center justify-center gap-3">
            <AlertCircle size={20} />
            <div className="text-left text-xs">
              <span className="font-bold block">Pencarian Gagal</span>
              <span>{searchState.error}</span>
            </div>
          </div>
        )}

        {/* Content Area when game is found */}
        {searchState.status === 'success' && searchState.data && (
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Visual Assets Preview (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Cover Card */}
              <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-[var(--primary)]" /> Cover Portrait (600x900)
                  </span>
                  <span className="text-[10px] bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded font-bold">
                    {searchState.data.primaryGenre}
                  </span>
                </div>

                <div className="aspect-[2/3] w-full max-w-[280px] mx-auto bg-black/40 rounded-xl overflow-hidden border border-white/10 shadow-inner relative group">
                  {coverUrl ? (
                    <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--text-4)]">Tidak ada cover</div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-xs text-white mb-2">Gunakan URL cover vertikal lainnya jika diinginkan</p>
                  </div>
                </div>

                {/* Custom Cover Input */}
                <div className="mt-4">
                  <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1">
                    Ganti URL Cover (Opsional)
                  </label>
                  <input
                    type="url"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border-soft)] rounded-lg py-2 px-3 text-xs text-[var(--text)] outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              {/* 4 Gameplay Screenshots */}
              <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-1.5">
                    <Layers size={14} className="text-[var(--primary)]" /> 4 Screenshot Gameplay
                  </span>
                  <span className="text-[10px] text-[var(--text-4)]">Untuk Slide 2 Kolase</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {screenshots.slice(0, 4).map((shot, idx) => (
                    <div key={idx} className="aspect-video bg-black/40 rounded-lg overflow-hidden border border-white/5 relative">
                      <img src={shot} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white/80 px-1 rounded font-mono">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Output Directory Info */}
              <div className="bg-[var(--elevated)] border border-[var(--border-soft)] rounded-2xl p-4 text-xs">
                <div className="flex items-center gap-2 text-[var(--text-3)] mb-1 font-bold">
                  <HardDrive size={14} /> Lokasi Penyimpanan Slide:
                </div>
                <input
                  type="text"
                  value={customOutputDir}
                  onChange={(e) => setCustomOutputDir(e.target.value)}
                  className="w-full bg-black/30 border border-[var(--border-soft)] rounded-lg py-1.5 px-2.5 text-[11px] font-mono text-[var(--text)] outline-none focus:border-[var(--primary)]"
                />
              </div>

            </div>

            {/* Right Column: Listing Copy & Generate Action (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              {/* Card Form */}
              <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl p-6 shadow-lg">
                
                {/* Clean Game Name */}
                <div className="mb-5">
                  <label className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider block mb-1.5">
                    Nama Game (Untuk Banner Slide)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border-soft)] rounded-xl py-2.5 px-3.5 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]"
                  />
                </div>

                {/* SEO Title */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                    <label className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                      Judul Produk Shopee
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleAiGenerate}
                        disabled={isAiGenerating || !title}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[var(--primary)] border border-[var(--primary)]/30 transition-all disabled:opacity-50 cursor-pointer"
                        title="Racik Judul SEO & Deskripsi AIDA menggunakan Gemini AI"
                      >
                        {isAiGenerating ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Meracik AI...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            <span>Racik via Gemini AI</span>
                          </>
                        )}
                      </button>
                      <span className={`text-xs font-mono font-bold ${isTitleTooLong ? 'text-red-400' : 'text-[var(--primary)]'}`}>
                        {titleLength}/120 Karakter
                      </span>
                    </div>
                  </div>
                  {aiError && (
                    <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 flex items-center gap-2">
                      <AlertCircle size={13} />
                      <span>{aiError}</span>
                    </div>
                  )}
                  <div className="relative">
                    <textarea
                      rows={2}
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      className={`w-full bg-[var(--background)] border ${isTitleTooLong ? 'border-red-500' : 'border-[var(--border-soft)]'} rounded-xl p-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] resize-none`}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(seoTitle, 'title')}
                      className="absolute right-2.5 bottom-3 p-1.5 bg-[var(--surface)] hover:bg-[var(--primary)] hover:text-black rounded-lg border border-[var(--border-soft)] text-xs text-[var(--text-3)] transition-all flex items-center gap-1"
                      title="Salin Judul"
                    >
                      {copyFeedback.title ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  {isTitleTooLong && (
                    <p className="text-[11px] text-red-400 mt-1">
                      ⚠️ Judul melebihi batas 120 karakter Shopee! Harap perpendek agar lolos upload.
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                      Deskripsi Produk (100% Shopee Safe Engine)
                    </label>
                    <span className="text-[10px] text-green-400 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Bebas Kata Terlarang
                    </span>
                  </div>
                  <div className="relative">
                    <textarea
                      rows={10}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-[var(--background)] border border-[var(--border-soft)] rounded-xl p-3.5 text-xs text-[var(--text)] font-sans leading-relaxed outline-none focus:border-[var(--primary)] resize-y custom-scrollbar"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(description, 'desc')}
                      className="absolute right-3 bottom-4 p-1.5 bg-[var(--surface)] hover:bg-[var(--primary)] hover:text-black rounded-lg border border-[var(--border-soft)] text-xs text-[var(--text-3)] transition-all flex items-center gap-1"
                      title="Salin Deskripsi"
                    >
                      {copyFeedback.desc ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Main Action Button */}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generateState.status === 'generating' || !title || !coverUrl}
                  className="w-full bg-[var(--primary)] hover:brightness-110 text-black font-extrabold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-[var(--primary)]/20 flex items-center justify-center gap-3 disabled:opacity-50 text-base"
                >
                  {generateState.status === 'generating' ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Sedang Merender 6 Slide via Pillow Engine...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      <span>⚡ Generate 6 Slide Shopee Sekarang</span>
                    </>
                  )}
                </button>

                {generateState.status === 'error' && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">
                    {generateState.error}
                  </div>
                )}
              </div>

              {/* SUCCESS SECTION: Generated Slides Preview & Quick Actions */}
              {generateState.status === 'success' && generateState.result && (
                <div className="bg-gradient-to-br from-[var(--surface)] to-[var(--elevated)] border border-[var(--primary)]/30 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                  
                  {/* Success Title */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">Paket 6 Slide Shopee Siap!</h4>
                        <p className="text-xs text-[var(--text-3)] font-mono truncate max-w-md">
                          {generateState.result.targetDir}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleOpenFolder}
                        disabled={isOpeningFolder}
                        className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2"
                      >
                        {isOpeningFolder ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                        Buka Folder di Explorer
                      </button>

                      <button
                        onClick={handleReset}
                        className="p-2 hover:bg-white/10 rounded-xl text-[var(--text-3)] transition-colors"
                        title="Proses Game Lain"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 1-Click Fast Copy Bar */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      onClick={() => copyToClipboard(seoTitle, 'title')}
                      className="bg-black/40 hover:bg-black/60 border border-[var(--border-soft)] py-3 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all hover:border-[var(--primary)]"
                    >
                      {copyFeedback.title ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      {copyFeedback.title ? 'Judul Berhasil Disalin!' : 'Salin Judul Shopee (1-Click)'}
                    </button>

                    <button
                      onClick={() => copyToClipboard(description, 'desc')}
                      className="bg-black/40 hover:bg-black/60 border border-[var(--border-soft)] py-3 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all hover:border-[var(--primary)]"
                    >
                      {copyFeedback.desc ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      {copyFeedback.desc ? 'Deskripsi Berhasil Disalin!' : 'Salin Deskripsi (1-Click)'}
                    </button>
                  </div>

                  {/* 6 Slides Visual Gallery */}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] block mb-3">
                      Preview 6 Slide Siap Upload:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {generateState.result.slides.map((slide) => (
                        <div key={slide.id} className="bg-black/50 border border-white/10 rounded-xl overflow-hidden flex flex-col group">
                          <div className="aspect-square w-full relative overflow-hidden bg-black/80 flex items-center justify-center">
                            <img 
                              src={`/api/listing/slide-preview?path=${encodeURIComponent(slide.filePath)}`}
                              alt={slide.title} 
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform" 
                              loading="lazy"
                            />
                            <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-black/80 text-[var(--primary)] px-1.5 py-0.5 rounded">
                              #{slide.id}
                            </span>
                          </div>
                          <div className="p-2 bg-[var(--surface)] text-[10px] text-center font-medium text-[var(--text-3)] truncate">
                            {slide.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mark as Listed Section */}
                  <div className="mt-6 pt-5 border-t border-white/10">
                    {markListedState.status === 'done' ? (
                      <div className="flex items-center gap-3 rounded-2xl bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400 font-bold">
                        <CheckCircle2 size={18} />
                        <span>✅ Game berhasil ditandai sebagai Live di Shopee!</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">
                          Setelah upload ke Shopee selesai:
                        </p>
                        <div className="flex gap-3">
                          <input
                            type="url"
                            value={markListedState.shopeeUrl}
                            onChange={(e) => setMarkListedState(prev => ({ ...prev, shopeeUrl: e.target.value }))}
                            placeholder="https://shopee.co.id/produk... (opsional)"
                            className="flex-1 bg-[var(--background)] border border-[var(--border-soft)] rounded-xl py-2.5 px-3.5 text-xs text-[var(--text)] outline-none focus:border-[var(--primary)]"
                          />
                          <button
                            onClick={handleMarkListed}
                            disabled={markListedState.status === 'saving' || !activeCatalogGame}
                            className="flex items-center gap-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 font-bold px-4 py-2.5 text-xs transition-all disabled:opacity-50 cursor-pointer"
                            title={!activeCatalogGame ? 'Pilih game dari panel catalog terlebih dahulu' : ''}
                          >
                            {markListedState.status === 'saving' ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            <span>Tandai Sudah Live di Shopee</span>
                          </button>
                        </div>
                        {!activeCatalogGame && (
                          <p className="text-[10px] text-amber-400">
                            ⚠️ Pilih game dari panel di atas agar status bisa disimpan ke katalog
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>

          </div>
        )}

      </div>
    </div>
  )
}
