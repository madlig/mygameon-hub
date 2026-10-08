'use client'

import { useState } from 'react'
import { FolderPlus, Pencil, HardDrive, X, Loader2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function StagingModals({
  createFolderOpen = false,
  setCreateFolderOpen,
  onCreateFolderSubmit,
  renameModal = { open: false, item: null, newName: '' },
  setRenameModal,
  onRenameSubmit,
  stagingPathModal = { open: false, path: '' },
  setStagingPathModal,
  onStagingPathSubmit,
  confirmAction = null,
  setConfirmAction,
}) {
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isUpdatingPath, setIsUpdatingPath] = useState(false)

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!newFolderName.trim() || isCreating) return
    setIsCreating(true)
    try {
      await onCreateFolderSubmit?.(newFolderName.trim())
      setNewFolderName('')
      setCreateFolderOpen(false)
    } finally {
      setIsCreating(false)
    }
  }

  const handleRenameSubmit = async (e) => {
    e.preventDefault()
    if (!renameModal.newName?.trim() || isRenaming) return
    setIsRenaming(true)
    try {
      await onRenameSubmit?.(renameModal.item, renameModal.newName.trim())
      setRenameModal({ open: false, item: null, newName: '' })
    } finally {
      setIsRenaming(false)
    }
  }

  const handlePathSubmit = async (e) => {
    e.preventDefault()
    if (!stagingPathModal.path?.trim() || isUpdatingPath) return
    setIsUpdatingPath(true)
    try {
      await onStagingPathSubmit?.(stagingPathModal.path.trim())
      setStagingPathModal({ open: false, path: '' })
    } finally {
      setIsUpdatingPath(false)
    }
  }

  return (
    <>
      {/* ── Modal Buat Folder Game Baru ── */}
      {createFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2 text-[var(--primary)]">
                <FolderPlus size={18} />
                <h3 className="text-sm font-bold text-[var(--text)]">Buat Folder Game Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateFolderOpen(false)}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-3)]">Nama Folder Game</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Misal: Black Myth Wukong"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateFolderOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim() || isCreating}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-black text-black hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {isCreating && <Loader2 size={13} className="animate-spin" />}
                  <span>Buat Folder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Rename Folder ── */}
      {renameModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2 text-amber-400">
                <Pencil size={18} />
                <h3 className="text-sm font-bold text-[var(--text)]">Ubah Nama Folder</h3>
              </div>
              <button
                type="button"
                onClick={() => setRenameModal({ open: false, item: null, newName: '' })}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-3)]">Nama Baru</label>
                <input
                  type="text"
                  autoFocus
                  value={renameModal.newName}
                  onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-[var(--text)] focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModal({ open: false, item: null, newName: '' })}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!renameModal.newName?.trim() || isRenaming}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-black hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {isRenaming && <Loader2 size={13} className="animate-spin" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Ubah Staging Path ── */}
      {stagingPathModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2 text-amber-400">
                <HardDrive size={18} />
                <h3 className="text-sm font-bold text-[var(--text)]">Ubah Direktori Staging PC</h3>
              </div>
              <button
                type="button"
                onClick={() => setStagingPathModal({ open: false, path: '' })}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePathSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-3)]">
                  Path Folder Penyimpanan Lokal di Komputer
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Misal: D:\Game\Shopee\GameUpload"
                  value={stagingPathModal.path}
                  onChange={(e) => setStagingPathModal({ ...stagingPathModal, path: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-mono text-[var(--text)] focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStagingPathModal({ open: false, path: '' })}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!stagingPathModal.path?.trim() || isUpdatingPath}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-black hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {isUpdatingPath && <Loader2 size={13} className="animate-spin" />}
                  <span>Terapkan Path</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dialog Konfirmasi CRUD ── */}
      <ConfirmDialog
        open={!!confirmAction}
        {...confirmAction}
        onClose={() => setConfirmAction(null)}
      />
    </>
  )
}
