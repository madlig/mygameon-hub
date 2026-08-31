'use client';

import { useState } from 'react';
import { X, Copy, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function FileCopyModal({ isOpen, onClose, file, sourceEmail, workspaces, onSuccess }) {
  const [targetEmail, setTargetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressCount, setProgressCount] = useState({ copied: 0, total: 0 });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !file) return null;

  const targetWorkspaces = workspaces.filter((w) => w.email !== sourceEmail);

  const handleCopy = async (e) => {
    e.preventDefault();
    if (!targetEmail) {
      setError('Silakan pilih workspace tujuan');
      return;
    }

    setLoading(true);
    setError(null);
    setProgressText('Memulai proses backup...');
    setProgressCount({ copied: 0, total: 0 });

    try {
      const res = await fetch('/api/files/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFolderId: file.id,
          sourceOwnerEmail: sourceEmail,
          targetEmail,
          gameName: file.name,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial chunk

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.text) setProgressText(data.text);
            if (data.copied && data.total) {
              setProgressCount({ copied: data.copied, total: data.total });
            }
            if (data.status === 'error') {
              throw new Error(data.text);
            }
            if (data.status === 'success') {
              setSuccess(true);
            }
          } catch (pe) {
            if (pe.message && !pe.message.includes('JSON')) {
              throw pe;
            }
          }
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const percentage =
    progressCount.total > 0 ? Math.round((progressCount.copied / progressCount.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 bg-[#0a0b0f] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Copy size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-[var(--text)]">Backup / Copy Game Antar-Workspace</h2>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text)]"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleCopy} className="p-6 space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Game yang Di-backup</span>
            <p className="mt-0.5 text-sm font-bold text-[var(--text)]">{file.name}</p>
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-semibold text-[var(--text-3)]">
              Pilih Workspace Cadangan (Tujuan):
            </label>
            <select
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-[var(--text)] focus:border-cyan-400 focus:outline-none"
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

          {loading && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> {progressText}
                </span>
                <span>{percentage}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Backup selesai! Game berhasil diduplikasi ke workspace tujuan.</span>
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
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-black hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
              {loading ? 'Menyalin Part...' : 'Mulai Backup'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
