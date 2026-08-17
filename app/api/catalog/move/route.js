import { NextResponse } from 'next/server'
import { getClientForEmail } from '@/lib/googleClient'
import connectDB from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

const SHARED_DRIVE_ID = '0ALxyHsjPxl82Uk9PVA'

export async function POST(req) {
  try {
    const { sourceEmail, targetEmail, folderId, gameName } = await req.json()

    if (!sourceEmail || !targetEmail || !folderId || !gameName) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (sourceEmail === targetEmail) {
      return NextResponse.json({ error: 'Source and target must be different' }, { status: 400 })
    }

    await connectDB()

    // 1. Ambil record sumber dari DB untuk mengambil meta (size, totalFiles)
    const sourceRecord = await GameCatalog.findOne({ ownerEmail: sourceEmail, folderId })
    if (!sourceRecord) {
      return NextResponse.json({ error: 'Record sumber tidak ditemukan di katalog' }, { status: 404 })
    }

    // 2. Kredensial Source: Pindahkan dari My Drive (root) ke Shared Drive
    const sourceDrive = await getClientForEmail(sourceEmail)
    
    // Dapatkan current parents
    const fileMeta = await sourceDrive.files.get({
        fileId: folderId,
        fields: 'parents',
        supportsAllDrives: true,
    })
    const previousParents = fileMeta.data.parents ? fileMeta.data.parents.join(',') : ''

    await sourceDrive.files.update({
      fileId: folderId,
      addParents: SHARED_DRIVE_ID,
      removeParents: previousParents,
      supportsAllDrives: true,
    })

    // 3. Kredensial Target: Pindahkan dari Shared Drive ke My Drive (root) target
    const targetDrive = await getClientForEmail(targetEmail)
    
    // Gunakan folder target root yang tepat
    const targetFileMeta = await targetDrive.files.get({
        fileId: 'root',
        fields: 'id',
        supportsAllDrives: true,
    })
    const targetRootId = targetFileMeta.data.id

    await targetDrive.files.update({
      fileId: folderId,
      addParents: targetRootId,
      removeParents: SHARED_DRIVE_ID,
      supportsAllDrives: true,
    })

    // 4. Update Database
    // Hapus record lama
    await GameCatalog.deleteOne({ _id: sourceRecord._id })

    // Cek jika target sudah punya game ini (harusnya tidak, karena dipindah)
    const existingTarget = await GameCatalog.findOne({ ownerEmail: targetEmail, folderId })
    if (!existingTarget) {
      await GameCatalog.create({
        name: sourceRecord.name,
        folderId: sourceRecord.folderId,
        ownerEmail: targetEmail,
        size: sourceRecord.size,
        totalFiles: sourceRecord.totalFiles
      })
    }

    return NextResponse.json({ success: true, message: 'Berhasil dipindahkan via Shared Drive' })

  } catch (error) {
    console.error('Move error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
