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
  folders: [{ name: String, path: String, hasArchive: Boolean, archiveParts: Number }],
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

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function resolveUploadDirectory() {
  const possiblePaths = [
    process.env.STUDIO_UPLOAD_DIR,
    'D:\\Game\\Shopee\\GameUpload',
    'D:\\Game\\Shopee',
    'C:\\Game\\Shopee\\GameUpload',
  ].filter(Boolean)

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p
    }
  }

  return possiblePaths[0] || 'D:\\Game\\Shopee\\GameUpload'
}

function scanLocalDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) return []

  const items = fs.readdirSync(targetPath)
  const results = []

  for (const item of items) {
    if (item.startsWith('.') || item === '$RECYCLE.BIN' || item === 'System Volume Information' || item === 'node_modules') continue

    const fullPath = path.join(targetPath, item)
    try {
      const stats = fs.statSync(fullPath)

      if (stats.isDirectory()) {
        // 1. Cek part .rar di level folder staging yang cocok dengan nama folder
        const parentParts = items.filter(
          (f) => f.startsWith(item) && (f.endsWith('.rar') || f.endsWith('.7z') || f.endsWith('.zip'))
        )

        // 2. Cek apakah ada file part .rar di DALAM folder tersebut
        let insideParts = []
        try {
          const subItems = fs.readdirSync(fullPath)
          insideParts = subItems.filter((f) => f.endsWith('.rar') || f.endsWith('.7z') || f.endsWith('.zip'))
        } catch (_) {}

        const partsCount = parentParts.length > 0 ? parentParts.length : insideParts.length
        const hasArchive = partsCount > 0

        results.push({
          name: item,
          path: fullPath,
          isDirectory: true,
          isArchiveFile: false,
          hasArchive,
          archiveParts: partsCount,
          size: stats.size,
          mtime: stats.mtime
        })
      } else if (stats.isFile() && (item.endsWith('.rar') || item.endsWith('.7z') || item.endsWith('.zip'))) {
        // Handle standalone archive file di root direktori upload
        const isSecondaryPart = /\.part(0*[2-9]|[1-9][0-9]+)\.rar$/i.test(item)
        if (!isSecondaryPart) {
          const baseName = item.replace(/\.part0*1\.rar$/i, '').replace(/\.(rar|7z|zip)$/i, '')
          const siblingParts = items.filter(
            (f) => f.startsWith(baseName) && (f.endsWith('.rar') || f.endsWith('.7z') || f.endsWith('.zip'))
          )
          results.push({
            name: baseName,
            path: fullPath,
            isDirectory: false,
            isArchiveFile: true,
            hasArchive: true,
            archiveParts: Math.max(1, siblingParts.length),
            size: stats.size,
            formattedSize: formatBytes(stats.size),
            mtime: stats.mtime
          })
        }
      }
    } catch (_) {}
  }

  return results
}

export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const targetPath = resolveUploadDirectory()
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
