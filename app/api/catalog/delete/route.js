import { NextResponse } from 'next/server'
import { getClientForEmail } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'
import { auth } from '@/app/api/auth/[...nextauth]/route'

export async function DELETE(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { folderId, ownerEmail } = await request.json()

    if (!folderId || !ownerEmail) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
    }

    await connectToDatabase()

    // Hapus dari MongoDB
    await GameCatalog.deleteOne({ folderId })

    // Hapus secara permanen dari Google Drive (bukan trash)
    try {
      const drive = await getClientForEmail(ownerEmail)
      await drive.files.delete({
        fileId: folderId,
        supportsAllDrives: true,
      })
    } catch (e) {
      // Jika file sudah tidak ada di Drive (404), abaikan saja karena tujuan kita memang menghapusnya
      if (e.code !== 404 && e.status !== 404) {
        console.error(`Gagal menghapus folder ${folderId} di Drive:`, e.message)
        // Kita tetap return success karena di DB sudah terhapus, namun beri peringatan
        return NextResponse.json({ success: true, message: 'Dihapus dari katalog, tapi gagal dihapus fisik di Drive' })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Delete catalog error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
