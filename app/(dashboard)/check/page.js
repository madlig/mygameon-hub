'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'

export default function CheckPage() {
  const [keyword, setKeyword]   = useState('')
  const [results, setResults]   = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileStats, setFileStats] = useState(null)
  const [isChecking, setIsChecking] = useState(false)

  async function handleSearch() {
    if (keyword.trim().length < 2) return
    setIsSearching(true)
    setFileStats(null)
    setSelectedFile(null)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch (e) {
      console.error(e)
    } finally {
      setIsSearching(false)
    }
  }

  const [error, setError] = useState(null)

async function handleCheck(item) {
  setSelectedFile(item)
  setIsChecking(true)
  setFileStats(null)
  setError(null)

  try {
    const res = await fetch(`/api/check?id=${item.id}`)
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setFileStats(data)
    }
  } catch (e) {
    setError(e.message)
  } finally {
    setIsChecking(false)
  }
}

  return (
    <div>
      <TopBar title="Cek file" />

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Ketik nama game..."
          className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={keyword.length < 2 || isSearching}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {isSearching ? '...' : 'Cek'}
        </button>
      </div>

      {/* Hasil search — pilih file untuk dicek */}
      {results.length > 0 && !fileStats && (
        <div className="mb-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
            Pilih file untuk dicek
          </p>
          <div className="flex flex-col gap-2">
            {results.map(item => (
              <button
                key={item.id}
                onClick={() => handleCheck(item)}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-secondary"
              >
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <span className="text-xs text-primary">Cek →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isChecking && (
        <div className="flex flex-col items-center gap-2 py-12">
          <span className="text-3xl">📂</span>
          <p className="text-sm text-muted-foreground">Mengecek file...</p>
        </div>
      )}

      {/* Hasil cek */}
      {fileStats && !isChecking && (
        <div>
          <div className="rounded-xl border border-border bg-card p-4 mb-3">
            <p className="text-sm font-semibold text-foreground mb-3">
              📁 {fileStats.name}
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total file (root)</span>
                <span className="text-foreground font-medium">{fileStats.root.count} file</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Ukuran total</span>
                <span className="text-foreground font-medium">{fileStats.root.size}</span>
              </div>
            </div>
          </div>

          {fileStats.subfolders.length > 0 && (
            <>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Sub-folder
              </p>
              <div className="flex flex-col gap-2">
                {fileStats.subfolders.map((sub, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <p className="text-sm text-foreground">📂 {sub.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sub.count} file · {sub.size}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          <button
            onClick={() => { setFileStats(null); setSelectedFile(null) }}
            className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            ← Kembali ke hasil pencarian
          </button>
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !fileStats && !isSearching && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="text-3xl">📂</span>
          <p className="text-sm font-medium text-muted-foreground">Cek isi folder game</p>
          <p className="text-xs text-muted-foreground">Ketik nama game lalu tekan Cek</p>
        </div>
      )}
    </div>
  )
}