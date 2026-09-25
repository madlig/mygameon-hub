import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@/lib/db';
import WorkspaceAccount from '@/models/WorkspaceAccount';
import GameCatalog from '@/models/GameCatalog';
import { getClientForEmail } from '@/lib/googleClient';

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const live = searchParams.get('live') === 'true';
    const query = searchParams.get('search') || '';

    if (!email) {
      return NextResponse.json({ error: 'Parameter email wajib diisi' }, { status: 400 });
    }

    await connectToDatabase();

    // 1. Ambil data katalog MongoDB untuk workspace ini
    let catalogFilter = { ownerEmail: email };
    if (query) {
      catalogFilter.name = { $regex: query, $options: 'i' };
    }
    const catalogItems = await GameCatalog.find(catalogFilter).sort({ name: 1 }).lean();
    const catalogMap = new Map(catalogItems.map((c) => [c.folderId, c]));

    // Jika tidak meminta live scan Google Drive, kembalikan data katalog langsung (sangat cepat)
    if (!live) {
      const formatted = catalogItems.map((item) => ({
        id: item.folderId,
        name: item.name,
        ownerEmail: item.ownerEmail,
        totalSize: item.totalSize || 0,
        fileCount: item.fileCount || 0,
        sendCount: item.sendCount || 0,
        isCataloged: true,
        catalogId: item._id,
        lastSyncedAt: item.lastSyncedAt,
        firestoreSyncedAt: item.firestoreSyncedAt || null,
        coverImageUrl: item.coverImageUrl || null,
        steamAppId: item.steamAppId || null,
        cleanTitle: item.cleanTitle || null,
        driveUrl: `https://drive.google.com/drive/folders/${item.folderId}`,
      }));

      return NextResponse.json({ success: true, files: formatted, total: formatted.length, isLive: false });
    }

    // 2. Mode Live Scan Google Drive
    const acc = await WorkspaceAccount.findOne({ email }).lean();
    const parentIds = (acc?.gameFolderId || 'root').split(',').map((id) => id.trim()).filter(Boolean);
    const drive = await getClientForEmail(email);

    const driveFolders = [];

    for (const parentId of parentIds) {
      let pageToken;
      try {
        do {
          const res = await drive.files.list({
            q: `'${parentId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
            pageSize: 100,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'nextPageToken, files(id, name, createdTime, modifiedTime)',
          });

          for (const f of res.data.files || []) {
            if (!driveFolders.some((existing) => existing.id === f.id)) {
              driveFolders.push(f);
            }
          }
          pageToken = res.data.nextPageToken;
        } while (pageToken);
      } catch (scanErr) {
        console.warn(`[files/list] Gagal scan folder ${parentId}:`, scanErr.message);
      }
    }

    // Filter pencarian jika ada
    const filteredDriveFolders = query
      ? driveFolders.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
      : driveFolders;

    // Gabungkan dengan info katalog
    const mergedFiles = filteredDriveFolders.map((f) => {
      const catalogEntry = catalogMap.get(f.id);
      return {
        id: f.id,
        name: f.name,
        ownerEmail: email,
        totalSize: catalogEntry ? catalogEntry.totalSize || 0 : 0,
        fileCount: catalogEntry ? catalogEntry.fileCount || 0 : 0,
        sendCount: catalogEntry ? catalogEntry.sendCount || 0 : 0,
        isCataloged: !!catalogEntry,
        catalogId: catalogEntry ? catalogEntry._id : null,
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime,
        lastSyncedAt: catalogEntry ? catalogEntry.lastSyncedAt : null,
        firestoreSyncedAt: catalogEntry?.firestoreSyncedAt || null,
        coverImageUrl: catalogEntry?.coverImageUrl || null,
        steamAppId: catalogEntry?.steamAppId || null,
        cleanTitle: catalogEntry?.cleanTitle || null,
        driveUrl: `https://drive.google.com/drive/folders/${f.id}`,
      };
    });

    mergedFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return NextResponse.json({ success: true, files: mergedFiles, total: mergedFiles.length, isLive: true });
  } catch (error) {
    console.error('[API files/list Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
