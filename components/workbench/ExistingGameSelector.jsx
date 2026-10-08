'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Search, ChevronDown, Check, Cloud, AlertCircle, RefreshCw,
  HardDrive, Sparkles, Layers, X
} from 'lucide-react'
import { formatBytes } from '@/lib/utils'

export default function ExistingGameSelector({
  existingGames = [],
  selectedGame = null,
  onSelectGame,
  workspaces = [],
  cleanReplace = true,
  setCleanReplace,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef(null)

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return existingGames.slice(0, 50)
    const q = searchQuery.toLowerCase()
    return existingGames
      .filter((g) => (g.name || g.title || '').toLowerCase().includes(q))
      .slice(0, 50)
  }, [existingGames, searchQuery])

  // Cari info workspace tempat game berada
  const getWorkspaceInfo = (game) => {
    if (!game) return null
    const ownerEmail = game.ownerEmail?.split(',')[0]?.trim() || game.workspaceEmail
    const matched = workspaces.find((w) => w.email === ownerEmail)
    return {
      email: ownerEmail || 'Drive Utama',
      name: matched?.name || ownerEmail?.split('@')[0] || 'Google Drive',
    }
  }

  const selectedWsInfo = selectedGame ? getWorkspaceInfo(selectedGame) : null

  return (
    <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.03] p-4">
      {/* Header Info Update */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw size={15} className="text-amber-400" />
          <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">
            Pilih Game yang Ingin Diupdate Versinya
          </h4>
        </div>
        <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
          Mode Update Versi
        </span>
      </div>

      {/* Custom Dropdown Trigger */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-left transition-all hover:border-amber-400/50 focus:border-amber-400 focus:outline-none"
        >
          {selectedGame ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <Cloud size={15} className="text-amber-400 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-[var(--text)]">{selectedGame.name || selectedGame.title}</span>
                {selectedWsInfo && (
                  <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-3)]">
                    {selectedWsInfo.name}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-[var(--text-4)]">Cari judul game di katalog Google Drive...</span>
          )}
          <ChevronDown size={15} className={`text-[var(--text-4)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu Modal */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[#0d0e14] shadow-2xl backdrop-blur-xl animate-in fade-in duration-150">
            {/* Search Box Inside Dropdown */}
            <div className="p-2 border-b border-white/5 bg-black/40">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik judul game yang sudah terupload..."
                  className="w-full rounded-lg border border-white/10 bg-black/60 pl-8 pr-2.5 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-4)] focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {/* List Games */}
            <div className="max-h-56 overflow-y-auto p-1 divide-y divide-white/[0.03] scrollbar-thin">
              {filteredGames.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-4)]">
                  Game tidak ditemukan di katalog Drive.
                </div>
              ) : (
                filteredGames.map((game) => {
                  const wsInfo = getWorkspaceInfo(game)
                  const isSelected = selectedGame?._id === game._id || selectedGame?.id === game.id

                  return (
                    <div
                      key={game._id || game.id || game.name}
                      onClick={() => {
                        onSelectGame(game)
                        setIsOpen(false)
                        setSearchQuery('')
                      }}
                      className={`flex items-center justify-between rounded-lg p-2.5 text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-400/15 text-amber-300'
                          : 'hover:bg-white/[0.05] text-[var(--text-2)] hover:text-[var(--text)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Cloud size={14} className={isSelected ? 'text-amber-400' : 'text-[var(--text-4)]'} />
                        <div className="truncate">
                          <p className="font-bold truncate">{game.name || game.title}</p>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-4)]">
                            <span>{wsInfo.name}</span>
                            {game.size ? <span>• {formatBytes(game.size)}</span> : null}
                          </div>
                        </div>
                      </div>

                      {isSelected && <Check size={14} className="text-amber-400 shrink-0 ml-2" />}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info Penemuan Game & Workspace */}
      {selectedGame && selectedWsInfo && (
        <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-4)]">Lokasi Workspace:</span>
            <span className="font-mono font-bold text-amber-300">{selectedWsInfo.email}</span>
          </div>

          {/* Toggle Clean Replace */}
          <label className="flex items-start gap-2.5 pt-2 border-t border-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={cleanReplace}
              onChange={(e) => setCleanReplace(e.target.checked)}
              className="mt-0.5 rounded border-white/20 bg-black/40 text-amber-400 focus:ring-0 cursor-pointer"
            />
            <div className="text-[11px] leading-tight">
              <span className="font-bold text-[var(--text)]">Hapus file lama di Drive & ganti dengan yang baru</span>
              <p className="text-[10px] text-[var(--text-4)] mt-0.5">
                File part lama di folder Google Drive tujuan akan dihapus sebelum part baru diunggah untuk menghindari sisa file usang.
              </p>
            </div>
          </label>
        </div>
      )}
    </div>
  )
}
