import { NextResponse } from 'next/server'
import { getClientForEmail } from '@/lib/googleClient'
import connectDB from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

// const SHARED_DRIVE_ID = '0ALxyHsjPxl82Uk9PVA' // Tidak dipakai lagi karena direct transfer

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

    // 2. Berikan akses & transfer kepemilikan ke targetEmail
    const sourceDrive = await getClientForEmail(sourceEmail)
    
    await sourceDrive.permissions.create({
      fileId: folderId,
      transferOwnership: true,
      requestBody: {
        role: 'owner',
        type: 'user',
        emailAddress: targetEmail
      }
    })

    // 3. Kredensial Target: Pindahkan folder ke "My Drive" (root) target
    const targetDrive = await getClientForEmail(targetEmail)
    
    // Dapatkan ID root milik target
    const targetFileMeta = await targetDrive.files.get({
        fileId: 'root',
        fields: 'id',
    })
    const targetRootId = targetFileMeta.data.id

    // Dapatkan list parents saat ini (biasanya kosong atau masuk di 'Shared with me' setelah transfer)
    const folderMeta = await targetDrive.files.get({
        fileId: folderId,
        fields: 'parents',
    })
    const previousParents = folderMeta.data.parents ? folderMeta.data.parents.join(',') : ''

    // Tambahkan ke My Drive si Target
    await targetDrive.files.update({
      fileId: folderId,
      addParents: targetRootId,
      removeParents: previousParents,
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
