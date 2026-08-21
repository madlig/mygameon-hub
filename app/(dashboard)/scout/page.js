'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, Sparkles, Copy, ExternalLink, Image as ImageIcon, HardDrive } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'

export default function ScoutPage() {
  const [url, setUrl] = useState('')
  const [scrapeState, setScrapeState] = useState({ status: 'idle', commandId: null, data: null, error: null })
  const [aiState, setAiState] = useState({ status: 'idle', result: null, error: null })
  const [exportState, setExportState] = useState({ status: 'idle', commandId: null, error: null })
  const [customCover, setCustomCover] = useState('')
  const [isFetchingSteam, setIsFetchingSteam] = useState(false)

  // Polling for scrape & export results
  useEffect(() => {
    let interval;
    if (scrapeState.status === 'polling' && scrapeState.commandId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/remote/scrape?commandId=${scrapeState.commandId}`)
          const json = await res.json()
          if (json.success && json.command) {
            if (json.command.status === 'completed') {
              setScrapeState(prev => ({ ...prev, status: 'success', data: json.command.result }))
              setCustomCover(json.command.result.coverImage || '')
              clearInterval(interval)
            } else if (json.command.status === 'failed') {
              setScrapeState(prev => ({ ...prev, status: 'error', error: json.command.error }))
              clearInterval(interval)
            }
          }
        } catch (err) {}
      }, 2000)
    }

    if (exportState.status === 'exporting' && exportState.commandId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/remote/scrape?commandId=${exportState.commandId}`) // Reusing scrape polling endpoint since it just checks RemoteCommand by ID
          const json = await res.json()
          if (json.success && json.command) {
            if (json.command.status === 'completed') {
              setExportState(prev => ({ ...prev, status: 'success' }))
              clearInterval(interval)
            } else if (json.command.status === 'failed') {
              setExportState(prev => ({ ...prev, status: 'error', error: json.command.error }))
              clearInterval(interval)
            }
          }
        } catch (err) {}
      }, 2000)
    }

    return () => { if (interval) clearInterval(interval) }
  }, [scrapeState.status, scrapeState.commandId, exportState.status, exportState.commandId])

  async function handleScrape(e) {
    e.preventDefault()
    if (!url) return
    
    setScrapeState({ status: 'sending', commandId: null, data: null, error: null })
    setAiState({ status: 'idle', result: null, error: null })
    
    try {
      const res = await fetch('/api/remote/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const json = await res.json()
      
      if (json.success) {
        setScrapeState({ status: 'polling', commandId: json.commandId, data: null, error: null })
      } else {
        setScrapeState({ status: 'error', commandId: null, data: null, error: json.error })
      }
    } catch (err) {
      setScrapeState({ status: 'error', commandId: null, data: null, error: err.message })
    }
  }

  async function handleExportPhotoshop() {
    if (!scrapeState.data) return
    
    setExportState({ status: 'exporting', commandId: null, error: null })
    
    try {
      const res = await fetch('/api/remote/photoshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: 'mygameon-pc-1',
          title: scrapeState.data.title,
          coverImage: customCover || scrapeState.data.coverImage,
          images: scrapeState.data.images
        })
      })
      const json = await res.json()
      
      if (json.success) {
        setExportState({ status: 'exporting', commandId: json.commandId, error: null })
      } else {
        setExportState({ status: 'error', commandId: null, error: json.error })
      }
    } catch (err) {
      setExportState({ status: 'error', commandId: null, error: err.message })
    }
  }

  const handleFetchSteam = async () => {
    if (!scrapeState.data?.title) return
    setIsFetchingSteam(true)
    try {
      const res = await fetch(`/api/steam/cover?title=${encodeURIComponent(scrapeState.data.title)}`)
      const json = await res.json()
      if (json.success && json.coverUrl) {
        setCustomCover(json.coverUrl)
      } else {
        alert(json.error || 'Gagal mencari di Steam')
      }
    } catch (err) {
      alert('Terjadi kesalahan saat mencari di Steam')
    } finally {
      setIsFetchingSteam(false)
    }
  }

  async function handleGenerateAI() {
    if (!scrapeState.data) return
    
    setAiState({ status: 'generating', result: null, error: null })
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: scrapeState.data.title,
          gameSynopsis: scrapeState.data.fullText
        })
      })
      const json = await res.json()
      
      if (json.success) {
        setAiState({ status: 'success', result: json.data, error: null })
      } else {
        setAiState({ status: 'error', result: null, error: json.error })
      }
    } catch (err) {
      setAiState({ status: 'error', result: null, error: err.message })
    }
  }

  return (
    <div className="fadeUp pb-24 h-full flex flex-col">
      <TopBar title="Game Scout & AI SEO" />
      
      <div className="flex flex-col flex-1 mt-6 max-w-4xl mx-auto w-full px-4">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[var(--primary)] to-yellow-300 text-black mb-4 shadow-lg shadow-[var(--primary)]/20">
            <Search size={32} />
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--text)]">
            Game <span className="gradient-text">Scout</span>
          </h2>
          <p className="text-sm text-[var(--text-3)] mt-2">Masukkan link Ovagames/Steamrip. Mesin Zombi di PC Anda akan membypass Cloudflare dan mengambil data gamenya.</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleScrape} className="relative mb-8 shadow-xl">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <ExternalLink size={20} className="text-[var(--text-4)]" />
          </div>
          <input 
            type="url" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.ovagames.com/..." 
            className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl py-4 pl-12 pr-32 text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all"
            required
          />
          <button 
            type="submit"
            disabled={scrapeState.status === 'sending' || scrapeState.status === 'polling'}
            className="absolute right-2 top-2 bottom-2 bg-[var(--primary)] text-black font-bold px-6 rounded-xl hover:brightness-105 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {(scrapeState.status === 'sending' || scrapeState.status === 'polling') ? <Loader2 size={18} className="animate-spin" /> : 'Scout!'}
          </button>
        </form>

        {/* Status Monitor */}
        {scrapeState.status === 'polling' && (
          <div className="bg-[var(--elevated)] border border-[var(--border-soft)] rounded-2xl p-6 text-center animate-pulse mb-8">
            <Loader2 size={32} className="animate-spin text-[var(--primary)] mx-auto mb-3" />
            <h3 className="font-bold text-[var(--text)]">Zombi PC Sedang Bekerja...</h3>
            <p className="text-xs text-[var(--text-3)] mt-1">Mengendalikan browser tersembunyi di PC Anda untuk menembus Cloudflare.</p>
          </div>
        )}

        {scrapeState.status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center text-red-400 mb-8">
            <h3 className="font-bold mb-1">Gagal Mengambil Data</h3>
            <p className="text-xs">{scrapeState.error}</p>
          </div>
        )}

        {/* Results */}
        {scrapeState.status === 'success' && scrapeState.data && (
          <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Scraped Data Card */}
            <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl overflow-hidden shadow-lg">
              <div className="aspect-[3/4] md:aspect-video w-full bg-[var(--elevated)] relative overflow-hidden flex items-center justify-center">
                {customCover ? (
                  <img src={customCover} alt="Cover" className="w-full h-full object-cover opacity-80" />
                ) : scrapeState.data.coverImage ? (
                  <img src={scrapeState.data.coverImage} alt="Cover" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <ImageIcon size={48} className="text-[var(--text-4)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="font-bold text-white text-lg line-clamp-2 leading-tight">{scrapeState.data.title}</h3>
                </div>
              </div>
              <div className="p-6">
                
                {/* Custom Cover Input */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">Custom Cover Image URL</label>
                    <button 
                      onClick={handleFetchSteam}
                      disabled={isFetchingSteam}
                      className="text-xs font-bold text-[var(--primary)] hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {isFetchingSteam ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Auto-Fetch Steam
                    </button>
                  </div>
                  <input
                    type="url"
                    value={customCover}
                    onChange={(e) => setCustomCover(e.target.value)}
                    placeholder="Paste link gambar potrait disini..."
                    className="w-full bg-[var(--background)] border border-[var(--border-soft)] rounded-lg py-2 px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                  />
                  <p className="text-[10px] text-[var(--text-4)] mt-1">
                    Gambar default Ovagames seringkali landscape dan beresolusi rendah. Paste link gambar vertikal (seperti dari Mobygames atau SteamGridDB) di sini jika Anda ingin cover yang lebih bagus.
                  </p>
                </div>

                <p className="text-xs text-[var(--text-3)] leading-relaxed line-clamp-6">
                  {scrapeState.data.fullText}
                </p>
                <div className="mt-4 pt-4 border-t border-[var(--border-soft)]">
                  <div className="flex gap-2 mb-2 text-[10px] uppercase font-bold text-[var(--text-4)] tracking-wider">
                    <ImageIcon size={12} /> Ditemukan {scrapeState.data.images?.length || 0} Gambar
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {scrapeState.data.images?.map((img, i) => (
                      <img key={i} src={img} className="w-16 h-12 object-cover rounded-lg border border-[var(--border-soft)] shrink-0" alt={`Gameplay ${i+1}`} />
                    ))}
                  </div>
                  
                  {/* Photoshop Export Button */}
                  <div className="mt-4">
                    {exportState.status === 'idle' && (
                      <button 
                        onClick={handleExportPhotoshop} 
                        className="w-full bg-[#31a8ff]/20 hover:bg-[#31a8ff]/30 text-[#31a8ff] border border-[#31a8ff]/30 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <ImageIcon size={16} /> Ekspor ke Photoshop
                      </button>
                    )}
                    
                    {exportState.status === 'exporting' && (
                      <div className="w-full bg-[#31a8ff]/10 text-[#31a8ff] border border-[#31a8ff]/20 py-2.5 rounded-xl flex justify-center items-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Sedang Mengeksekusi...
                      </div>
                    )}
                    
                    {exportState.status === 'success' && (
                      <div className="w-full bg-green-500/10 text-green-400 border border-green-500/20 py-2.5 rounded-xl text-xs text-center font-bold">
                        Photoshop Berhasil Dijalankan!
                      </div>
                    )}
                    
                    {exportState.status === 'error' && (
                      <div className="w-full bg-red-500/10 text-red-400 p-2 rounded-xl text-xs text-center border border-red-500/20 mt-2">
                        Gagal: {exportState.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Generator Card */}
            <div className="flex flex-col">
              <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/30 rounded-2xl p-6 flex-1 flex flex-col relative overflow-hidden shadow-lg shadow-indigo-500/10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-500/20 text-indigo-400 p-2 rounded-xl">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="font-bold text-indigo-100">AI SEO Copywriter</h3>
                </div>
                
                <p className="text-xs text-indigo-200/60 mb-6">Gunakan Google Gemini AI untuk meracik Judul Clickbait dan Deskripsi AIDA (Attention, Interest, Desire, Action) yang dioptimasi untuk Shopee.</p>

                {aiState.status === 'idle' && (
                  <button onClick={handleGenerateAI} className="mt-auto w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)]">
                    <Sparkles size={18} /> Racik Tulisan Jualan
                  </button>
                )}

                {aiState.status === 'generating' && (
                  <div className="mt-auto flex flex-col items-center justify-center py-6 text-indigo-300 animate-pulse">
                    <Loader2 size={32} className="animate-spin mb-3" />
                    <p className="text-xs font-bold tracking-widest uppercase">Gemini Sedang Berpikir...</p>
                  </div>
                )}

                {aiState.status === 'error' && (
                  <div className="mt-auto bg-red-500/10 text-red-400 p-3 rounded-xl text-xs text-center border border-red-500/20">
                    Gagal: {aiState.error}
                  </div>
                )}

                {aiState.status === 'success' && aiState.result && (
                  <div className="flex flex-col gap-4 animate-in fade-in">
                    <div>
                      <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1 block">Judul Shopee ({aiState.result.title.length}/120)</label>
                      <div className="relative group">
                        <textarea readOnly value={aiState.result.title} className="w-full bg-black/40 border border-indigo-500/30 rounded-xl p-3 text-sm text-white outline-none resize-none h-20" />
                        <button onClick={() => navigator.clipboard.writeText(aiState.result.title)} className="absolute top-2 right-2 p-1.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-200 hover:text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1 block">Deskripsi Produk (AIDA)</label>
                      <div className="relative group">
                        <textarea readOnly value={aiState.result.description} className="w-full bg-black/40 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-100/80 outline-none resize-none h-40 custom-scrollbar" />
                        <button onClick={() => navigator.clipboard.writeText(aiState.result.description)} className="absolute top-2 right-2 p-1.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-200 hover:text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
