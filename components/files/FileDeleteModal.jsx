'use client';

import { useState } from 'react';
import { X, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function FileDeleteModal({ isOpen, onClose, file, email, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !file) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: file.id,
          email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghapus folder');
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-[var(--surface)] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-500/10 bg-red-500/5 px-6 py-4">
          <div className="flex items-center gap-2.5 text-red-400">
            <Trash2 size={18} />
            <h2 className="text-sm font-bold">Hapus Folder Game</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
            <AlertTriangle size={18} className="shrink-0 text-amber-400 mt-0.5" />
            <p>
              Tindakan ini akan <b>menghapus folder dan seluruh part file di Google Drive</b> serta menghapus entri dari database katalog. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Folder Game:</span>
            <p className="text-sm font-bold text-[var(--text)] mt-0.5">{file.name}</p>
            <p className="text-xs text-[var(--text-3)] mt-0.5">Workspace: {email}</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Folder game berhasil dihapus dari Google Drive & Database!</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text)]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || success}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {loading ? 'Menghapus...' : 'Hapus Sekarang'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
