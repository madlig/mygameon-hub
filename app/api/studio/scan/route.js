import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/db'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'

const desktopStateSchema = new mongoose.Schema({
  machineId: String,
  isOnline: Boolean,
  lastSeen: Date,
  folders: [
    {
      name: String,
      path: String,
      isDirectory: Boolean,
      isArchiveFile: Boolean,
      hasArchive: Boolean,
      archiveParts: Number,
      hasIso: Boolean,
      hasSetupExe: Boolean,
      hasExe: Boolean,
      hasExtractedSubfolder: Boolean,
      isInstallerPackage: Boolean,
      size: Number,
      folderSize: Number,
      parentPartsSize: Number,
      totalDiskSize: Number,
      formattedSize: String,
      mtime: Date
    }
  ],
  uploadPath: String,
  currentTask: {
    status: String,
    progress: Number,
    text: String,
    commandId: String
  }
}, { timestamps: true })

let DesktopState
try {
  DesktopState = mongoose.model('DesktopState')
} catch (e) {
  DesktopState = mongoose.model('DesktopState', desktopStateSchema)
}

import { resolveUploadDirectory } from '@/lib/studioConfig'
import { formatBytes } from '@/lib/utils'

export { resolveUploadDirectory, scanLocalDirectory }

function getDirectorySize(dirPath, maxDepth = 8, currentDepth = 1) {
  if (currentDepth > maxDepth) return 0
  let total = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name === '$RECYCLE.BIN' ||
        entry.name === 'System Volume Information' ||
        entry.name === 'node_modules'
      ) {
        continue
      }
      const fullEntryPath = path.join(dirPath, entry.name)
      try {
        if (entry.isFile()) {
          if (!/\.part\d+\.(rar|7z|zip)$/i.test(entry.name)) {
            total += fs.statSync(fullEntryPath).size
          }
        } else if (entry.isDirectory()) {
          total += getDirectorySize(fullEntryPath, maxDepth, currentDepth + 1)
        }
      } catch (_) {}
    }
  } catch (_) {}
  return total
}

function scanLocalDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) return []

  const items = fs.readdirSync(targetPath)
  const gameMap = new Map()

  const normalize = (s) => (s || '').toLowerCase().replace(/[-_.]/g, ' ').replace(/\s+/g, ' ').trim()

  // PASS 1: Daftarkan semua folder mentah terlebih dahulu
  for (const item of items) {
    if (item.startsWith('.') || item === '$RECYCLE.BIN' || item === 'System Volume Information' || item === 'node_modules') continue

    const fullPath = path.join(targetPath, item)
    try {
      const stats = fs.statSync(fullPath)
      if (stats.isDirectory()) {
        const escapedItem = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const itemRegex = new RegExp(`^${escapedItem}(\\.part\\d+)?\\.(rar|7z|zip|r\\d+)$`, 'i')
        const normItem = normalize(item)

        let insideParts = []
        let insidePartsSize = 0
        let hasIso = false
        let hasSetupExe = false
        let hasAnyExe = false
        let hasExtractedSubfolder = false
        const folderSize = getDirectorySize(fullPath, 8, 1)
        try {
          const filesInside = fs.readdirSync(fullPath)
          insideParts = filesInside.filter((f) => {
            if (!/\.(rar|7z|zip|r\d+|part\d+\.rar)$/i.test(f)) return false
            return itemRegex.test(f) || /\.part\d+\.rar$/i.test(f) || f.toLowerCase().endsWith('.rar')
          })
          for (const ip of insideParts) {
            try {
              insidePartsSize += fs.statSync(path.join(fullPath, ip)).size
            } catch (_) {}
          }
          hasIso = filesInside.some((f) => f.toLowerCase().endsWith('.iso'))
          hasSetupExe = filesInside.some((f) => {
            const low = f.toLowerCase()
            return low === 'setup.exe' || (low.startsWith('setup') && low.endsWith('.exe'))
          })
          hasAnyExe = filesInside.some((f) => f.toLowerCase().endsWith('.exe'))
          hasExtractedSubfolder = filesInside.some((f) => {
            try { return fs.statSync(path.join(fullPath, f)).isDirectory() } catch (_) { return false }
          })
        } catch (_) {}

        // Cek apakah ada part .rar di level parent yang cocok dengan nama folder ini
        const parentParts = items.filter((f) => {
          if (!/\.(rar|7z|zip|r\d+|part\d+\.rar)$/i.test(f)) return false
          if (itemRegex.test(f)) return true
          const fBase = f.replace(/\.part\d+\.(rar|7z|zip)$/i, '').replace(/\.(rar|7z|zip|r\d+)$/i, '')
          const normFBase = normalize(fBase)
          return normFBase === normItem || normFBase.startsWith(normItem) || normItem.startsWith(normFBase)
        })

        // Hitung total ukuran seluruh file part di level parent (jika ada)
        let parentPartsSize = 0
        for (const pf of parentParts) {
          try {
            parentPartsSize += fs.statSync(path.join(targetPath, pf)).size
          } catch (_) {}
        }

        const resolvedPartsSize = parentPartsSize > 0 ? parentPartsSize : insidePartsSize
        const partsCount = parentParts.length > 0 ? parentParts.length : insideParts.length
        const hasArchive = partsCount > 0
        const key = item.toLowerCase()
        const primarySize = folderSize > 0 ? folderSize : resolvedPartsSize
        const finalSize = primarySize > 0 ? primarySize : stats.size
        const totalDiskSize = folderSize + resolvedPartsSize

        gameMap.set(key, {
          name: item,
          path: fullPath,
          isDirectory: true,
          isArchiveFile: false,
          hasArchive,
          archiveParts: partsCount,
          hasIso,
          hasSetupExe,
          hasExe: hasAnyExe,
          hasExtractedSubfolder,
          isInstallerPackage: hasIso || hasSetupExe,
          size: finalSize,
          folderSize,
          parentPartsSize: resolvedPartsSize,
          totalDiskSize: totalDiskSize > 0 ? totalDiskSize : finalSize,
          formattedSize: formatBytes(finalSize),
          archiveSizeAdded: resolvedPartsSize > 0,
          mtime: stats.mtime
        })
      }
    } catch (dirErr) {
      console.error('Error scanning folder item:', item, dirErr)
    }
  }

  // PASS 2: Deteksi file arsip (.rar, .7z, .zip) dan GABUNGKAN jika foldernya sudah ada (Deduplikasi Cerdas)
  for (const item of items) {
    if (item.startsWith('.') || item === '$RECYCLE.BIN' || item === 'System Volume Information' || item === 'node_modules') continue

    const fullPath = path.join(targetPath, item)
    try {
      const stats = fs.statSync(fullPath)
      if (stats.isFile() && (item.endsWith('.rar') || item.endsWith('.7z') || item.endsWith('.zip'))) {
        const isSecondaryPart = /\.part(0*[2-9]|[1-9][0-9]+)\.rar$/i.test(item)
        if (!isSecondaryPart) {
          const baseName = item.replace(/\.part0*1\.rar$/i, '').replace(/\.(rar|7z|zip)$/i, '')
          const normBase = normalize(baseName)

          // Hitung total part arsip bersaudara (hanya berkas arsip, bukan folder)
          const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const baseRegex = new RegExp(`^${escapedBase}(\\.part\\d+)?\\.(rar|7z|zip|r\\d+)$`, 'i')
          const siblingParts = items.filter((f) => {
            if (!/\.(rar|7z|zip|r\d+|part\d+\.rar)$/i.test(f)) return false
            if (baseRegex.test(f)) return true
            const fBase = f.replace(/\.part\d+\.(rar|7z|zip)$/i, '').replace(/\.(rar|7z|zip|r\d+)$/i, '')
            return normalize(fBase) === normBase
          })
          const partsCount = Math.max(1, siblingParts.length)

          let totalSiblingPartsSize = 0
          for (const sf of siblingParts) {
            try {
              totalSiblingPartsSize += fs.statSync(path.join(targetPath, sf)).size
            } catch (_) {}
          }

          // Cari folder yang cocok (berdasarkan key atau nama ternormalisasi)
          let matchedExisting = gameMap.get(baseName.toLowerCase()) || null
          if (!matchedExisting) {
            for (const existing of gameMap.values()) {
              const normExisting = normalize(existing.name)
              if (normExisting === normBase || normBase.startsWith(normExisting) || normExisting.startsWith(normBase)) {
                matchedExisting = existing
                break
              }
            }
          }

          if (matchedExisting) {
            // FOLDER SUDAH ADA: GABUNGKAN MENJADI 1 ENTITAS TUNGGAL!
            matchedExisting.hasArchive = true
            matchedExisting.archiveParts = partsCount
            matchedExisting.archivePath = fullPath
            if (!matchedExisting.archiveSizeAdded && totalSiblingPartsSize > 0) {
              matchedExisting.parentPartsSize = totalSiblingPartsSize
              matchedExisting.totalDiskSize = (matchedExisting.folderSize || 0) + totalSiblingPartsSize
              if (!matchedExisting.folderSize) {
                matchedExisting.size = totalSiblingPartsSize
                matchedExisting.formattedSize = formatBytes(totalSiblingPartsSize)
              }
              matchedExisting.archiveSizeAdded = true
            }
          } else {
            // File arsip berdiri sendiri tanpa folder mentah
            gameMap.set(baseName.toLowerCase(), {
              name: baseName,
              path: fullPath,
              archivePath: fullPath,
              isDirectory: false,
              isArchiveFile: true,
              hasArchive: true,
              archiveParts: partsCount,
              size: totalSiblingPartsSize,
              folderSize: 0,
              parentPartsSize: totalSiblingPartsSize,
              totalDiskSize: totalSiblingPartsSize,
              formattedSize: formatBytes(totalSiblingPartsSize),
              mtime: stats.mtime
            })
          }
        }
      }
    } catch (_) {}
  }

  return Array.from(gameMap.values())
}

export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
 
    const { searchParams } = new URL(request.url)
    const requestedPath = searchParams.get('path')
    const targetPath = resolveUploadDirectory(requestedPath)
    const isLocalDiskAvailable = fs.existsSync(targetPath)

    if (isLocalDiskAvailable) {
      const folders = scanLocalDirectory(targetPath)

      // Update DesktopState secara asynchronous untuk sinkronisasi C2
      connectDB().then(() => {
        DesktopState.findOneAndUpdate(
          { machineId: 'mygameon-pc-1' },
          {
            $set: {
              isOnline: true,
              lastSeen: new Date(),
              uploadPath: targetPath,
              folders: folders
            }
          },
          { upsert: true }
        ).catch(() => {})
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        path: targetPath,
        folders: folders,
        archives: []
      })
    }

    // Fallback jika dijalankan di cloud / Vercel: baca dari MongoDB
    await connectDB()
    const state = await DesktopState.findOne({ machineId: 'mygameon-pc-1' })

    if (!state || !state.isOnline) {
      return NextResponse.json({ 
        success: false, 
        error: `Desktop PC Offline. Pastikan aplikasi desktop aktif di PC Anda.`, 
        path: targetPath,
        items: [] 
      })
    }

    return NextResponse.json({
      success: true,
      path: state.uploadPath || targetPath,
      folders: state.folders || [],
      archives: []
    })

  } catch (err) {
    console.error('Studio Scan Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
