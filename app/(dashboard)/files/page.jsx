'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Folder, Layers, Search, RefreshCw, HardDrive, ArrowRightLeft,
  Copy, Trash2, Plus, ExternalLink, AlertTriangle, CheckCircle2,
  Loader2, Filter, Sparkles, ArrowUpDown, ShieldCheck, HelpCircle
} from 'lucide-react';

import FileInspectModal from '@/components/files/FileInspectModal';
import FileMoveModal from '@/components/files/FileMoveModal';
import FileCopyModal from '@/components/files/FileCopyModal';
import FileDeleteModal from '@/components/files/FileDeleteModal';

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
        if (data.workspaces.length > 0 && !selectedEmail) {
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
      <div className="rounded-2xl border border-white/5 bg-[var(--surface)] p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Workspace Switcher */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary)] flex items-center gap-1.5">
                <HardDrive size={13} /> Multi-Workspace Explorer
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedEmail}
                onChange={(e) => setSelectedEmail(e.target.value)}
                disabled={loadingWorkspaces || loadingFiles}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm font-bold text-[var(--text)] focus:border-[var(--primary)] focus:outline-none cursor-pointer max-w-sm w-full truncate"
              >
                {workspaces.map((w) => (
                  <option key={w.email} value={w.email}>
                    {w.email} ({w.storage?.usageGB || '0'} GB / {w.storage?.limitGB || '1024'} GB)
                  </option>
                ))}
              </select>

              <button
                onClick={() => fetchFiles(selectedEmail, true)}
                disabled={loadingFiles || !selectedEmail}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-colors disabled:opacity-50 shrink-0"
                title="Scan folder Google Drive secara langsung untuk mencari folder baru/orphan"
              >
                <RefreshCw size={14} className={loadingFiles && isLiveScan ? 'animate-spin text-[var(--primary)]' : ''} />
                <span className="hidden sm:inline">{isLiveScan ? 'Live Scan...' : 'Scan Google Drive'}</span>
              </button>
            </div>
          </div>

          {/* Live Storage Quota Bar */}
          {activeWorkspace && activeWorkspace.storage && (
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
          )}

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

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="name_asc">Nama (A - Z)</option>
            <option value="size_desc">Ukuran (Terbesar)</option>
            <option value="parts_desc">Jumlah Part (Terbanyak)</option>
          </select>
        </div>

      </div>

      {/* 📁 Table of Games / Folders */}
      <div className="rounded-2xl border border-white/5 bg-[var(--surface)] shadow-2xl overflow-hidden">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-[#0a0b0f] text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">
                  <th className="py-3 px-4">Nama Game / Folder</th>
                  <th className="py-3 px-4">Part & Kapasitas</th>
                  <th className="py-3 px-4">Status Katalog</th>
                  <th className="py-3 px-4 text-right">Aksi Operasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {processedFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-white/[0.02] transition-colors group">
                    
                    {/* Game Name & Drive Link */}
                    <td className="py-3.5 px-4 min-w-[240px]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
                          <p className="text-[10px] font-mono text-[var(--text-4)] truncate">{file.id}</p>
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
                          className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold text-amber-400 hover:bg-white/10"
                        >
                          <HelpCircle size={11} /> Cek Ukuran
                        </button>
                      )}
                    </td>

                    {/* Catalog Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {file.isCataloged ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck size={12} /> Terdaftar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                          <AlertTriangle size={12} /> Belum Terdaftar
                        </span>
                      )}
                    </td>

                    {/* Actions Hub */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Inspect Parts Button */}
                        <button
                          onClick={() => setInspectModal({ isOpen: true, file })}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-colors"
                          title="Inspeksi part file & cek kesehatan urutan"
                        >
                          <Layers size={13} className="text-amber-400" />
                          <span className="hidden sm:inline">Inspect</span>
                        </button>

                        {/* If orphan -> Register Button */}
                        {!file.isCataloged && (
                          <button
                            onClick={() => handleRegister(file)}
                            disabled={registeringId === file.id}
                            className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
                            title="Daftarkan folder ini ke katalog game"
                          >
                            {registeringId === file.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            <span>Daftarkan</span>
                          </button>
                        )}

                        {/* Move Button */}
                        <button
                          onClick={() => setMoveModal({ isOpen: true, file })}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-colors"
                          title="Pindahkan game ke workspace lain"
                        >
                          <ArrowRightLeft size={13} className="text-[var(--primary)]" />
                          <span className="hidden md:inline">Pindah</span>
                        </button>

                        {/* Copy / Backup Button */}
                        <button
                          onClick={() => setCopyModal({ isOpen: true, file })}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-colors"
                          title="Backup / Duplikasi game ke workspace cadangan"
                        >
                          <Copy size={13} className="text-cyan-400" />
                          <span className="hidden md:inline">Backup</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, file })}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Hapus folder game dari Drive & database"
                        >
                          <Trash2 size={13} />
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}
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
