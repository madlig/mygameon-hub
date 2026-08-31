'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, ExternalLink, HardDrive, FileText, Loader2, Folder, Layers } from 'lucide-react';

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function FileInspectModal({ isOpen, onClose, file, email, onInspectSuccess }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !file || !email) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/files/inspect?fileId=${file.id}&email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((resData) => {
        if (!isMounted) return;
        if (resData.success) {
          setData(resData);
          if (onInspectSuccess) {
            onInspectSuccess(file.id, resData.stats.totalBytes, resData.stats.totalCount);
          }
        } else {
          setError(resData.error || 'Gagal memindai folder');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Terjadi kesalahan jaringan');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, file, email]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 bg-[#0a0b0f] px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-[var(--text)]">{file?.name || 'Inspeksi Folder'}</h2>
              <p className="text-[10px] text-[var(--text-4)] uppercase tracking-wider">{email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-white/10 hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--text-3)] gap-3">
              <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
              <p className="text-xs font-semibold">Memindai seluruh part file di Google Drive...</p>
              <p className="text-[10px] text-[var(--text-4)]">Memeriksa integritas urutan part dan ukuran file</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400 mb-3">
                <AlertTriangle size={24} />
              </div>
              <p className="text-sm font-bold text-red-400">Gagal Memindai Folder</p>
              <p className="mt-1 text-xs text-[var(--text-3)] max-w-md">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* Health Banner */}
              <div
                className={`flex items-center justify-between rounded-xl border p-4 ${
                  data.health.isHealthy
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {data.health.isHealthy ? (
                    <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle size={22} className="text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {data.health.isHealthy ? 'Part File Lengkap & Sehat' : 'Peringatan: Part File Tidak Lengkap!'}
                    </h3>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {data.health.isHealthy
                        ? `Seluruh ${data.stats.partsCount} part berurutan rapi tanpa ada file yang hilang.`
                        : `Part yang hilang terdeteksi: Part ${data.health.missingParts.join(', ')}`}
                    </p>
                  </div>
                </div>

                <a
                  href={data.folder.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-colors shrink-0"
                >
                  Buka di Drive <ExternalLink size={12} />
                </a>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Total Kapasitas</span>
                  <p className="mt-1 text-sm font-black text-[var(--primary)]">{formatBytes(data.stats.totalBytes)}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Jumlah Part File</span>
                  <p className="mt-1 text-sm font-black text-[var(--text)]">{data.stats.partsCount} Part</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Subfolder / Ekstra</span>
                  <p className="mt-1 text-sm font-black text-[var(--text-3)]">{data.stats.subfoldersCount} Folder, {data.stats.othersCount} File</p>
                </div>
              </div>

              {/* Part File List */}
              <div>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                  Daftar Part File ({data.parts.length})
                </h4>
                <div className="max-h-60 overflow-y-auto rounded-xl border border-white/5 bg-black/30 divide-y divide-white/5 scrollbar-thin">
                  {data.parts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--text-4)]">Tidak ditemukan file berformat part/rar.</div>
                  ) : (
                    data.parts.map((p, idx) => (
                      <div key={p.id || idx} className="flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.02]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/5 text-[10px] font-bold text-[var(--text-3)]">
                            {p.partNumber !== null ? p.partNumber : idx + 1}
                          </span>
                          <FileText size={14} className="text-amber-400/70 shrink-0" />
                          <span className="truncate text-xs text-[var(--text-2)]">{p.name}</span>
                        </div>
                        <span className="shrink-0 text-xs font-mono text-[var(--text-4)] ml-2">{formatBytes(p.sizeBytes)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Subfolders if any */}
              {data.subfolders.length > 0 && (
                <div>
                  <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">Subfolder</h4>
                  <div className="rounded-xl border border-white/5 bg-black/30 divide-y divide-white/5">
                    {data.subfolders.map((sf) => (
                      <div key={sf.id} className="flex items-center gap-2.5 px-3.5 py-2">
                        <Folder size={14} className="text-blue-400/70 shrink-0" />
                        <span className="truncate text-xs text-[var(--text-2)]">{sf.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-white/5 bg-[#0a0b0f] px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)] transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
