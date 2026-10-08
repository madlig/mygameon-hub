'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Folder, Layers, Search, RefreshCw, HardDrive, ArrowRightLeft,
  Copy, Trash2, Plus, ExternalLink, AlertTriangle, CheckCircle2,
  Loader2, Filter, Sparkles, ArrowUpDown, ShieldCheck, HelpCircle, Globe,
  ChevronDown, Check, MoreVertical, Clock, CheckSquare
} from 'lucide-react';

import FileInspectModal from '@/components/files/FileInspectModal';
import FileMoveModal from '@/components/files/FileMoveModal';
import FileCopyModal from '@/components/files/FileCopyModal';
import FileDeleteModal from '@/components/files/FileDeleteModal';
import WorkspaceDrivePicker from '@/components/studio/WorkspaceDrivePicker';

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Nama (A - Z)' },
  { value: 'size_desc', label: 'Ukuran (Terbesar)' },
  { value: 'parts_desc', label: 'Jumlah Part (Terbanyak)' },
];

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatSyncTime(dateString) {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return null;
  }
}

export default function FileManagerPage() {
  const router = useRouter();

  // State Workspaces
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // State Files
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [isLiveScan, setIsLiveScan] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCatalog, setFilterCatalog] = useState('all'); // 'all', 'cataloged', 'orphan'
  const [sortBy, setSortBy] = useState('name_asc'); // 'name_asc', 'size_desc', 'parts_desc'
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);

  // Multi-select & Bulk operations
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkRegistering, setIsBulkRegistering] = useState(false);

  // Row action menu popover
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Click-outside listener untuk sort popover & row menu
  useEffect(() => {
    function handleClickOutside(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setSortOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    }
    if (sortOpen || activeMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sortOpen, activeMenuId]);

  // Reset selection saat ganti workspace
  useEffect(() => {
    setSelectedIds(new Set());
    setActiveMenuId(null);
  }, [selectedEmail]);

  // Modals state
  const [inspectModal, setInspectModal] = useState({ isOpen: false, file: null });
  const [moveModal, setMoveModal] = useState({ isOpen: false, file: null });
  const [copyModal, setCopyModal] = useState({ isOpen: false, file: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, file: null });

  // Notification / Toast banner
  const [toast, setToast] = useState(null);
  const [registeringId, setRegisteringId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Workspaces
  const fetchWorkspaces = async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await fetch('/api/files/workspaces');
      const data = await res.json();
      if (res.ok && data.workspaces) {
        setWorkspaces(data.workspaces);
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const targetEmail = urlParams?.get('email');
        const matched = data.workspaces.find((w) => w.email.toLowerCase() === targetEmail?.toLowerCase());

        if (matched) {
          setSelectedEmail(matched.email);
        } else if (data.workspaces.length > 0 && !selectedEmail) {
          setSelectedEmail(data.workspaces[0].email);
        }
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // 2. Fetch Files for selected Workspace
  const fetchFiles = async (email, live = false) => {
    if (!email) return;
    setLoadingFiles(true);
    setIsLiveScan(live);
    try {
      const res = await fetch(`/api/files/list?email=${encodeURIComponent(email)}&live=${live}`);
      const data = await res.json();
      if (res.ok && data.files) {
        setFiles(data.files);
      } else {
        showToast(data.error || 'Gagal memuat daftar file', 'error');
      }
    } catch (err) {
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (selectedEmail) {
      fetchFiles(selectedEmail, false);
    }
  }, [selectedEmail]);

  // Current active workspace object
  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.email === selectedEmail) || null;
  }, [workspaces, selectedEmail]);

  // Filtered & Sorted Files
  const processedFiles = useMemo(() => {
    let list = [...files];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }

    // Catalog status filter
    if (filterCatalog === 'cataloged') {
      list = list.filter((f) => f.isCataloged);
    } else if (filterCatalog === 'orphan') {
      list = list.filter((f) => !f.isCataloged);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name, undefined, { numeric: true });
      if (sortBy === 'size_desc') return (b.totalSize || 0) - (a.totalSize || 0);
      if (sortBy === 'parts_desc') return (b.fileCount || 0) - (a.fileCount || 0);
      return 0;
    });

    return list;
  }, [files, searchQuery, filterCatalog, sortBy]);

  // Handle register orphan folder
  const handleRegister = async (file) => {
    setRegisteringId(file.id);
    try {
      const res = await fetch('/api/files/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: file.id,
          name: file.name,
          email: selectedEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`'${file.name}' berhasil didaftarkan ke katalog!`, 'success');
        fetchFiles(selectedEmail, isLiveScan);
      } else {
        showToast(data.error || 'Gagal mendaftarkan', 'error');
      }
    } catch (e) {
      showToast('Gagal menghubungi server', 'error');
    } finally {
      setRegisteringId(null);
    }
  };

  // Multi-select helpers
  const toggleSelectAll = () => {
    if (selectedIds.size === processedFiles.length && processedFiles.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedFiles.map((f) => f.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const orphanSelectedCount = useMemo(() => {
    return processedFiles.filter((f) => selectedIds.has(f.id) && !f.isCataloged).length;
  }, [processedFiles, selectedIds]);

  const handleBulkRegister = async () => {
    const orphanFiles = processedFiles.filter((f) => selectedIds.has(f.id) && !f.isCataloged);
    if (orphanFiles.length === 0) {
      showToast('Tidak ada folder belum terdaftar di antara pilihan Anda', 'info');
      return;
    }

    setIsBulkRegistering(true);
    let successCount = 0;
    try {
      for (const f of orphanFiles) {
        const res = await fetch('/api/files/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderId: f.id,
            name: f.name,
            email: selectedEmail,
          }),
        });
        if (res.ok) successCount++;
      }
      showToast(`${successCount} dari ${orphanFiles.length} folder berhasil didaftarkan ke katalog!`, 'success');
      setSelectedIds(new Set());
      fetchFiles(selectedEmail, isLiveScan);
    } catch (err) {
      showToast('Terjadi kesalahan saat pendaftaran massal', 'error');
    } finally {
      setIsBulkRegistering(false);
    }
  };

  const [syncingWebId, setSyncingWebId] = useState(null);

  // Handle sync game to Firestore website
  const handleSyncToWebsite = async (file) => {
    if (!file.isCataloged) {
      showToast('Folder harus didaftarkan ke katalog terlebih dahulu', 'error');
      return;
    }
    setSyncingWebId(file.id);
    try {
      const res = await fetch('/api/catalog/enrich-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: file.id, name: file.name }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Game "${data.data?.cleanTitle || file.name}" berhasil disinkronkan ke etalase website!`, 'success');
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, firestoreSyncedAt: new Date(), isCataloged: true } : f))
        );
      } else {
        showToast(data.error || 'Gagal sinkronisasi ke website', 'error');
      }
    } catch (err) {
      showToast('Gagal terhubung ke endpoint sinkronisasi', 'error');
    } finally {
      setSyncingWebId(null);
    }
  };

  // Handle update inspected size in state
  const handleInspectSuccess = (folderId, totalBytes, totalCount) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, totalSize: totalBytes, fileCount: totalCount } : f))
    );
  };

  return (
    <div className="space-y-6">
      <TopBar title="File Manager" backHref="/" />

      {/* Toast Banner */}
      {toast && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 shadow-lg animate-in slide-in-from-top-2 ${
            toast.type === 'error'
              ? 'border-red-500/20 bg-red-500/10 text-red-400'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-3 text-xs font-semibold">
            {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* 🏢 Workspace Selector & Quota Header */}
      <div className="rounded-2xl border border-white/5 bg-[var(--surface)] p-6 shadow-xl relative z-20">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Workspace Switcher */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary)] flex items-center gap-1.5">
                <HardDrive size={13} /> Multi-Workspace Explorer
              </span>
            </div>

            <div className="flex items-center gap-3">
              <WorkspaceDrivePicker
                workspaces={workspaces}
                value={selectedEmail}
                onChange={(email) => setSelectedEmail(email)}
                disabled={loadingWorkspaces || loadingFiles}
                className="w-full sm:w-[380px]"
              />

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <button
                  onClick={() => fetchFiles(selectedEmail, true)}
                  disabled={loadingFiles || !selectedEmail}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                  title="Scan folder Google Drive secara langsung untuk mencari folder baru/orphan"
                >
                  <RefreshCw size={14} className={loadingFiles && isLiveScan ? 'animate-spin text-[var(--primary)]' : ''} />
                  <span className="hidden sm:inline">{isLiveScan ? 'Live Scan...' : 'Scan Google Drive'}</span>
                </button>

                {activeWorkspace?.lastCatalogSync && (
                  <span
                    className="text-[10px] text-[var(--text-4)] font-mono flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/30 border border-white/5 shrink-0"
                    title={`Terakhir disinkronkan: ${new Date(activeWorkspace.lastCatalogSync).toLocaleString('id-ID')}`}
                  >
                    <Clock size={11} className="text-zinc-500" />
                    <span>Sync: {formatSyncTime(activeWorkspace.lastCatalogSync)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live Storage Quota Bar / Shared Drive Staging Banner */}
          {activeWorkspace && activeWorkspace.isSharedDrive ? (
            <div className="w-full lg:w-80 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 shrink-0 shadow-lg">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Layers size={13} /> Shared Drive Penampungan
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                  Staging Terhubung
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-snug">
                Shared drive <strong>KEBERSAMAAN</strong> terhubung ke seluruh workspace untuk menampung game sebelum dialokasikan.
              </p>
              <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-2 font-mono border-t border-emerald-500/20 pt-2">
                <span>Total Game: <strong className="text-white">{files.length} Folder</strong></span>
                <span className="text-emerald-400 font-bold">Siap Dialokasikan</span>
              </div>
            </div>
          ) : activeWorkspace && activeWorkspace.storage ? (
            <div className="w-full lg:w-72 rounded-xl border border-white/5 bg-black/30 p-4 shrink-0">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Kapasitas Drive</span>
                <span className="font-mono font-bold text-[var(--primary)]">{activeWorkspace.storage.percentage}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    activeWorkspace.storage.percentage > 85
                      ? 'bg-red-500'
                      : activeWorkspace.storage.percentage > 65
                      ? 'bg-amber-500'
                      : 'bg-[var(--primary)]'
                  }`}
                  style={{ width: `${activeWorkspace.storage.percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-3)] mt-2 font-mono">
                <span>Terpakai: {activeWorkspace.storage.usageGB} GB</span>
                <span>Total: {activeWorkspace.storage.limitGB} GB</span>
              </div>
            </div>
          ) : null}

        </div>
      </div>

      {/* 🔍 Search & Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
          <input
            type="text"
            placeholder="Cari nama folder atau game..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[var(--surface)] pl-10 pr-4 py-2.5 text-xs text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
          />
        </div>

        {/* Filter Catalog Tab */}
        <div className="flex items-center rounded-xl border border-white/10 bg-[var(--surface)] p-1 shrink-0 text-xs">
          <button
            onClick={() => setFilterCatalog('all')}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
              filterCatalog === 'all' ? 'bg-white/10 text-[var(--text)]' : 'text-[var(--text-4)] hover:text-[var(--text-2)]'
            }`}
          >
            Semua ({files.length})
          </button>
          <button
            onClick={() => setFilterCatalog('cataloged')}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
              filterCatalog === 'cataloged' ? 'bg-white/10 text-[var(--text)]' : 'text-[var(--text-4)] hover:text-[var(--text-2)]'
            }`}
          >
            Terdaftar ({files.filter((f) => f.isCataloged).length})
          </button>
          <button
            onClick={() => setFilterCatalog('orphan')}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
              filterCatalog === 'orphan' ? 'bg-white/10 text-amber-400' : 'text-[var(--text-4)] hover:text-[var(--text-2)]'
            }`}
          >
            Belum Terdaftar ({files.filter((f) => !f.isCataloged).length})
          </button>
        </div>

        {/* Sorting Dropdown Custom Popover */}
        <div className="relative shrink-0" ref={sortRef}>
          <button
            type="button"
            onClick={() => setSortOpen(!sortOpen)}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
              sortOpen
                ? 'border-[var(--primary)] bg-white/10 text-white shadow-lg shadow-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30'
                : 'border-white/10 bg-[var(--surface)] text-[var(--text-2)] hover:border-white/20 hover:text-white'
            }`}
          >
            <ArrowUpDown size={13} className="text-[var(--primary)]" />
            <span>{SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Urutkan'}</span>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 text-[var(--text-4)] ${sortOpen ? 'rotate-180 text-white' : ''}`}
            />
          </button>

          {sortOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 min-w-[210px] rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--text-4)] font-mono">
                Urutkan Berdasarkan
              </div>
              <div className="space-y-0.5 mt-0.5">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.value);
                        setSortOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-bold'
                          : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check size={14} className="text-[var(--primary)] font-bold shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ⚡ Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--primary)]/30 bg-zinc-950/95 px-5 py-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--primary)]/20 font-mono font-bold text-[var(--primary)] border border-[var(--primary)]/30">
              {selectedIds.size}
            </span>
            <span className="font-semibold text-white">
              Folder game dipilih
            </span>
            {orphanSelectedCount > 0 ? (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                {orphanSelectedCount} belum terdaftar
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                Semua terdaftar
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {orphanSelectedCount > 0 && (
              <button
                onClick={handleBulkRegister}
                disabled={isBulkRegistering}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {isBulkRegistering ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                <span>Daftarkan {orphanSelectedCount} Folder Orphan</span>
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* 📁 Table of Games / Folders */}
      <div className="rounded-2xl border border-white/5 bg-[var(--surface)] shadow-2xl overflow-visible">
        {loadingFiles ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-3)] gap-3">
            <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
            <p className="text-xs font-semibold">Memuat daftar game dari workspace...</p>
          </div>
        ) : processedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center p-6">
            <Folder size={48} className="text-white/10 mb-3" />
            <p className="text-sm font-bold text-[var(--text-3)]">Tidak Ada Folder Game Ditemukan</p>
            <p className="text-xs text-[var(--text-4)] max-w-sm mt-1">
              {searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : 'Workspace ini belum memiliki folder game, atau Anda bisa mencoba tombol Scan Google Drive di atas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[360px] pb-16">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-[#0a0b0f] text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={processedFiles.length > 0 && selectedIds.size === processedFiles.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-white/20 bg-black/40 text-[var(--primary)] focus:ring-0 cursor-pointer accent-[var(--primary)]"
                      title="Pilih Semua"
                    />
                  </th>
                  <th className="py-3 px-4">Nama Game / Folder</th>
                  <th className="py-3 px-4">Part & Kapasitas</th>
                  <th className="py-3 px-4">Status Katalog</th>
                  <th className="py-3 px-4 text-right">Aksi Operasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {processedFiles.map((file) => {
                  const isSelected = selectedIds.has(file.id);
                  const isMenuOpen = activeMenuId === file.id;

                  return (
                    <tr
                      key={file.id}
                      className={`transition-colors group ${
                        isSelected
                          ? 'bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15'
                          : !file.isCataloged
                          ? 'hover:bg-amber-500/[0.04]'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(file.id)}
                          className="h-4 w-4 rounded border-white/20 bg-black/40 text-[var(--primary)] focus:ring-0 cursor-pointer accent-[var(--primary)]"
                        />
                      </td>

                      {/* Game Name & Drive Link */}
                      <td className="py-3.5 px-4 min-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                            !file.isCataloged
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            <Folder size={16} />
                          </div>
                          <div className="min-w-0">
                            <a
                              href={file.driveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-[var(--text)] hover:text-[var(--primary)] transition-colors inline-flex items-center gap-1.5 group-hover:underline truncate max-w-md"
                            >
                              {file.name}
                              <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-4)]">
                              {file.parentContainerName && (
                                <span className="rounded bg-teal-500/15 px-1.5 py-0.2 text-[9px] font-bold text-teal-400 border border-teal-500/30">
                                  📁 {file.parentContainerName}
                                </span>
                              )}
                              <span className="truncate">{file.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Part Count & Total Size */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {file.totalSize > 0 ? (
                          <div>
                            <span className="font-black text-[var(--primary)]">{formatBytes(file.totalSize)}</span>
                            <span className="text-[11px] text-[var(--text-3)] ml-2">({file.fileCount} part)</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setInspectModal({ isOpen: true, file })}
                            className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold text-amber-400 hover:bg-white/10 cursor-pointer"
                          >
                            <HelpCircle size={11} /> Cek Ukuran
                          </button>
                        )}
                      </td>

                      {/* Catalog Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {file.isCataloged ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                              <ShieldCheck size={12} /> Terdaftar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                              <AlertTriangle size={12} /> Belum Terdaftar
                            </span>
                          )}
                          {file.firestoreSyncedAt && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-400 border border-blue-500/20" title={`Live di website sejak ${new Date(file.firestoreSyncedAt).toLocaleDateString('id-ID')}`}>
                              <Globe size={10} /> Live di Web
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions Hub */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5 relative">
                          
                          {/* 1. PRIMARY ACTION */}
                          {!file.isCataloged ? (
                            <button
                              onClick={() => handleRegister(file)}
                              disabled={registeringId === file.id}
                              className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                              title="Daftarkan folder ini ke katalog game internal"
                            >
                              {registeringId === file.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                              <span>Daftarkan</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSyncToWebsite(file)}
                              disabled={syncingWebId === file.id}
                              className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 ${
                                file.firestoreSyncedAt
                                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                  : 'border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'
                              }`}
                              title={file.firestoreSyncedAt ? 'Sync Web: Update & Refresh metadata Steam di Website' : 'Publish: Tarik data resmi Steam & Publish ke etalase Website'}
                            >
                              {syncingWebId === file.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Globe size={13} />
                              )}
                              <span>{file.firestoreSyncedAt ? 'Sync Web' : 'Publish'}</span>
                            </button>
                          )}

                          {/* 2. INSPECT BUTTON */}
                          <button
                            onClick={() => setInspectModal({ isOpen: true, file })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-amber-400 hover:bg-white/10 hover:text-amber-300 transition-colors cursor-pointer"
                            title="Inspect: Inspeksi part file & cek kesehatan urutan"
                          >
                            <Layers size={14} />
                          </button>

                          {/* 3. MORE ACTIONS DROPDOWN (⋮) */}
                          <div className="relative">
                            <button
                              onClick={() => setActiveMenuId(isMenuOpen ? null : file.id)}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                                isMenuOpen
                                  ? 'border-[var(--primary)] bg-white/15 text-white shadow-md ring-1 ring-[var(--primary)]/30'
                                  : 'border-white/10 bg-white/5 text-[var(--text-3)] hover:bg-white/10 hover:text-white'
                              }`}
                              title="Opsi manajemen lainnya"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {isMenuOpen && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100 text-left"
                              >
                                <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-4)] font-mono">
                                  Manajemen File
                                </div>

                                {/* Move */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setMoveModal({ isOpen: true, file });
                                  }}
                                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-left"
                                >
                                  <ArrowRightLeft size={13} className="text-[var(--primary)] shrink-0" />
                                  <span>Pindah Workspace</span>
                                </button>

                                {/* Backup */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setCopyModal({ isOpen: true, file });
                                  }}
                                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-left"
                                >
                                  <Copy size={13} className="text-cyan-400 shrink-0" />
                                  <span>Backup / Duplikasi</span>
                                </button>

                                <div className="my-1 border-t border-white/10" />

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setDeleteModal({ isOpen: true, file });
                                  }}
                                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer text-left"
                                >
                                  <Trash2 size={13} className="text-red-400 shrink-0" />
                                  <span>Hapus Folder</span>
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      <FileInspectModal
        isOpen={inspectModal.isOpen}
        onClose={() => setInspectModal({ isOpen: false, file: null })}
        file={inspectModal.file}
        email={selectedEmail}
        onInspectSuccess={handleInspectSuccess}
      />

      <FileMoveModal
        isOpen={moveModal.isOpen}
        onClose={() => setMoveModal({ isOpen: false, file: null })}
        file={moveModal.file}
        sourceEmail={selectedEmail}
        workspaces={workspaces}
        onSuccess={() => fetchFiles(selectedEmail, isLiveScan)}
      />

      <FileCopyModal
        isOpen={copyModal.isOpen}
        onClose={() => setCopyModal({ isOpen: false, file: null })}
        file={copyModal.file}
        sourceEmail={selectedEmail}
        workspaces={workspaces}
        onSuccess={() => fetchFiles(selectedEmail, isLiveScan)}
      />

      <FileDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, file: null })}
        file={deleteModal.file}
        email={selectedEmail}
        onSuccess={() => fetchFiles(selectedEmail, isLiveScan)}
      />

    </div>
  );
}
