import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@/lib/db';
import GameCatalog from '@/models/GameCatalog';
import { getClientForEmail } from '@/lib/googleClient';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { folderId, email } = await req.json();

    if (!folderId || !email) {
      return NextResponse.json({ error: 'Parameter folderId dan email wajib diisi' }, { status: 400 });
    }

    await connectToDatabase();
    const drive = await getClientForEmail(email);

    // 1. Hapus dari Google Drive
    try {
      await drive.files.delete({
        fileId: folderId,
        supportsAllDrives: true,
      });
    } catch (driveErr) {
      if (driveErr.code !== 404 && !driveErr.message?.toLowerCase().includes('not found')) {
        throw driveErr;
      }
    }

    // 2. Hapus dari database GameCatalog
    const deleted = await GameCatalog.deleteOne({ folderId, ownerEmail: email });

    return NextResponse.json({
      success: true,
      message: 'Folder game berhasil dihapus dari Google Drive dan database katalog.',
      deletedCount: deleted.deletedCount,
    });
  } catch (error) {
    console.error('[API files/delete Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
