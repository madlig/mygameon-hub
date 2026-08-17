'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'

function timeAgo(iso) {
  if (!iso) return 'Belum pernah'
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff)) return '-'
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  if (hours < 24) return `${hours} jam lalu`
  return `${days} hari lalu`
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncingEmail, setSyncingEmail] = useState(null)
  const [syncMessage, setSyncMessage] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, email: null })
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const data = await res.json()
        const sortedAccounts = (data.accounts || []).sort((a, b) => a.email.localeCompare(b.email, undefined, { numeric: true }))
        setAccounts(sortedAccounts)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleConnect = () => {
    window.location.href = '/api/auth/google'
  }

  const handleSyncOne = async (email) => {
    setSyncingEmail(email)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/catalog/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (res.ok) {
        setSyncMessage({
          type: 'success',
          text: `Sync ${email} selesai: ${data.added} baru, ${data.removed} dihapus.`
        })
        fetchAccounts()
      } else {
        setSyncMessage({ type: 'error', text: data.error || 'Gagal sync' })
      }
    } catch (error) {
      setSyncMessage({ type: 'error', text: 'Terjadi kesalahan sistem.' })
    } finally {
      setSyncingEmail(null)
    }
  }

  const handleDeleteClick = (email) => {
    setDeleteConfirm({ isOpen: true, email })
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: deleteConfirm.email })
      })
      
      if (res.ok) {
        setSyncMessage({ type: 'success', text: `Akun ${deleteConfirm.email} berhasil dihapus.` })
        fetchAccounts()
      } else {
        const data = await res.json()
        setSyncMessage({ type: 'error', text: data.error || 'Gagal menghapus akun' })
      }
    } catch (error) {
      setSyncMessage({ type: 'error', text: 'Terjadi kesalahan saat menghapus akun' })
    } finally {
      setIsDeleting(false)
      setDeleteConfirm({ isOpen: false, email: null })
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/catalog/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const total = (data.results || []).reduce((s, r) => ({ added: s.added + r.added, removed: s.removed + r.removed }), { added: 0, removed: 0 })
        const errors = (data.results || []).filter(r => r.error)
        setSyncMessage({
          type: errors.length > 0 ? 'error' : 'success',
          text: `Sync selesai: ${total.added} game baru, ${total.removed} dihapus.${errors.length > 0 ? ` ${errors.length} workspace gagal: ${errors.map(e => e.email).join(', ')}.` : ''}`
        })
      } else {
        setSyncMessage({ type: 'error', text: data.error || 'Gagal sync' })
      }
      fetchAccounts()
    } catch (err) {
      setSyncMessage({ type: 'error', text: 'Gagal terhubung ke server.' })
    } finally {
      setSyncingAll(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Kelola Akun Workspace" />

      <div className="flex-1 overflow-y-auto px-[var(--pad-card)] pb-[var(--pad-card)]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">Akun Terhubung</h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Daftar akun workspace yang tokennya sudah tersimpan di database.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSyncAll}
              disabled={syncingAll || accounts.length === 0}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
            >
              {syncingAll ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Sync Semua
            </button>
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
            >
              <Plus size={16} />
              Hubungkan Akun
            </button>
          </div>
        </div>

        {/* Sync message */}
        {syncMessage && (
          <div className={`mb-4 flex items-start gap-1.5 rounded-xl border px-4 py-3 text-sm ${
            syncMessage.type === 'success'
              ? 'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}>
            {syncMessage.type === 'success' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
            {syncMessage.text}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--elevated)]/50 text-[var(--text-2)]">
              <tr>
                <th className="px-5 py-3 font-medium">Email Workspace</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Terakhir Sync</th>
                <th className="px-5 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-5 py-8 text-center text-[var(--text-3)]">
                    Memuat data...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-5 py-8 text-center text-[var(--text-3)]">
                    Belum ada akun yang terhubung.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc._id} className="transition-colors hover:bg-[var(--elevated)]/30">
                    <td className="px-5 py-4 font-medium text-[var(--text)]">{acc.email}</td>
                    <td className="px-5 py-4">
                      {acc.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/10 px-2.5 py-1 text-xs font-medium text-[#10b981]">
                          <CheckCircle2 size={14} />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500">
                          <AlertCircle size={14} />
                          Error
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[var(--text-3)] text-xs">
                      {timeAgo(acc.lastCatalogSync)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleSyncOne(acc.email)}
                          disabled={syncingEmail === acc.email || syncingAll}
                          className="rounded p-2 text-[var(--text-3)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors disabled:opacity-50"
                          title="Sync katalog game"
                        >
                          {syncingEmail === acc.email ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        </button>
                        <button onClick={() => handleDeleteClick(acc.email)} className="rounded p-2 text-red-500 hover:bg-red-500/10 transition-colors" title="Hapus akun">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl p-6 transform transition-all">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)]">Hapus Workspace</h3>
            </div>
            <p className="mb-6 text-sm text-[var(--text-2)] leading-relaxed">
              Yakin ingin menghapus akun <strong className="text-[var(--text)]">{deleteConfirm.email}</strong>? 
              Semua game dari workspace ini juga akan dihapus dari hasil pencarian.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, email: null })}
                disabled={isDeleting}
                className="rounded-xl border border-[var(--border-soft)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--elevated)] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50 shadow-lg shadow-red-500/20"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
