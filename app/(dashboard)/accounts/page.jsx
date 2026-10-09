'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { useToast } from '@/components/ui/Toast'
import {
  Cloud, HardDrive, CheckCircle2, AlertTriangle, AlertCircle,
  RefreshCw, Plus, Trash2, Edit2, Copy, Folder, Search,
  ChevronDown, ChevronUp, Loader2, Layers, Info, ExternalLink,
  Mail, Send, Key, Check
} from 'lucide-react'

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

export default function DriveAccountsPage() {
  const router = useRouter()
  const { toast } = useToast()

  // Data states
  const [accounts, setAccounts] = useState([])
  const [driveStatus, setDriveStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Gmail states
  const [gmailConfig, setGmailConfig] = useState({ configured: false, adminEmail: '', checking: true })
  const [gmailModal, setGmailModal] = useState({ isOpen: false, appPassword: '', saving: false, error: '', successMsg: '' })
  const [resendingAll, setResendingAll] = useState(false)
  const [resendAllResult, setResendAllResult] = useState(null)

  // Filter & search states
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'safe' | 'limit' | 'error'
  const [showNotice, setShowNotice] = useState(false)

  // Action states
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncingEmail, setSyncingEmail] = useState(null)

  // Modals state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, email: null })
  const [isDeleting, setIsDeleting] = useState(false)

  const [editModal, setEditModal] = useState({ isOpen: false, email: '', gameFolderId: '' })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [copyModal, setCopyModal] = useState({
    isOpen: false,
    sourceEmail: '',
    selectedFileId: '',
    selectedFileName: '',
    targetEmail: '',
    availableFiles: [],
    loadingFiles: false,
    copying: false,
    status: null,
  })

  // Fetch accounts & drive status simultaneously
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [accRes, driveRes, gmailRes] = await Promise.allSettled([
        fetch('/api/accounts').then((r) => r.json()),
        fetch('/api/drive/status?t=' + Date.now()).then((r) => r.json()),
        fetch('/api/accounts/gmail').then((r) => r.json()),
      ])

      if (accRes.status === 'fulfilled' && accRes.value?.accounts) {
        setAccounts(accRes.value.accounts)
      }

      if (driveRes.status === 'fulfilled' && driveRes.value) {
        setDriveStatus(driveRes.value)
      }

      if (gmailRes.status === 'fulfilled' && gmailRes.value) {
        setGmailConfig({
          configured: Boolean(gmailRes.value.configured),
          adminEmail: gmailRes.value.adminEmail || '',
          checking: false
        })
      }
    } catch (err) {
      console.error('Error fetching drive & accounts data:', err)
      toast('Gagal memuat status Drive & akun', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Check URL query parameters on mount for OAuth redirects
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('success') === '1') {
        toast('Akun Google Drive berhasil dihubungkan!', 'success')
        router.replace('/accounts')
      } else if (params.get('error')) {
        const errType = params.get('error')
        toast(`Gagal menghubungkan akun: ${errType}`, 'error')
        router.replace('/accounts')
      }
    }
  }, [router, toast])

  // Merge account data with drive status info
  const mergedWorkspaces = useMemo(() => {
    return accounts.map((acc) => {
      const driveInfo = driveStatus?.workspaces?.find(
        (w) => w.email.toLowerCase() === acc.email.toLowerCase()
      )

      const isDriveLimit = driveInfo?.status === 'limit'
      const isDriveError = driveInfo?.status === 'error' || acc.status !== 'active'

      return {
        ...acc,
        driveInfo,
        isLimit: isDriveLimit,
        isError: isDriveError,
        hasSharedDriveAccess: driveInfo ? driveInfo.hasSharedDriveAccess : true,
        storage: driveInfo?.storage || null,
        totalGames: driveInfo?.allFiles?.length || 0,
        allFiles: driveInfo?.allFiles || [],
        limitReason: driveInfo?.reason || '',
      }
    }).sort((a, b) => a.email.localeCompare(b.email, undefined, { numeric: true }))
  }, [accounts, driveStatus])

  // Filtered workspaces for table
  const filteredWorkspaces = useMemo(() => {
    return mergedWorkspaces.filter((ws) => {
      // Search by email
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!ws.email.toLowerCase().includes(q)) return false
      }

      // Filter by status
      if (filterStatus === 'safe' && (ws.isLimit || ws.isError)) return false
      if (filterStatus === 'limit' && !ws.isLimit) return false
      if (filterStatus === 'error' && !ws.isError) return false

      return true
    })
  }, [mergedWorkspaces, searchQuery, filterStatus])

  // Global summary metrics
  const summaryMetrics = useMemo(() => {
    const total = mergedWorkspaces.length
    const limitedCount = mergedWorkspaces.filter((w) => w.isLimit).length
    const safeCount = mergedWorkspaces.filter((w) => !w.isLimit && !w.isError).length
    const pooled = driveStatus?.globalPooledStorage || null

    return {
      total,
      limitedCount,
      safeCount,
      pooled,
    }
  }, [mergedWorkspaces, driveStatus])

  // Connect Google Account via OAuth
  const handleConnect = () => {
    window.location.href = '/api/auth/google'
  }

  // Sync all catalogs
  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      const res = await fetch('/api/catalog/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const total = (data.results || []).reduce(
          (s, r) => ({ added: s.added + r.added, removed: s.removed + r.removed }),
          { added: 0, removed: 0 }
        )
        const errors = (data.results || []).filter((r) => r.error)
        toast(
          `Sync selesai: +${total.added} baru, -${total.removed} dihapus.${
            errors.length > 0 ? ` (${errors.length} gagal)` : ''
          }`,
          errors.length > 0 ? 'warning' : 'success'
        )
      } else {
        toast(data.error || 'Gagal sinkronisasi semua katalog', 'error')
      }
      loadData(true)
    } catch (err) {
      toast('Gagal terhubung ke server', 'error')
    } finally {
      setSyncingAll(false)
    }
  }

  // Sync single account
  const handleSyncOne = async (email) => {
    setSyncingEmail(email)
    try {
      const res = await fetch('/api/catalog/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        toast(`Sync ${email} selesai: +${data.added} baru, -${data.removed} dihapus.`, 'success')
        loadData(true)
      } else {
        toast(data.error || `Gagal sync ${email}`, 'error')
      }
    } catch (err) {
      toast('Terjadi kesalahan sistem saat sync', 'error')
    } finally {
      setSyncingEmail(null)
    }
  }

  // Edit folder ID
  const handleEditClick = (ws) => {
    setEditModal({ isOpen: true, email: ws.email, gameFolderId: ws.gameFolderId || 'root' })
  }

  const saveEdit = async () => {
    setIsSavingEdit(true)
    try {
      const res = await fetch('/api/accounts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editModal.email, gameFolderId: editModal.gameFolderId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast(data.message || 'Folder ID berhasil diperbarui', 'success')
        setEditModal({ isOpen: false, email: '', gameFolderId: '' })
        loadData(true)
      } else {
        toast(data.error || 'Gagal menyimpan perubahan folder', 'error')
      }
    } catch (error) {
      toast('Terjadi kesalahan sistem', 'error')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Delete account
  const handleDeleteClick = (email) => {
    setDeleteConfirm({ isOpen: true, email })
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: deleteConfirm.email }),
      })
      const data = await res.json()
      if (res.ok) {
        toast(`Akun ${deleteConfirm.email} berhasil dihapus`, 'success')
        setDeleteConfirm({ isOpen: false, email: null })
        loadData(true)
      } else {
        toast(data.error || 'Gagal menghapus akun', 'error')
      }
    } catch (err) {
      toast('Terjadi kesalahan sistem saat menghapus akun', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // Open Auto-Copy modal
  const openCopyModalForWs = (ws) => {
    const files = ws.allFiles || []
    setCopyModal({
      isOpen: true,
      sourceEmail: ws.email,
      selectedFileId: files[0]?.id || '',
      selectedFileName: files[0]?.name || '',
      targetEmail: '',
      availableFiles: files,
      loadingFiles: false,
      copying: false,
      status: null,
    })
  }

  const handleExecuteCopy = async () => {
    if (!copyModal.selectedFileId || !copyModal.targetEmail) {
      toast('Pilih file dan workspace tujuan terlebih dahulu', 'warning')
      return
    }

    setCopyModal((prev) => ({ ...prev, copying: true, status: null }))
    try {
      const res = await fetch('/api/drive/auto-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFileId: copyModal.selectedFileId,
          sourceFileName: copyModal.selectedFileName,
          targetEmail: copyModal.targetEmail,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal menyalin folder game')

      setCopyModal((prev) => ({
        ...prev,
        status: { type: 'success', message: 'Folder game berhasil disalin ke workspace tujuan!' },
      }))
      toast('Game berhasil disalin!', 'success')
      loadData(true)
    } catch (err) {
      setCopyModal((prev) => ({
        ...prev,
        status: { type: 'error', message: err.message },
      }))
    } finally {
      setCopyModal((prev) => ({ ...prev, copying: false }))
    }
  }

  const handleSaveGmailPassword = async () => {
    if (!gmailModal.appPassword.trim()) {
      toast('Sandi aplikasi tidak boleh kosong', 'warning')
      return
    }
    setGmailModal((prev) => ({ ...prev, saving: true, error: '', successMsg: '' }))
    try {
      const res = await fetch('/api/accounts/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appPassword: gmailModal.appPassword })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast('Koneksi Gmail berhasil diverifikasi!', 'success')
        setGmailConfig((prev) => ({ ...prev, configured: true }))
        setGmailModal((prev) => ({ ...prev, saving: false, successMsg: data.message, appPassword: '' }))
      } else {
        setGmailModal((prev) => ({ ...prev, saving: false, error: data.error || 'Gagal memverifikasi' }))
      }
    } catch (err) {
      setGmailModal((prev) => ({ ...prev, saving: false, error: err.message || 'Koneksi error' }))
    }
  }

  const handleResendAllToday = async () => {
    setResendingAll(true)
    setResendAllResult(null)
    try {
      const res = await fetch('/api/send/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resendAllRecent: true })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast(`Sukses: ${data.message}`, 'success')
        setResendAllResult({ success: true, message: data.message, count: data.successCount })
      } else {
        toast(data.error || 'Gagal mengirim ulang', 'error')
        setResendAllResult({ success: false, message: data.error || 'Gagal' })
      }
    } catch (err) {
      toast(err.message || 'Koneksi error', 'error')
    } finally {
      setResendingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      <TopBar title="Drive & Workspace" backHref="/" />

      {/* 🏷️ Header & Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-[var(--text)]" style={{ fontFamily: 'var(--font-display)' }}>
            Drive & Akun Workspace
          </h1>
          <p className="mt-1 text-xs text-[var(--text-3)] font-medium">
            Pusat monitoring kapasitas storage, status kuota limit, dan manajemen akun Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Status / Setting Gmail Admin */}
          <button
            onClick={() => setGmailModal((prev) => ({ ...prev, isOpen: true, error: '', successMsg: '' }))}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
              gmailConfig.configured
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 animate-pulse'
            }`}
            title="Kelola Kredensial Pengiriman Email Gmail Admin"
          >
            <Mail size={14} />
            <span>{gmailConfig.configured ? 'Gmail Aktif' : 'Atur Gmail Admin'}</span>
          </button>

          <button
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-colors disabled:opacity-50"
            title="Refresh status drive & akun"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-[var(--primary)]' : ''} />
            <span className="hidden sm:inline">{refreshing ? 'Menyinkronkan...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleSyncAll}
            disabled={syncingAll || accounts.length === 0}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-[var(--text-2)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-50"
            title="Sinkronisasi katalog game dari seluruh workspace"
          >
            {syncingAll ? <Loader2 size={14} className="animate-spin text-[var(--primary)]" /> : <Layers size={14} />}
            <span>Sync Semua Katalog</span>
          </button>

          <button
            onClick={handleConnect}
            className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--primary-fg)] shadow-[0_4px_15px_-4px_rgba(255,209,0,0.5)] hover:brightness-110 transition-all"
            title="Hubungkan akun Google Drive baru melalui OAuth"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Hubungkan Akun</span>
          </button>
        </div>
      </div>

      {/* 📊 Global Summary Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1: Pooled Storage */}
        {summaryMetrics.pooled ? (
          <div className="rounded-2xl border border-white/5 bg-[var(--surface)] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-1.5">
                <HardDrive size={13} className="text-blue-400" /> Pooled Storage
              </span>
              <span className={`text-[10px] font-mono font-bold ${summaryMetrics.pooled.percentage > 90 ? 'text-red-400' : 'text-blue-400'}`}>
                {summaryMetrics.pooled.percentage}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  summaryMetrics.pooled.percentage > 90 ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${summaryMetrics.pooled.percentage}%` }}
              />
            </div>
            <p className="text-[11px] font-mono font-bold text-[var(--text-2)]">
              {summaryMetrics.pooled.usageGB} / {summaryMetrics.pooled.limitGB} GB
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-[var(--surface)] p-4 shadow-xl">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">
              <HardDrive size={13} className="text-blue-400" /> Storage Global
            </div>
            <p className="text-xs text-[var(--text-3)]">Multi-Workspace Standalone</p>
            <p className="text-[10px] font-mono text-[var(--text-4)] mt-1">Tanpa Pooled Enterprise</p>
          </div>
        )}

        {/* Card 2: Total Workspace */}
        <div className="rounded-2xl border border-white/5 bg-[var(--surface)] p-4 shadow-xl">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-1">
            <Cloud size={13} className="text-[var(--primary)]" /> Total Workspace
          </div>
          <div className="mt-2 text-2xl font-black text-[var(--text)] font-mono">
            {summaryMetrics.total}
          </div>
          <p className="text-[10px] text-[var(--text-4)] mt-0.5">Akun terdaftar</p>
        </div>

        {/* Card 3: Workspace Aman */}
        <div className="rounded-2xl border border-white/5 bg-[var(--surface)] p-4 shadow-xl">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
            <CheckCircle2 size={13} /> Workspace Aman
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">
            {summaryMetrics.safeCount}
          </div>
          <p className="text-[10px] text-[var(--text-4)] mt-0.5">Siap download normal</p>
        </div>

        {/* Card 4: Terkena Limit */}
        <div className={`rounded-2xl border p-4 shadow-xl transition-all relative overflow-hidden ${
          summaryMetrics.limitedCount > 0
            ? 'border-red-500/30 bg-red-500/10'
            : 'border-white/5 bg-[var(--surface)]'
        }`}>
          {summaryMetrics.limitedCount > 0 && (
            <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
          )}
          <div className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">
            <AlertTriangle size={13} /> Terkena Limit
          </div>
          <div className={`relative mt-2 text-2xl font-black font-mono ${
            summaryMetrics.limitedCount > 0 ? 'text-red-400 animate-pulse' : 'text-[var(--text-3)]'
          }`}>
            {summaryMetrics.limitedCount}
          </div>
          <p className="relative text-[10px] text-[var(--text-4)] mt-0.5">
            {summaryMetrics.limitedCount > 0 ? 'Perlu tindakan copy/bypass' : 'Nihil akun ter-limit'}
          </p>
        </div>
      </div>

      {/* 💡 Collapsible Notice: Info Kuota Download vs Kapasitas Storage */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 transition-all">
        <button
          onClick={() => setShowNotice(!showNotice)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Info size={15} className="text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-amber-300">
              Penting: Tentang Limit Kuota Download Google vs Kapasitas Storage
            </span>
          </div>
          <span className="text-xs text-amber-400/80 flex items-center gap-1 font-semibold">
            {showNotice ? 'Sembunyikan' : 'Pelajari'}
            {showNotice ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {showNotice && (
          <div className="mt-3 text-xs text-amber-200/80 leading-relaxed border-t border-amber-500/10 pt-3 animate-in fade-in">
            <p>
              Halaman ini memantau <strong>Kapasitas Storage</strong> (ruang penyimpanan) sekaligus mendeteksi <strong>Limit Kuota Download</strong> (bandwidth 24 jam). Google Drive tidak menyediakan API resmi kuota download, sehingga sistem menggunakan deteksi sampel biner berkala.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-md bg-amber-500/20 px-2 py-1 font-semibold text-amber-200">
                Solusi 1: Minta customer buat Shortcut ke My Drive mereka & download dari folder shortcut
              </span>
              <span className="rounded-md bg-amber-500/20 px-2 py-1 font-semibold text-amber-200">
                Solusi 2: Gunakan tombol Auto-Copy pada tabel di bawah untuk menyalin game ke workspace yang aman
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 🔍 Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari email workspace..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-xs font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-4)] focus:border-[var(--primary)] focus:bg-white/[0.07] transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'Semua Akun' },
            { id: 'safe', label: 'Aman' },
            { id: 'limit', label: 'Limit Terdeteksi' },
            { id: 'error', label: 'Perlu Perhatian' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterStatus(pill.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                filterStatus === pill.id
                  ? 'bg-white/15 text-[var(--text)] shadow-sm'
                  : 'bg-white/5 text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text-2)]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 🏢 Unified Workspaces Table */}
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[var(--surface)] shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/5 bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">
              <tr>
                <th className="px-5 py-3.5">Email Workspace</th>
                <th className="px-5 py-3.5 min-w-[200px]">Kapasitas Storage</th>
                <th className="px-5 py-3.5">Status Kuota & Game</th>
                <th className="px-5 py-3.5">Terakhir Sync</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-[var(--text-3)]">
                    <Loader2 size={24} className="animate-spin text-[var(--primary)] mx-auto mb-2" />
                    Memuat data akun & status Google Drive...
                  </td>
                </tr>
              ) : filteredWorkspaces.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-[var(--text-4)]">
                    {searchQuery.trim() || filterStatus !== 'all'
                      ? 'Tidak ada workspace yang sesuai dengan pencarian/filter.'
                      : 'Belum ada akun Google Drive yang terhubung.'}
                  </td>
                </tr>
              ) : (
                filteredWorkspaces.map((ws) => {
                  const storage = ws.storage
                  const percent = storage ? storage.percentage : 0
                  const isHighUsage = percent > 90
                  const isWarnUsage = percent > 80 && percent <= 90

                  return (
                    <tr
                      key={ws._id || ws.email}
                      className="group transition-colors hover:bg-white/[0.02]"
                    >
                      {/* Email Workspace */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text)] font-mono text-xs">
                              {ws.email}
                            </span>
                            {ws.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400 border border-red-500/20">
                                <AlertCircle size={10} />
                                Token Error
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-4)]">
                            {/* Target Folder Chip */}
                            <span
                              onClick={() => handleEditClick(ws)}
                              className="cursor-pointer font-mono hover:text-[var(--text-2)] transition-colors"
                              title="Klik untuk mengubah Folder ID"
                            >
                              Folder: <code>{ws.gameFolderId || 'root'}</code>
                            </span>

                            {/* Shared Drive Warning Badge */}
                            {!ws.hasSharedDriveAccess && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/20" title="Belum memiliki akses ke Shared Drive KEBERSAMAAN">
                                <AlertTriangle size={9} />
                                No KEBERSAMAAN
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kapasitas Storage */}
                      <td className="px-5 py-4">
                        {storage ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="font-semibold text-[var(--text-2)]">
                                {storage.usageGB} GB / {storage.limitGB} GB
                              </span>
                              <span
                                className={`font-bold ${
                                  isHighUsage
                                    ? 'text-red-400'
                                    : isWarnUsage
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {percent}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isHighUsage
                                    ? 'bg-red-500'
                                    : isWarnUsage
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[var(--text-4)] flex items-center gap-1.5">
                            <Loader2 size={12} className="animate-spin text-[var(--text-4)]" />
                            <span>Mengecek storage...</span>
                          </div>
                        )}
                      </td>

                      {/* Status Kuota & File */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div>
                            {ws.isLimit ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                                LIMIT TERDETEKSI
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Aman
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-medium text-[var(--text-3)] font-mono">
                            {ws.totalGames} Game di Katalog
                          </span>
                        </div>
                      </td>

                      {/* Terakhir Sync */}
                      <td className="px-5 py-4 text-[var(--text-3)] text-xs">
                        {timeAgo(ws.lastCatalogSync)}
                      </td>

                      {/* Aksi */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* 📁 Buka di File Manager */}
                          <Link
                            href={`/files?email=${encodeURIComponent(ws.email)}`}
                            className="rounded-lg p-2 text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text)] transition-colors"
                            title="Buka dan jelajahi file di File Manager"
                          >
                            <Folder size={15} />
                          </Link>

                          {/* 🔄 Sync Katalog per akun */}
                          <button
                            onClick={() => handleSyncOne(ws.email)}
                            disabled={syncingEmail === ws.email || syncingAll}
                            className="rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors disabled:opacity-50"
                            title="Sync katalog game untuk akun ini"
                          >
                            {syncingEmail === ws.email ? (
                              <Loader2 size={15} className="animate-spin text-[var(--primary)]" />
                            ) : (
                              <RefreshCw size={15} />
                            )}
                          </button>

                          {/* 📋 Auto-Copy Game */}
                          <button
                            onClick={() => openCopyModalForWs(ws)}
                            className={`rounded-lg p-2 transition-colors ${
                              ws.isLimit
                                ? 'text-amber-400 hover:bg-amber-400/10'
                                : 'text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text)]'
                            }`}
                            title="Auto-copy / clone game ke workspace lain"
                          >
                            <Copy size={15} />
                          </button>

                          {/* ✏️ Edit Target Folder ID */}
                          <button
                            onClick={() => handleEditClick(ws)}
                            className="rounded-lg p-2 text-[var(--text-3)] hover:bg-amber-400/10 hover:text-amber-400 transition-colors"
                            title="Edit Target Folder ID"
                          >
                            <Edit2 size={15} />
                          </button>

                          {/* 🗑️ Hapus Akun */}
                          <button
                            onClick={() => handleDeleteClick(ws.email)}
                            className="rounded-lg p-2 text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            title="Hapus akun workspace"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📋 Modal Auto-Copy Game */}
      {copyModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Copy size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Auto-Copy Game</h3>
                <p className="text-xs text-[var(--text-3)]">
                  Dari: <strong>{copyModal.sourceEmail}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-2)] leading-relaxed">
              Buat salinan game ke workspace lain yang statusnya aman untuk mengatasi limit unduhan pelanggan.
            </p>

            {/* Pilih File Game */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                Pilih Folder Game
              </label>
              {copyModal.availableFiles.length > 0 ? (
                <select
                  value={copyModal.selectedFileId}
                  onChange={(e) => {
                    const sel = copyModal.availableFiles.find((f) => f.id === e.target.value)
                    setCopyModal((prev) => ({
                      ...prev,
                      selectedFileId: e.target.value,
                      selectedFileName: sel?.name || '',
                    }))
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[var(--elevated)] px-3.5 py-2.5 text-xs font-medium text-[var(--text)] outline-none focus:border-[var(--primary)]"
                >
                  {copyModal.availableFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="ID folder game..."
                  value={copyModal.selectedFileId}
                  onChange={(e) =>
                    setCopyModal((prev) => ({ ...prev, selectedFileId: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-[var(--elevated)] px-3.5 py-2.5 text-xs text-[var(--text)] outline-none focus:border-[var(--primary)]"
                />
              )}
            </div>

            {/* Pilih Target Workspace */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                Workspace Tujuan (Aman)
              </label>
              <select
                value={copyModal.targetEmail}
                onChange={(e) =>
                  setCopyModal((prev) => ({ ...prev, targetEmail: e.target.value }))
                }
                className="w-full rounded-xl border border-white/10 bg-[var(--elevated)] px-3.5 py-2.5 text-xs font-medium text-[var(--text)] outline-none focus:border-[var(--primary)]"
              >
                <option value="">-- Pilih Workspace Tujuan --</option>
                {accounts
                  .filter((a) => a.email !== copyModal.sourceEmail && a.status === 'active')
                  .map((acc) => (
                    <option key={acc.email} value={acc.email}>
                      {acc.email}
                    </option>
                  ))}
              </select>
            </div>

            {copyModal.status && (
              <div
                className={`rounded-xl border p-3 text-xs leading-relaxed ${
                  copyModal.status.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/20 bg-red-500/10 text-red-300'
                }`}
              >
                {copyModal.status.message}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => setCopyModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={copyModal.copying}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Tutup
              </button>
              <button
                onClick={handleExecuteCopy}
                disabled={!copyModal.targetEmail || !copyModal.selectedFileId || copyModal.copying}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {copyModal.copying ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Copy size={14} />
                )}
                <span>{copyModal.copying ? 'Menyalin...' : 'Copy Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Modal Edit Folder ID */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <Edit2 size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Target Folder ID</h3>
                <p className="text-xs text-[var(--text-3)]">
                  Sumber sync untuk: <strong>{editModal.email}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                Folder ID (Pisahkan koma untuk multi-folder)
              </label>
              <input
                type="text"
                value={editModal.gameFolderId}
                onChange={(e) => setEditModal({ ...editModal, gameFolderId: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[var(--elevated)] px-4 py-2.5 text-xs text-[var(--text)] outline-none focus:border-[var(--primary)] transition-all font-mono"
                placeholder="Contoh: root, 1mthLPfYB9amtp..."
              />
              <p className="text-[11px] text-[var(--text-4)] leading-relaxed">
                Gunakan <code>root</code> untuk membaca <i>My Drive</i>. Untuk memasukkan <i>Shared Drive</i> KEBERSAMAAN, tambahkan koma lalu paste ID folder tersebut.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => setEditModal({ isOpen: false, email: '', gameFolderId: '' })}
                disabled={isSavingEdit}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={saveEdit}
                disabled={isSavingEdit}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--primary-fg)] hover:brightness-110 transition-all disabled:opacity-50"
              >
                {isSavingEdit && <Loader2 size={14} className="animate-spin" />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ Modal Konfirmasi Hapus Akun */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[var(--surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Hapus Workspace</h3>
                <p className="text-xs text-[var(--text-3)]">Konfirmasi penghapusan</p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-2)] leading-relaxed">
              Apakah Anda yakin ingin menghapus <strong>{deleteConfirm.email}</strong>? Semua riwayat katalog game dari akun ini akan ikut dihapus dari database.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, email: null })}
                disabled={isDeleting}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                <span>Ya, Hapus Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📧 Modal Konfigurasi Gmail Admin */}
      {gmailModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text)]">Gmail Pengirim Notifikasi</h3>
                  <p className="text-xs text-[var(--text-3)] font-mono">{gmailConfig.adminEmail || 'mygameonhub@gmail.com'}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                gmailConfig.configured ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
              }`}>
                {gmailConfig.configured ? <Check size={12} strokeWidth={3} /> : <AlertTriangle size={12} />}
                <span>{gmailConfig.configured ? 'Aktif Permanen' : 'Perlu Konfigurasi'}</span>
              </span>
            </div>

            {/* Panduan Pembuatan Sandi Aplikasi */}
            <div className="rounded-xl border border-white/5 bg-[var(--elevated)]/60 p-3.5 space-y-2 text-xs text-[var(--text-2)] leading-relaxed">
              <p className="font-bold text-[var(--text)] flex items-center gap-1.5">
                <Key size={14} className="text-[var(--primary)]" />
                Cara Mendapatkan Sandi Aplikasi Google (1 Menit):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-[var(--text-3)]">
                <li>Buka <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-[var(--primary)] font-bold hover:underline inline-flex items-center gap-0.5">myaccount.google.com/apppasswords <ExternalLink size={10} /></a> di tab baru.</li>
                <li>Pastikan login dengan akun <strong className="text-[var(--text)]">{gmailConfig.adminEmail || 'mygameonhub@gmail.com'}</strong>.</li>
                <li>Beri nama aplikasi: <strong className="text-[var(--text)]">MyGameON Hub</strong> lalu klik <em>Buat</em>.</li>
                <li>Salin 16 karakter sandi yang muncul (misal: <code>abcd efgh ijkl mnop</code>) dan tempel di bawah.</li>
              </ol>
            </div>

            {/* Input Sandi Aplikasi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-2)]">Sandi Aplikasi Google (16 Karakter):</label>
              <input
                type="password"
                placeholder="abcd efgh ijkl mnop"
                value={gmailModal.appPassword}
                onChange={(e) => setGmailModal((prev) => ({ ...prev, appPassword: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--elevated)] px-3.5 py-2.5 text-xs font-mono text-[var(--text)] placeholder-[var(--text-4)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            {/* Pesan Sukses / Error */}
            {gmailModal.error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">{gmailModal.error}</p>
            )}
            {gmailModal.successMsg && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">{gmailModal.successMsg}</p>
            )}

            {/* Tombol Resend Batch jika sudah aktif */}
            {gmailConfig.configured && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[var(--text)]">Kirim Ulang Pesanan Tertunda</p>
                  <p className="text-[10.5px] text-[var(--text-3)]">Kirim ulang email untuk pesanan 24 jam terakhir.</p>
                </div>
                <button
                  type="button"
                  onClick={handleResendAllToday}
                  disabled={resendingAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-[var(--primary)] text-black hover:brightness-105 disabled:opacity-50"
                >
                  {resendingAll ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>{resendingAll ? 'Mengirim...' : 'Kirim Ulang Semua Hari Ini'}</span>
                </button>
              </div>
            )}
            {resendAllResult && (
              <p className={`text-xs p-2 rounded-lg font-medium ${resendAllResult.success ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                {resendAllResult.message}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setGmailModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={gmailModal.saving}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5 transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSaveGmailPassword}
                disabled={gmailModal.saving}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--primary-fg)] hover:brightness-110 transition-all disabled:opacity-50"
              >
                {gmailModal.saving && <Loader2 size={14} className="animate-spin" />}
                <span>Verifikasi &amp; Simpan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
