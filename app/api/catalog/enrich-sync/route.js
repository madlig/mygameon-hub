import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import GameCatalog from '@/models/GameCatalog';
import { fetchSteamEnrichment } from '@/lib/steamEnrichment';
import { syncGameToFirestore } from '@/lib/firestoreSync';

/**
 * Helper untuk format bytes ke string manusiawi
 */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * POST /api/catalog/enrich-sync
 * 
 * Memperkaya katalog game dengan data Steam & mem-publish ke Firestore.
 * Jaminan: totalSize murni dari scanning Google Drive di MongoDB.
 */
export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const { folderId, id, name, syncAll, limit = 10, forceSteam = false } = body;

    // Mode 1: Single Game Processing
    if (folderId || id || name) {
      const query = folderId ? { folderId } : (id ? { _id: id } : { name });
      const game = await GameCatalog.findOne(query);

      if (!game) {
        return NextResponse.json({ success: false, error: 'Game tidak ditemukan di MongoDB GameCatalog' }, { status: 404 });
      }

      // 1. Fetch Steam metadata jika belum ada atau forceSteam aktif
      let steamData = {};
      if (!game.steamAppId || forceSteam) {
        steamData = await fetchSteamEnrichment(game.name, game.steamAppId);
      }

      // 2. Update MongoDB GameCatalog (Master Source of Truth)
      // Perhatikan: totalSize & fileCount TIDAK PERNAH ditimpa oleh Steam!
      const updatePayload = {
        cleanTitle: steamData.cleanTitle || game.cleanTitle || game.name,
        steamAppId: steamData.steamAppId || game.steamAppId,
        coverImageUrl: steamData.coverImageUrl || game.coverImageUrl,
        headerBannerUrl: steamData.headerBannerUrl || game.headerBannerUrl,
        screenshots: (steamData.screenshots && steamData.screenshots.length > 0) ? steamData.screenshots : game.screenshots,
        genres: (steamData.genres && steamData.genres.length > 0) ? steamData.genres : game.genres,
        shortDescription: steamData.shortDescription || game.shortDescription,
        releaseYear: steamData.releaseYear || game.releaseYear,
        developer: steamData.developer || game.developer,
        specs: steamData.specs || game.specs,
        lastSyncedAt: new Date(),
      };

      // Jika copy saat ini belum diinspeksi (totalSize 0), cari tahu apakah ada copy sibling dengan ukuran riil
      if (!game.totalSize || game.totalSize === 0) {
        const sibling = await GameCatalog.findOne({ name: game.name, totalSize: { $gt: 0 } }).lean();
        if (sibling) {
          updatePayload.totalSize = sibling.totalSize;
          updatePayload.fileCount = sibling.fileCount;
        }
      }

      const updatedGame = await GameCatalog.findByIdAndUpdate(game._id, { $set: updatePayload }, { new: true });

      // 3. Push ke Firestore Storefront
      const firestoreResult = await syncGameToFirestore(updatedGame);

      // 4. Catat waktu firestoreSyncedAt pada SEMUA copy workspace game ini
      await GameCatalog.updateMany(
        { name: game.name }, 
        { $set: { firestoreSyncedAt: new Date(), ...updatePayload } }
      );

      return NextResponse.json({
        success: true,
        message: `Game "${updatedGame.cleanTitle || updatedGame.name}" berhasil diperkaya dan di-sync ke Firestore.`,
        data: {
          id: updatedGame._id,
          name: updatedGame.name,
          cleanTitle: updatedGame.cleanTitle,
          steamAppId: updatedGame.steamAppId,
          totalSize: updatedGame.totalSize,
          totalSizeFormatted: formatBytes(updatedGame.totalSize),
          fileCount: updatedGame.fileCount,
          coverImageUrl: updatedGame.coverImageUrl,
          firestoreDocId: firestoreResult.docId,
        }
      });
    }

    // Mode 2: Batch Processing (Semua game yang belum di-sync ke Firestore)
    if (syncAll) {
      const filter = forceSteam ? {} : { firestoreSyncedAt: null };
      const games = await GameCatalog.find(filter).limit(Number(limit) || 20);

      const results = [];
      for (const game of games) {
        try {
          const steamData = (!game.steamAppId || forceSteam) 
            ? await fetchSteamEnrichment(game.name, game.steamAppId)
            : {};

          const updatePayload = {
            cleanTitle: steamData.cleanTitle || game.cleanTitle || game.name,
            steamAppId: steamData.steamAppId || game.steamAppId,
            coverImageUrl: steamData.coverImageUrl || game.coverImageUrl,
            headerBannerUrl: steamData.headerBannerUrl || game.headerBannerUrl,
            screenshots: (steamData.screenshots && steamData.screenshots.length > 0) ? steamData.screenshots : game.screenshots,
            genres: (steamData.genres && steamData.genres.length > 0) ? steamData.genres : game.genres,
            shortDescription: steamData.shortDescription || game.shortDescription,
            releaseYear: steamData.releaseYear || game.releaseYear,
            developer: steamData.developer || game.developer,
            specs: steamData.specs || game.specs,
            firestoreSyncedAt: new Date(),
          };

          const updatedGame = await GameCatalog.findByIdAndUpdate(game._id, { $set: updatePayload }, { new: true });
          const firestoreResult = await syncGameToFirestore(updatedGame);

          results.push({
            title: updatedGame.cleanTitle || updatedGame.name,
            totalSize: formatBytes(updatedGame.totalSize),
            success: true,
            docId: firestoreResult.docId
          });
        } catch (err) {
          results.push({
            title: game.name,
            success: false,
            error: err.message
          });
        }
      }

      return NextResponse.json({
        success: true,
        processedCount: results.length,
        results
      });
    }

    return NextResponse.json({
      error: 'Masukkan folderId, id, name, atau syncAll: true'
    }, { status: 400 });

  } catch (err) {
    console.error('[EnrichSync API Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/catalog/enrich-sync
 * 
 * Mengambil statistik status sinkronisasi katalog Hub -> Firestore Website
 */
export async function GET(request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const name = searchParams.get('name');

    if (folderId || name) {
      const query = folderId ? { folderId } : { name };
      const game = await GameCatalog.findOne(query).lean();
      return NextResponse.json({ success: true, game });
    }

    const totalInCatalog = await GameCatalog.countDocuments();
    const syncedCount = await GameCatalog.countDocuments({ firestoreSyncedAt: { $ne: null } });
    const pendingCount = totalInCatalog - syncedCount;

    return NextResponse.json({
      success: true,
      stats: {
        totalInCatalog,
        syncedCount,
        pendingCount,
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
