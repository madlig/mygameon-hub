'use client'

import { useState, useEffect } from 'react'
import { Star, Clock, Package, Plus, Check, X, Trash2, FileBox, Sparkles, TrendingUp } from 'lucide-react'

function GameChip({ item, inCart, onAdd, trailing }) {
  return (
    <div
      className={`group flex shrink-0 snap-start w-[220px] items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
        inCart ? 'border-[var(--primary)]/50 bg-[var(--primary)]/10' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
      }`}
    >
      <button onClick={onAdd} className="flex min-w-0 flex-1 items-center gap-2 text-left" title={inCart ? 'Sudah di keranjang' : 'Tambah ke keranjang'}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--elevated)] text-[var(--text-3)]">
          <FileBox size={13} />
        </span>
        <span className="truncate text-[12.5px] font-semibold text-[var(--text)]">{item.name}</span>
        {inCart ? (
          <Check size={14} className="ml-auto shrink-0 text-[var(--primary)]" />
        ) : (
          <Plus size={14} className="ml-auto shrink-0 text-[var(--text-3)] group-hover:text-[var(--primary)]" />
        )}
      </button>
      {trailing}
    </div>
  )
}

function Section({ icon: Icon, title, accent, count, children }) {
  return (
    <div className="mb-6">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">
        <Icon size={12} style={{ color: accent }} /> {title}
        {count != null && <span className="text-[var(--text-3)]/70">· {count}</span>}
      </p>
      {children}
    </div>
  )
}

const ONBOARD = [
  { icon: Star, accent: '#ffd100', title: 'Favorit', desc: 'Tandai bintang di hasil pencarian untuk kirim cepat berulang.' },
  { icon: Clock, accent: '#60a5fa', title: 'Terakhir dikirim', desc: 'Terisi otomatis tiap kamu mengirim game ke pembeli.' },
  { icon: Package, accent: '#a78bfa', title: 'Paket', desc: 'Simpan satu set game di keranjang jadi paket sekali-klik.' },
]

export default function QuickPick({
  favorites = [], recentGames = [], bundles = [],
  isInCart, onAdd, onAddBundle, onToggleFav, onDeleteBundle,
}) {
  const [smartRecs, setSmartRecs] = useState({ bundles: [], favorites: [] })

  useEffect(() => {
    fetch('/api/analytics/recommendations')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSmartRecs({
            bundles: data.smartBundles || [],
            favorites: data.smartFavorites || []
          })
        }
      })
      .catch(console.error)
  }, [])

  const empty = favorites.length === 0 && recentGames.length === 0 && bundles.length === 0 && smartRecs.bundles.length === 0 && smartRecs.favorites.length === 0

  if (empty) {
    return (
      <div>
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">Akses cepat</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {ONBOARD.map(o => {
            const Icon = o.icon
            return (
              <div key={o.title} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${o.accent}1f`, color: o.accent, boxShadow: `0 0 20px -8px ${o.accent}` }}>
                  <Icon size={19} />
                </span>
                <p className="font-display text-sm font-bold text-[var(--text)]">{o.title}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-3)]">{o.desc}</p>
              </div>
            )
          })}
        </div>
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)]/40 px-4 py-5 text-center">
          <p className="text-[12.5px] text-[var(--text-2)]">Mulai dengan mengetik nama game di kolom pencarian di atas 👆</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {favorites.length > 0 && (
        <Section icon={Star} title="Favorit" accent="var(--primary)" count={favorites.length}>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 snap-x">
            {favorites.map(item => (
              <GameChip
                key={item.id} item={item} inCart={isInCart(item.id)} onAdd={() => onAdd(item)}
                trailing={
                  <button onClick={() => onToggleFav(item)} title="Hapus favorit" className="shrink-0 text-[var(--text-3)] transition-colors hover:text-[var(--danger)]">
                    <X size={14} />
                  </button>
                }
              />
            ))}
          </div>
        </Section>
      )}

      {recentGames.length > 0 && (
        <Section icon={Clock} title="Terakhir dikirim" accent="var(--info)" count={recentGames.length}>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 snap-x">
            {recentGames.map(item => (
              <GameChip key={item.id} item={item} inCart={isInCart(item.id)} onAdd={() => onAdd(item)} />
            ))}
          </div>
        </Section>
      )}

      {bundles.length > 0 && (
        <Section icon={Package} title="Paket" accent="var(--accent)" count={bundles.length}>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 snap-x">
            {bundles.map(b => (
              <div key={b.id} className="flex shrink-0 snap-start w-[280px] items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent-hi)]">
                  <Package size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-[var(--text)]">{b.name}</p>
                  <p className="text-[10px] text-[var(--text-3)]">{b.items.length} game</p>
                </div>
                <button
                  onClick={() => onAddBundle(b)}
                  className="pressable shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[11px] font-bold text-white transition hover:brightness-110"
                >
                  + Tambah
                </button>
                <button onClick={() => onDeleteBundle(b.id)} title="Hapus paket" className="shrink-0 text-[var(--text-3)] transition-colors hover:text-[var(--danger)]">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* SMART RECOMMENDATIONS */}
      {(smartRecs.bundles.length > 0 || smartRecs.favorites.length > 0) && (
          <div className="mt-8 mb-6 border-t border-[var(--border-soft)] pt-6">
             <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--text)]">
                 <Sparkles size={16} className="text-[#fbbf24]" /> AI Smart Insights
             </h3>
             
             {smartRecs.favorites.length > 0 && (
                 <Section icon={TrendingUp} title="Sering Dibeli (Rekomendasi Favorit)" accent="#10b981">
                     <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 snap-x">
                         {smartRecs.favorites.map(item => (
                             <GameChip 
                                 key={item.name} 
                                 item={{ id: item.targetId || item.name, name: item.name, ownerEmail: item.ownerEmail || 'Unknown' }} 
                                 inCart={isInCart(item.targetId || item.name)} 
                                 onAdd={() => onAdd({ id: item.targetId || item.name, name: item.name, ownerEmail: item.ownerEmail || 'Unknown' })}
                                 trailing={
                                     <button onClick={() => onToggleFav({ id: item.targetId || item.name, name: item.name, ownerEmail: item.ownerEmail || 'Unknown' })} title="Jadikan favorit" className="shrink-0 rounded bg-[#10b981]/10 px-2 py-1 text-[10px] font-bold text-[#10b981] hover:bg-[#10b981] hover:text-white transition-colors">
                                         + Favorit
                                     </button>
                                 }
                             />
                         ))}
                     </div>
                 </Section>
             )}

             {smartRecs.bundles.length > 0 && (
                 <Section icon={Package} title="Sering Dibeli Bersamaan (Smart Bundle)" accent="#f43f5e">
                     <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 snap-x">
                         {smartRecs.bundles.map(b => (
                             <div key={b.name} className="flex shrink-0 snap-start w-[280px] items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-gradient-to-br from-[#f43f5e]/5 to-transparent px-3 py-2.5">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f43f5e]/15 text-[#f43f5e]">
                                  <Package size={15} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12.5px] font-bold text-[var(--text)]">{b.name}</p>
                                  <p className="text-[10px] text-[#f43f5e] font-semibold">{b.count}x dibeli bersama</p>
                                </div>
                             </div>
                         ))}
                     </div>
                 </Section>
             )}
          </div>
      )}
    </div>
  )
}
