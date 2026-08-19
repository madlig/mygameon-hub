import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Save, Loader2, Info } from 'lucide-react'

export default function BonusSettingsModal({ onClose }) {
  const [rules, setRules] = useState([])
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/settings/bonus')
      .then(res => res.json())
      .then(data => {
        if (data.config) {
          setRules(data.config.rules || [])
          setIsActive(data.config.isActive)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError('Gagal memuat pengaturan bonus')
        setLoading(false)
      })
  }, [])

  const addRule = () => {
    setRules([...rules, { buyMin: 0, getBonus: 0 }])
  }

  const updateRule = (index, field, value) => {
    const newRules = [...rules]
    newRules[index][field] = Number(value)
    setRules(newRules)
  }

  const removeRule = (index) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    try {
      // Urutkan dari terbesar ke terkecil agar evaluasinya mudah
      const sortedRules = [...rules].sort((a, b) => b.buyMin - a.buyMin)

      const res = await fetch('/api/settings/bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: sortedRules, isActive })
      })
      
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      
      onClose()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-white/5 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-[var(--text)]">Pengaturan Skema Bonus</h2>
            <p className="text-xs font-medium text-[var(--text-3)] mt-1">Atur program "Beli X Gratis Y"</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-500 flex items-center gap-2">
              <Info size={14} /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--primary)]" size={32} /></div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--border-soft)] bg-white/5 p-4">
                <div>
                  <h3 className="font-bold text-sm text-[var(--text)]">Status Program Bonus</h3>
                  <p className="text-[11px] text-[var(--text-3)] mt-0.5">Jika dimatikan, pesanan baru tidak akan mendapat bonus.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                  <div className="peer h-6 w-11 rounded-full bg-[var(--border-strong)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[var(--primary)] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[var(--text-2)]">Daftar Skema</h3>
                  <button onClick={addRule} className="flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] hover:text-white transition-colors">
                    <Plus size={14} /> Tambah Aturan
                  </button>
                </div>

                {rules.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--border-strong)] py-8 text-center text-xs font-medium text-[var(--text-4)]">
                    Belum ada aturan bonus.
                  </div>
                ) : (
                  rules.map((rule, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex-1 rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-4 py-2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-3)]">Min Beli</span>
                          <input 
                            type="number" min="1" 
                            className="w-16 rounded-md border border-[var(--border-strong)] bg-black/30 px-2 py-1 text-sm font-bold text-white outline-none focus:border-[var(--primary)]"
                            value={rule.buyMin}
                            onChange={(e) => updateRule(index, 'buyMin', e.target.value)}
                          />
                        </div>
                        <div className="text-[var(--text-4)]"><Plus size={14} /></div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-3)]">Dapat</span>
                          <input 
                            type="number" min="1" 
                            className="w-16 rounded-md border border-[var(--border-strong)] bg-black/30 px-2 py-1 text-sm font-bold text-[var(--primary)] outline-none focus:border-[var(--primary)]"
                            value={rule.getBonus}
                            onChange={(e) => updateRule(index, 'getBonus', e.target.value)}
                          />
                          <span className="text-xs font-bold text-[var(--text-3)]">Bonus</span>
                        </div>
                      </div>
                      <button onClick={() => removeRule(index)} className="rounded-xl p-3 text-[var(--text-4)] hover:bg-red-500/10 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
                <p className="text-[10px] text-[var(--text-4)] mt-2 italic">
                  * Sistem akan otomatis mengevaluasi aturan dari jumlah "Min Beli" yang paling besar terlebih dahulu.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
                <button onClick={onClose} className="rounded-xl px-5 py-2 text-xs font-bold text-[var(--text-2)] hover:text-white transition-colors">
                  Batal
                </button>
                <button 
                  onClick={saveSettings} 
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-2 text-xs font-black text-[var(--primary-fg)] transition-transform hover:scale-105 hover:shadow-[0_0_20px_rgba(255,209,0,0.4)] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Simpan Pengaturan
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
