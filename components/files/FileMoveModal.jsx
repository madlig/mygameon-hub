'use client';

import { useState } from 'react';
import { X, ArrowRight, Loader2, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function FileMoveModal({ isOpen, onClose, file, sourceEmail, workspaces, onSuccess }) {
  const [targetEmail, setTargetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !file) return null;

  const targetWorkspaces = workspaces.filter((w) => w.email !== sourceEmail);

  const handleMove = async (e) => {
    e.preventDefault();
    if (!targetEmail) {
      setError('Silakan pilih workspace tujuan');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/files/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: file.id,
          sourceEmail,
          targetEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memindahkan folder');
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
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 bg-[#0a0b0f] px-6 py-4">
          <h2 className="text-sm font-bold text-[var(--text)]">Pindah Game Antar-Workspace</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleMove} className="p-6 space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Game yang Dipindahkan</span>
            <p className="mt-0.5 text-sm font-bold text-[var(--text)]">{file.name}</p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs">
            <div className="min-w-0 flex-1 truncate">
              <span className="text-[9px] uppercase text-[var(--text-4)] font-bold">Sumber</span>
              <p className="font-semibold text-[var(--text-2)] truncate">{sourceEmail}</p>
            </div>
            <ArrowRight size={16} className="text-[var(--primary)] shrink-0" />
            <div className="min-w-0 flex-1 truncate">
              <span className="text-[9px] uppercase text-[var(--text-4)] font-bold">Tujuan</span>
              <p className="font-semibold text-[var(--primary)] truncate">{targetEmail || 'Pilih akun...'}</p>
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-semibold text-[var(--text-3)]">
              Pilih Workspace Tujuan:
            </label>
            <select
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
              disabled={loading || success}
            >
              <option value="">-- Pilih Akun Workspace --</option>
              {targetWorkspaces.map((w) => (
                <option key={w.email} value={w.email}>
                  {w.email} (Sisa: {(w.storage.limitGB - parseFloat(w.storage.usageGB)).toFixed(1)} GB free)
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Game berhasil dipindahkan ke workspace tujuan!</span>
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
              type="submit"
              disabled={loading || success || !targetEmail}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2 text-xs font-bold text-black hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? 'Memindahkan...' : 'Pindahkan Game'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
