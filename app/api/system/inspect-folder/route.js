import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import fs from 'fs'
import path from 'path'
import { resolveUploadDirectory } from '@/lib/studioConfig'
import { getDownloadConfig } from '@/lib/downloadWatcher'

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function parsePartInfo(filename) {
  const lower = filename.toLowerCase()
  const isDownloading = lower.endsWith('.part') || lower.endsWith('.crdownload') || lower.endsWith('.tmp')
  const cleanName = isDownloading ? filename.replace(/\.(part|crdownload|tmp)$/i, '') : filename

  // 1. Pola standar: name.part01.rar, name.part1.rar, name.part001.rar
  const partMatch = cleanName.match(/\.part(\d+)\.(rar|7z|zip)$/i) || cleanName.match(/part(\d+)/i)
  if (partMatch) {
    return { isPart: true, partNumber: parseInt(partMatch[1], 10), isDownloading }
  }

  // 2. Pola 7-Zip / HJSplit: name.zip.001, name.7z.001, name.001
  const numExtMatch = cleanName.match(/\.(\d{3})$/i)
  if (numExtMatch) {
    return { isPart: true, partNumber: parseInt(numExtMatch[1], 10), isDownloading }
  }

  // 3. Pola WinRAR lawas: name.r00, name.r01
  const oldRarMatch = cleanName.match(/\.r(\d{2})$/i)
  if (oldRarMatch) {
    return { isPart: true, partNumber: parseInt(oldRarMatch[1], 10) + 1, isDownloading }
  }

  // 4. Pola Zip split: name.z01, name.z02
  const oldZipMatch = cleanName.match(/\.z(\d{2})$/i)
  if (oldZipMatch) {
    return { isPart: true, partNumber: parseInt(oldZipMatch[1], 10), isDownloading }
  }

  return { isPart: false, partNumber: null, isDownloading }
}

export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reqPath = searchParams.get('path')
    const folderName = searchParams.get('folderName')
    const type = searchParams.get('type') // 'download' | 'upload' | 'staging'

    let targetPath = null

    if (reqPath && fs.existsSync(reqPath)) {
      targetPath = reqPath
    } else if (folderName) {
      const dlConfig = getDownloadConfig()
      const downloadDir = dlConfig.downloadDir || 'D:\\Game\\Shopee\\GameDownload'
      const uploadDir = resolveUploadDirectory()

      if (type === 'download') {
        const candidate = path.join(downloadDir, folderName)
        if (fs.existsSync(candidate)) targetPath = candidate
      } else if (type === 'upload' || type === 'staging') {
        const candidate = path.join(uploadDir, folderName)
        if (fs.existsSync(candidate)) targetPath = candidate
      } else {
        // Cek keduanya
        const candidateDl = path.join(downloadDir, folderName)
        const candidateUp = path.join(uploadDir, folderName)
        if (fs.existsSync(candidateDl)) {
          targetPath = candidateDl
        } else if (fs.existsSync(candidateUp)) {
          targetPath = candidateUp
        }
      }
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      return NextResponse.json({
        success: false,
        error: `Folder tidak ditemukan di disk lokal: ${targetPath || folderName || reqPath}`
      }, { status: 404 })
    }

    const stat = fs.statSync(targetPath)
    if (!stat.isDirectory()) {
      return NextResponse.json({
        success: false,
        error: `Jalur target bukan merupakan direktori/folder.`
      }, { status: 400 })
    }

    // Pemindaian rekursif terkontrol (maks depth 3)
    const allFiles = []
    const allSubfolders = []
    let totalSize = 0
    let totalFileCount = 0

    function walkDir(currentDir, currentDepth = 1, relPrefix = '') {
      if (currentDepth > 3) return
      let entries = []
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true })
      } catch (_) {
        return
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === '$RECYCLE.BIN' || entry.name === 'System Volume Information') {
          continue
        }

        const fullEntryPath = path.join(currentDir, entry.name)
        const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name

        try {
          const entryStat = fs.statSync(fullEntryPath)

          if (entry.isDirectory()) {
            if (currentDepth === 1) {
              allSubfolders.push({
                name: entry.name,
                relPath,
                fullPath: fullEntryPath,
                mtime: entryStat.mtime
              })
            }
            walkDir(fullEntryPath, currentDepth + 1, relPath)
          } else if (entry.isFile()) {
            totalFileCount++
            totalSize += entryStat.size

            const ext = path.extname(entry.name).toLowerCase()
            const partInfo = parsePartInfo(entry.name)
            const lowerName = entry.name.toLowerCase()

            let category = 'other'
            if (partInfo.isPart) {
              category = 'rar_part'
            } else if (ext === '.iso') {
              category = 'iso'
            } else if (ext === '.exe') {
              if (lowerName === 'setup.exe' || lowerName.startsWith('setup') || lowerName.startsWith('install')) {
                category = 'setup'
              } else {
                category = 'executable'
              }
            } else if (['.bin', '.arc', '.cab', '.dat'].includes(ext)) {
              category = 'archive_payload'
            } else if (['.rar', '.7z', '.zip'].includes(ext)) {
              category = 'archive'
            } else if (['.url', '.website'].includes(ext) || (ext === '.txt' && (lowerName.includes('readme') || lowerName.includes('ovagames') || lowerName.includes('steamrip')))) {
              category = 'junk'
            } else if (['.nfo', '.sfv', '.md5', '.txt', '.pdf'].includes(ext)) {
              category = 'doc'
            } else if (['.jpg', '.jpeg', '.png', '.mp4', '.mkv'].includes(ext)) {
              category = 'media'
            }

            allFiles.push({
              name: entry.name,
              relPath,
              fullPath: fullEntryPath,
              size: entryStat.size,
              sizeFormatted: formatBytes(entryStat.size),
              mtime: entryStat.mtime,
              ext,
              category,
              isPart: partInfo.isPart,
              partNumber: partInfo.partNumber,
              isDownloading: partInfo.isDownloading,
              depth: currentDepth
            })
          }
        } catch (_) {}
      }
    }

    walkDir(targetPath, 1, '')

    // Analisis Paket & Kelengkapan RAR
    const rarParts = allFiles.filter((f) => f.category === 'rar_part')
    const isoFiles = allFiles.filter((f) => f.category === 'iso')
    const setupFiles = allFiles.filter((f) => f.category === 'setup')
    const executables = allFiles.filter((f) => f.category === 'executable')
    const junkFiles = allFiles.filter((f) => f.category === 'junk')

    // Urutkan part RAR berdasarkan nomor part
    rarParts.sort((a, b) => {
      if (a.partNumber !== null && b.partNumber !== null) return a.partNumber - b.partNumber
      return a.name.localeCompare(b.name, undefined, { numeric: true })
    })

    // Analisis sekuensial part RAR
    let isSequential = true
    const missingParts = []
    let totalRarSize = 0
    let activeDownloadingParts = 0

    if (rarParts.length > 0) {
      const foundNumbers = new Set(rarParts.map((p) => p.partNumber).filter((n) => n !== null))
      const maxPart = Math.max(...Array.from(foundNumbers), 0)
      for (let i = 1; i <= maxPart; i++) {
        if (!foundNumbers.has(i)) {
          missingParts.push(i)
          isSequential = false
        }
      }
      totalRarSize = rarParts.reduce((acc, curr) => acc + curr.size, 0)
      activeDownloadingParts = rarParts.filter((p) => p.isDownloading).length
    }

    // Tentukan Package Type
    let packageType = 'RAW_FOLDER'
    let badgeText = '📁 Folder Biasa'
    let badgeColor = 'blue'

    if (isoFiles.length > 0) {
      packageType = 'ISO'
      badgeText = `💿 Disc Image (${isoFiles.length} ISO)`
      badgeColor = 'cyan'
    } else if (rarParts.length > 0) {
      packageType = 'MULTI_PART_RAR'
      badgeText = `📦 Multi-Part RAR (${rarParts.length} Part)`
      badgeColor = isSequential && missingParts.length === 0 ? 'emerald' : 'amber'
    } else if (setupFiles.length > 0) {
      packageType = 'REPACK'
      badgeText = '🛠️ Repack Installer'
      badgeColor = 'amber'
    } else if (executables.length > 0) {
      packageType = 'PRE_INSTALLED'
      badgeText = '⚡ Siap Main (Pre-Installed)'
      badgeColor = 'purple'
    }

    return NextResponse.json({
      success: true,
      folder: {
        name: path.basename(targetPath),
        path: targetPath,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        totalFileCount,
        subfoldersCount: allSubfolders.length,
        mtime: stat.mtime
      },
      packageSummary: {
        packageType,
        badgeText,
        badgeColor,
        hasIso: isoFiles.length > 0,
        isoFiles: isoFiles.map((iso) => ({
          name: iso.name,
          relPath: iso.relPath,
          size: iso.size,
          sizeFormatted: iso.sizeFormatted
        })),
        hasRarParts: rarParts.length > 0,
        rarStats: {
          partsCount: rarParts.length,
          totalRarSize,
          totalRarSizeFormatted: formatBytes(totalRarSize),
          isSequential: isSequential && missingParts.length === 0,
          missingParts,
          activeDownloadingParts
        },
        hasSetupExe: setupFiles.length > 0,
        setupFiles: setupFiles.map((s) => ({
          name: s.name,
          relPath: s.relPath,
          size: s.size,
          sizeFormatted: s.sizeFormatted
        })),
        hasExecutables: executables.length > 0,
        executablesCount: executables.length,
        junkFilesCount: junkFiles.length
      },
      files: allFiles.slice(0, 500), // Batasi 500 file agar browser tetap sangat ringan
      isTruncated: allFiles.length > 500,
      subfolders: allSubfolders
    })
  } catch (err) {
    console.error('Inspect Folder Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
