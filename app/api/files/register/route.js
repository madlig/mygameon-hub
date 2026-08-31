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

    const { folderId, name, email } = await req.json();

    if (!folderId || !name || !email) {
      return NextResponse.json({ error: 'Parameter folderId, name, dan email wajib diisi' }, { status: 400 });
    }

    await connectToDatabase();
    const drive = await getClientForEmail(email);

    // Hitung total part dan ukuran file di Google Drive
    let pageToken;
    const files = [];

    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'nextPageToken, files(id, size)',
      });
      files.push(...(res.data.files || []));
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    const totalSize = files.reduce((acc, f) => acc + parseInt(f.size || 0, 10), 0);
    const fileCount = files.length;

    // Upsert ke MongoDB
    const catalogItem = await GameCatalog.findOneAndUpdate(
      { folderId },
      {
        $set: {
          name: name.trim(),
          ownerEmail: email,
          fileCount,
          totalSize,
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      message: `Folder '${name}' berhasil didaftarkan ke katalog!`,
      catalog: catalogItem,
    });
  } catch (error) {
    console.error('[API files/register Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
