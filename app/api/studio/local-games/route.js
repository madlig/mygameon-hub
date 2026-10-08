import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import fs from 'fs'
import path from 'path'
import { resolveUploadDirectory, saveStagingConfig } from '@/lib/studioConfig'

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function sanitizeName(name) {
  if (!name || typeof name !== 'string') return ''
  // Hapus karakter yang dilarang pada sistem file Windows: \ / : * ? " < > |
  return name.replace(/[\\/:*?"<>|]/g, '').trim()
}

// ── GET: Ambil daftar folder dan part arsip di Staging Directory ──
export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedPath = searchParams.get('path')
    const stagingPath = resolveUploadDirectory(requestedPath)

    if (!fs.existsSync(stagingPath)) {
      return NextResponse.json({
        success: false,
        error: `Direktori staging tidak ditemukan: ${stagingPath}`,
        stagingPath,
        items: []
      }, { status: 404 })
    }

    const entries = fs.readdirSync(stagingPath)
    const gameMap = new Map()

    // 1. Folder Scan
    for (const item of entries) {
      if (item.startsWith('.') || item === '$RECYCLE.BIN' || item === 'System Volume Information' || item === 'node_modules') continue

      const fullPath = path.join(stagingPath, item)
      try {
        const stats = fs.statSync(fullPath)
        if (stats.isDirectory()) {
          const escapedItem = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const itemRegex = new RegExp(`^${escapedItem}(\\.part\\d+)?\\.(rar|7z|zip|r\\d+)$`, 'i')

          let insideParts = []
          try {
            insideParts = fs.readdirSync(fullPath).filter((f) => itemRegex.test(f)).map(f => path.join(fullPath, f))
          } catch (_) {}

          const parentParts = entries.filter((f) => itemRegex.test(f)).map(f => path.join(stagingPath, f))
          const allPartFiles = parentParts.length > 0 ? parentParts : insideParts

          let totalPartsBytes = 0
          for (const p of allPartFiles) {
            try { totalPartsBytes += fs.statSync(p).size } catch (_) {}
          }

          gameMap.set(item.toLowerCase(), {
            name: item,
            path: fullPath,
            isDirectory: true,
            isArchiveFile: false,
            hasArchive: allPartFiles.length > 0,
            archiveParts: allPartFiles.length,
            archivePartFiles: allPartFiles.map(p => path.basename(p)),
            totalPartsBytes,
            formattedPartsSize: totalPartsBytes > 0 ? formatBytes(totalPartsBytes) : null,
            size: stats.size,
            mtime: stats.mtime
          })
        }
      } catch (_) {}
    }

    // 2. Archive Scan (Deduplikasi dan Penyatuan Part Bersaudara)
    for (const item of entries) {
      if (item.startsWith('.') || item === '$RECYCLE.BIN' || item === 'System Volume Information' || item === 'node_modules') continue

      const fullPath = path.join(stagingPath, item)
      try {
        const stats = fs.statSync(fullPath)
        if (stats.isFile() && (item.endsWith('.rar') || item.endsWith('.7z') || item.endsWith('.zip'))) {
          const isSecondaryPart = /\.part(0*[2-9]|[1-9][0-9]+)\.rar$/i.test(item)
          if (!isSecondaryPart) {
            const baseName = item.replace(/\.part0*1\.rar$/i, '').replace(/\.(rar|7z|zip)$/i, '')
            const key = baseName.toLowerCase()

            const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const baseRegex = new RegExp(`^${escapedBase}(\\.part\\d+)?\\.(rar|7z|zip|r\\d+)$`, 'i')
            const siblingParts = entries.filter((f) => baseRegex.test(f)).map(f => path.join(stagingPath, f))

            let totalPartsBytes = 0
            for (const p of siblingParts) {
              try { totalPartsBytes += fs.statSync(p).size } catch (_) {}
            }

            if (gameMap.has(key)) {
              const existing = gameMap.get(key)
              existing.hasArchive = true
              existing.archiveParts = siblingParts.length
              existing.archivePartFiles = siblingParts.map(p => path.basename(p))
              existing.archivePath = fullPath
              existing.totalPartsBytes = totalPartsBytes
              existing.formattedPartsSize = formatBytes(totalPartsBytes)
            } else {
              gameMap.set(key, {
                name: baseName,
                path: fullPath,
                archivePath: fullPath,
                isDirectory: false,
                isArchiveFile: true,
                hasArchive: true,
                archiveParts: siblingParts.length,
                archivePartFiles: siblingParts.map(p => path.basename(p)),
                totalPartsBytes,
                formattedPartsSize: formatBytes(totalPartsBytes),
                size: stats.size,
                mtime: stats.mtime
              })
            }
          }
        }
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      stagingPath,
      items: Array.from(gameMap.values())
    })
  } catch (err) {
    console.error('Local Games GET Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// ── POST: Buat Folder Baru ATAU Ganti Staging Path ──
export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // 1. Action: Buat Folder Baru di Staging
    if (action === 'create_folder') {
      const { stagingPath: customStaging, folderName } = body
      const stagingPath = resolveUploadDirectory(customStaging)
      const cleanName = sanitizeName(folderName)

      if (!cleanName) {
        return NextResponse.json({ error: 'Nama folder tidak boleh kosong atau mengandung karakter ilegal.' }, { status: 400 })
      }

      const targetFolderPath = path.join(stagingPath, cleanName)
      if (fs.existsSync(targetFolderPath)) {
        return NextResponse.json({ error: `Folder "${cleanName}" sudah ada di direktori staging.` }, { status: 400 })
      }

      fs.mkdirSync(targetFolderPath, { recursive: true })
      return NextResponse.json({
        success: true,
        message: `Folder "${cleanName}" berhasil dibuat.`,
        folderName: cleanName,
        path: targetFolderPath
      })
    }

    // 2. Action: Ganti Direktori Staging Aktif
    if (action === 'set_staging_path') {
      const { newStagingPath } = body
      if (!newStagingPath || typeof newStagingPath !== 'string') {
        return NextResponse.json({ error: 'Path direktori staging wajib diisi.' }, { status: 400 })
      }

      const trimmedPath = newStagingPath.trim()
      if (!fs.existsSync(trimmedPath)) {
        return NextResponse.json({ error: `Direktori tidak ditemukan di PC: ${trimmedPath}` }, { status: 400 })
      }

      const stats = fs.statSync(trimmedPath)
      if (!stats.isDirectory()) {
        return NextResponse.json({ error: `Path yang dipilih bukan sebuah folder/direktori.` }, { status: 400 })
      }

      saveStagingConfig({ stagingPath: trimmedPath })

      return NextResponse.json({
        success: true,
        message: 'Direktori staging berhasil diperbarui.',
        stagingPath: trimmedPath
      })
    }

    // 3. Action: Ratakan Folder Bertingkat (Flatten Nested Wrapper Folder)
    if (action === 'flatten_folder') {
      const { folderPath } = body
      if (!folderPath || !fs.existsSync(folderPath)) {
        return NextResponse.json({ error: 'Folder path tidak ditemukan.' }, { status: 400 })
      }

      const stat = fs.statSync(folderPath)
      if (!stat.isDirectory()) {
        return NextResponse.json({ error: 'Target bukan direktori.' }, { status: 400 })
      }

      const entries = fs.readdirSync(folderPath)
      // Temukan subfolder tunggal
      const subdirs = entries.filter((e) => {
        try {
          return fs.statSync(path.join(folderPath, e)).isDirectory()
        } catch (_) {
          return false
        }
      })

      if (subdirs.length !== 1) {
        return NextResponse.json({
          error: `Tidak dapat meratakan folder: harus memiliki tepat 1 subfolder (ditemukan ${subdirs.length}).`
        }, { status: 400 })
      }

      const innerDirName = subdirs[0]
      const innerDirPath = path.join(folderPath, innerDirName)
      const innerItems = fs.readdirSync(innerDirPath)

      let movedCount = 0
      for (const item of innerItems) {
        const srcPath = path.join(innerDirPath, item)
        const destPath = path.join(folderPath, item)
        if (!fs.existsSync(destPath)) {
          fs.renameSync(srcPath, destPath)
          movedCount++
        }
      }

      // Hapus subfolder lama yang sudah kosong
      try {
        fs.rmdirSync(innerDirPath)
      } catch (_) {}

      return NextResponse.json({
        success: true,
        message: `Berhasil meratakan struktur folder. ${movedCount} berkas/folder dipindahkan ke direktori utama.`,
        movedCount
      })
    }

    return NextResponse.json({ error: `Aksi tidak dikenal: ${action}` }, { status: 400 })
  } catch (err) {
    console.error('Local Games POST Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// ── PATCH: Ubah Nama Folder Game & Seluruh File Part Bersaudara ──
export async function PATCH(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { stagingPath: customStaging, oldName, newName, isArchiveFile } = body

    const stagingPath = resolveUploadDirectory(customStaging)
    const cleanOld = oldName?.trim()
    const cleanNew = sanitizeName(newName)

    if (!cleanOld || !cleanNew) {
      return NextResponse.json({ error: 'Nama lama dan nama baru wajib diisi secara valid.' }, { status: 400 })
    }

    if (cleanOld === cleanNew) {
      return NextResponse.json({ success: true, message: 'Nama tidak berubah.', newName: cleanNew })
    }

    const renamedFiles = []

    // 1. Rename Folder Game (jika ada foldernya)
    const oldDirPath = path.join(stagingPath, cleanOld)
    const newDirPath = path.join(stagingPath, cleanNew)

    if (fs.existsSync(oldDirPath) && fs.statSync(oldDirPath).isDirectory()) {
      if (fs.existsSync(newDirPath)) {
        return NextResponse.json({ error: `Folder dengan nama "${cleanNew}" sudah ada!` }, { status: 400 })
      }
      fs.renameSync(oldDirPath, newDirPath)
      renamedFiles.push({ type: 'directory', from: cleanOld, to: cleanNew })
    }

    // 2. Rename File Part Arsip Bersaudara (misal Game.part1.rar -> GameBaru.part1.rar)
    const escapedOld = cleanOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const partRegex = new RegExp(`^${escapedOld}(\\.part\\d+)?\\.(rar|7z|zip|r\\d+)$`, 'i')

    if (fs.existsSync(stagingPath)) {
      const files = fs.readdirSync(stagingPath)
      for (const f of files) {
        if (partRegex.test(f)) {
          const oldFilePath = path.join(stagingPath, f)
          const newFileName = f.replace(new RegExp(`^${escapedOld}`, 'i'), cleanNew)
          const newFilePath = path.join(stagingPath, newFileName)

          if (oldFilePath !== newFilePath && !fs.existsSync(newFilePath)) {
            try {
              fs.renameSync(oldFilePath, newFilePath)
              renamedFiles.push({ type: 'part', from: f, to: newFileName })
            } catch (_) {}
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengubah nama menjadi "${cleanNew}" beserta ${renamedFiles.length} item terkait.`,
      oldName: cleanOld,
      newName: cleanNew,
      renamedFiles
    })
  } catch (err) {
    console.error('Local Games PATCH Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// ── DELETE: Hapus Part Saja (Hemat Disk) ATAU Hapus Folder/Game Lengkap ──
export async function DELETE(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { stagingPath: customStaging, itemName, folderPath, mode = 'clean_parts_only', isArchiveFile, partNames = [] } = body

    const stagingPath = resolveUploadDirectory(customStaging)
    const cleanItem = itemName?.trim()

    if (!cleanItem) {
      return NextResponse.json({ error: 'Nama item wajib disertakan.' }, { status: 400 })
    }

    const escapedItem = cleanItem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const partRegex = new RegExp(`^${escapedItem}(\\.part\\d+)?\\.(rar|7z|zip|r\\d+)$`, 'i')
    const normItem = cleanItem.toLowerCase().replace(/[-_.\s+]+/g, '')

    const isMatchingPart = (f) => {
      if (!/\.(rar|7z|zip|r\d+|part\d+\.rar)$/i.test(f)) return false
      if (partRegex.test(f)) return true
      const fBase = f.replace(/\.part\d+\.(rar|7z|zip)$/i, '').replace(/\.(rar|7z|zip|r\d+)$/i, '')
      const normF = fBase.toLowerCase().replace(/[-_.\s+]+/g, '')
      return normF === normItem || (normItem.length >= 3 && (normF.startsWith(normItem) || normItem.startsWith(normF)))
    }

    let freedBytes = 0
    const deletedParts = []

    // ── MODE 1: Bersihkan HANYA file .part*.rar sementara (Pertahankan Folder Game) ──
    if (mode === 'clean_parts_only') {
      const innerFolder = folderPath && fs.existsSync(folderPath) ? folderPath : path.join(stagingPath, cleanItem)

      // 1. Jika partNames spesifik disertakan dari client, hapus berkas-berkas tersebut
      if (Array.isArray(partNames) && partNames.length > 0) {
        for (const f of partNames) {
          const p1 = path.join(stagingPath, f)
          const p2 = path.join(innerFolder, f)
          const targetP = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null)
          if (targetP) {
            try {
              const sz = (await fs.promises.stat(targetP)).size
              await fs.promises.unlink(targetP)
              freedBytes += sz
              deletedParts.push(f)
            } catch (_) {}
          }
        }
      }

      // 2. Cari part di folder staging level utama
      if (fs.existsSync(stagingPath)) {
        try {
          const files = await fs.promises.readdir(stagingPath)
          for (const f of files) {
            if (isMatchingPart(f) && !deletedParts.includes(f)) {
              const p = path.join(stagingPath, f)
              try {
                const sz = (await fs.promises.stat(p)).size
                await fs.promises.unlink(p)
                freedBytes += sz
                deletedParts.push(f)
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // 3. Cari part di dalam subfolder game jika ada
      if (fs.existsSync(innerFolder) && fs.statSync(innerFolder).isDirectory()) {
        try {
          const innerFiles = await fs.promises.readdir(innerFolder)
          for (const f of innerFiles) {
            if ((isMatchingPart(f) || /\.part\d+\.rar$/i.test(f) || f.toLowerCase().endsWith('.rar')) && !deletedParts.includes(f)) {
              const p = path.join(innerFolder, f)
              try {
                const sz = (await fs.promises.stat(p)).size
                await fs.promises.unlink(p)
                freedBytes += sz
                deletedParts.push(`${cleanItem}/${f}`)
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      return NextResponse.json({
        success: true,
        mode: 'clean_parts_only',
        itemName: cleanItem,
        freedBytes,
        formattedFreed: formatBytes(freedBytes),
        deletedCount: deletedParts.length,
        message: deletedParts.length > 0
          ? `Berhasil membersihkan ${deletedParts.length} file part arsip (${formatBytes(freedBytes)} ruang disk dibebaskan).`
          : `Tidak ada file part arsip sementara yang ditemukan untuk "${cleanItem}".`
      })
    }

    // ── MODE 2: Hapus Total (Folder Game + Seluruh Part Arsip) atau Hapus Folder ──
    if (mode === 'delete_all' || mode === 'delete_folder') {
      // 1. Hapus semua part arsip di staging secara non-blocking
      if (fs.existsSync(stagingPath)) {
        try {
          const files = await fs.promises.readdir(stagingPath)
          for (const f of files) {
            if (isMatchingPart(f)) {
              const p = path.join(stagingPath, f)
              try {
                const sz = (await fs.promises.stat(p)).size
                await fs.promises.unlink(p)
                freedBytes += sz
                deletedParts.push(f)
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // 2. Tentukan targetDir folder game (gunakan folderPath jika ada, atau fallback ke stagingPath)
      const targetDir = folderPath && fs.existsSync(folderPath)
        ? folderPath
        : path.join(stagingPath, cleanItem)

      const folderSizeParam = Number(body.folderSize) || 0
      if (folderSizeParam > 0) {
        freedBytes += folderSizeParam
      }

      if (fs.existsSync(targetDir)) {
        try {
          const targetStat = await fs.promises.stat(targetDir)
          if (targetStat.isDirectory()) {
            // Hapus direktori secara asynchronous tanpa blocking event loop
            await fs.promises.rm(targetDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
          } else if (targetStat.isFile()) {
            freedBytes += targetStat.size
            await fs.promises.unlink(targetDir)
          }
        } catch (e) {
          return NextResponse.json({ error: `Gagal menghapus folder "${cleanItem}": ${e.message}` }, { status: 500 })
        }
      }

      return NextResponse.json({
        success: true,
        mode,
        itemName: cleanItem,
        freedBytes,
        formattedFreed: formatBytes(freedBytes),
        message: `Berhasil menghapus "${cleanItem}" beserta seluruh berkasnya (${formatBytes(freedBytes)} dibebaskan).`
      })
    }

    // ── MODE 3: Hapus Berkas Tunggal ──
    if (mode === 'delete_single_file') {
      const targetFilePath = body.targetFilePath
      if (!targetFilePath || !fs.existsSync(targetFilePath)) {
        return NextResponse.json({ error: 'Berkas tidak ditemukan' }, { status: 404 })
      }
      const sz = (await fs.promises.stat(targetFilePath)).size
      await fs.promises.unlink(targetFilePath)
      return NextResponse.json({
        success: true,
        mode: 'delete_single_file',
        freedBytes: sz,
        formattedFreed: formatBytes(sz),
        message: `Berkas "${path.basename(targetFilePath)}" berhasil dihapus.`
      })
    }

    return NextResponse.json({ error: `Mode hapus tidak valid: ${mode}` }, { status: 400 })
  } catch (err) {
    console.error('Local Games DELETE Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
