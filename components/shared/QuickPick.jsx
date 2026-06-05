'use client'

import { Star, Clock, Package, Plus, Check, X, Trash2, FileBox, Link2 } from 'lucide-react'

function GameChip({ item, inCart, onAdd, trailing }) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
        inCart ? 'border-[var(--primary)]/50 bg-[var(--primary)]/10' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
      }`}
    >
      <button onClick={onAdd} className="flex min-w-0 flex-1 items-center gap-2 text-left" title={inCart ? 'Sudah di keranjang' : 'Tambah ke keranjang'}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--elevated)] text-[var(--text-3)]">
          {item.isShortcut ? <Link2 size={13} /> : <FileBox size={13} />}
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
      <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">
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
  const empty = favorites.length === 0 && recentGames.length === 0 && bundles.length === 0

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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {recentGames.map(item => (
              <GameChip key={item.id} item={item} inCart={isInCart(item.id)} onAdd={() => onAdd(item)} />
            ))}
          </div>
        </Section>
      )}

      {bundles.length > 0 && (
        <Section icon={Package} title="Paket" accent="var(--accent)" count={bundles.length}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {bundles.map(b => (
              <div key={b.id} className="flex items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5">
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
    </div>
  )
}
