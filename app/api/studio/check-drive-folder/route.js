import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectToDatabase from '@/lib/db'
import WorkspaceAccount from '@/models/WorkspaceAccount'
import { getClientForEmail } from '@/lib/googleClient'

import GameCatalog from '@/models/GameCatalog'

function resolveTargetFolderId(id) {
  if (!id) return 'root'
  let clean = String(id).trim()
  const urlMatch = clean.match(/folders\/([a-zA-Z0-9_-]+)/) || clean.match(/id=([a-zA-Z0-9_-]+)/)
  if (urlMatch) clean = urlMatch[1]
  if (!clean || clean.toLowerCase() === 'root' || clean === 'null' || clean === 'undefined') return 'root'
  return clean
}

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, folderName, partsList = [], targetFolderId = null } = await request.json()
    if (!email || !folderName) {
      return NextResponse.json({ error: 'Email workspace dan nama folder wajib diisi' }, { status: 400 })
    }

    await connectToDatabase()

    // Bersihkan nama folder sesuai aturan Cloud Drive
    const cleanFolderName = folderName.replace(/[\\/:*?"<>|]/g, '').trim()
    if (!cleanFolderName) {
      return NextResponse.json({ error: 'Nama folder tidak valid setelah sanitasi' }, { status: 400 })
    }

    const drive = await getClientForEmail(email)
    const acc = await WorkspaceAccount.findOne({ email }).lean()
    const targetGameFolderId = resolveTargetFolderId(acc?.gameFolderId)
    const customDriveFolderId = targetFolderId ? resolveTargetFolderId(targetFolderId) : null

    // 1. Cek langsung jika targetFolderId disediakan
    let driveFolder = null
    if (customDriveFolderId && customDriveFolderId !== 'root') {
      try {
        const directRes = await drive.files.get({
          fileId: customDriveFolderId,
          fields: 'id, name, webViewLink, trashed',
          supportsAllDrives: true,
        })
        if (directRes.data?.id && !directRes.data.trashed) {
          driveFolder = directRes.data
        }
      } catch (_) {}
    }

    // 2. Cari apakah folder dengan nama ini sudah ada di targetGameFolderId
    if (!driveFolder) {
      try {
        const searchRes = await drive.files.list({
          q: `'${targetGameFolderId}' in parents and name = '${cleanFolderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name, webViewLink)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })
        driveFolder = searchRes.data.files?.[0] || null
      } catch (e) {
        console.warn('Search in targetGameFolderId failed, trying fallback:', e.message)
      }
    }

    // Fallback A: Jika tidak ditemukan di gameFolderId dan bukan root, cari di root
    if (!driveFolder && targetGameFolderId !== 'root') {
      try {
        const rootRes = await drive.files.list({
          q: `'root' in parents and name = '${cleanFolderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name, webViewLink)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })
        driveFolder = rootRes.data.files?.[0] || null
      } catch (_) {}
    }

    // Fallback B: Cari ID folder di GameCatalog jika pernah dicatat
    if (!driveFolder) {
      try {
        const existingCat = await GameCatalog.findOne({ name: cleanFolderName, ownerEmail: email }).lean()
        if (existingCat?.folderId) {
          const catRes = await drive.files.get({
            fileId: existingCat.folderId,
            fields: 'id, name, webViewLink, trashed',
            supportsAllDrives: true,
          })
          if (catRes.data?.id && !catRes.data.trashed) {
            driveFolder = catRes.data
          }
        }
      } catch (_) {}
    }

    // 2. Jika folder BELUM ADA di Google Drive
    if (!driveFolder) {
      const totalBytes = partsList.reduce((acc, p) => acc + (p.size || 0), 0)
      return NextResponse.json({
        success: true,
        exists: false,
        folderId: null,
        folderName: cleanFolderName,
        totalParts: partsList.length,
        uploadedCount: 0,
        remainingCount: partsList.length,
        uploadedParts: [],
        remainingParts: partsList,
        uploadedBytes: 0,
        remainingBytes: totalBytes,
        isComplete: false,
      })
    }

    // 3. Jika folder SUDAH ADA: Periksa seluruh file di dalamnya
    const filesRes = await drive.files.list({
      q: `'${driveFolder.id}' in parents and trashed = false`,
      fields: 'files(id, name, size)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1000,
    })

    const driveFiles = filesRes.data.files || []
    const driveFileMap = new Map()
    for (const df of driveFiles) {
      if (df.name) driveFileMap.set(df.name.toLowerCase(), df)
    }

    const uploadedParts = []
    const remainingParts = []
    let uploadedBytes = 0
    let remainingBytes = 0

    for (const p of partsList) {
      const df = p.name ? driveFileMap.get(p.name.toLowerCase()) : null
      // Verifikasi ukuran part (harus cocok 100% dengan part lokal jika ukuran lokal diketahui)
      const isCompleteMatch = df && (p.size ? parseInt(df.size, 10) === p.size : true)

      if (isCompleteMatch) {
        uploadedParts.push({
          name: p.name,
          size: p.size || parseInt(df.size, 10) || 0,
          id: df.id,
        })
        uploadedBytes += (p.size || parseInt(df.size, 10) || 0)
      } else {
        remainingParts.push({
          name: p.name,
          size: p.size || 0,
          existingPartial: df ? { id: df.id, size: parseInt(df.size, 10) } : null,
        })
        remainingBytes += (p.size || 0)
      }
    }

    return NextResponse.json({
      success: true,
      exists: true,
      folderId: driveFolder.id,
      folderName: driveFolder.name,
      totalParts: partsList.length,
      uploadedCount: uploadedParts.length,
      remainingCount: remainingParts.length,
      uploadedParts,
      remainingParts,
      uploadedBytes,
      remainingBytes,
      isComplete: remainingParts.length === 0 && partsList.length > 0,
      driveFilesCount: driveFiles.length,
    })
  } catch (err) {
    console.error('Error in check-drive-folder API:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memeriksa folder di Google Drive' },
      { status: 500 }
    )
  }
}
