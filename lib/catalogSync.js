import connectToDatabase from '@/lib/db';
import WorkspaceAccount from '@/models/WorkspaceAccount';
import GameCatalog from '@/models/GameCatalog';
import { getClientForEmail } from '@/lib/googleClient';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * Scan Google Drive dari 1 workspace, lalu sync katalog game ke MongoDB.
 * @param {string} email - Email workspace yang akan di-sync
 * @returns {{ added: number, updated: number, removed: number, error?: string }}
 */
export async function syncWorkspaceCatalog(email) {
  await connectToDatabase();

  const account = await WorkspaceAccount.findOne({ email, status: 'active' });
  if (!account) {
    return { added: 0, updated: 0, removed: 0, error: `Akun ${email} tidak ditemukan atau tidak aktif.` };
  }

  let drive;
  try {
    drive = await getClientForEmail(email);
  } catch (e) {
    // Mark account as error if token is invalid
    await WorkspaceAccount.updateOne({ email }, { $set: { status: 'error' } });
    return { added: 0, updated: 0, removed: 0, error: `Gagal autentikasi ${email}: ${e.message}` };
  }

  const parentIds = (account.gameFolderId || 'root').split(',').map(id => id.trim()).filter(id => id);

  // 1. List semua FOLDER di setiap target folder (My Drive / Shared Drive)
  const gameFolders = [];
  
  for (const parentId of parentIds) {
    let pageToken = null;
    try {
      do {
        const res = await drive.files.list({
          q: `'${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
          pageSize: 200,
          pageToken,
          fields: 'nextPageToken, files(id, name)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        for (const f of res.data.files || []) {
          // Hindari duplikat jika kebetulan satu folder terdeteksi dua kali
          if (!gameFolders.some(existing => existing.id === f.id)) {
            gameFolders.push({ id: f.id, name: f.name });
          }
        }
        pageToken = res.data.nextPageToken;
      } while (pageToken);
    } catch (e) {
      console.error(`Gagal membaca folder ${parentId} pada Drive ${email}: ${e.message}`);
      // Kita lanjutkan ke folder berikutnya meskipun satu gagal
    }
  }

  // 2. Upsert setiap folder game ke GameCatalog
  let added = 0;
  let updated = 0;

  for (const folder of gameFolders) {
    const result = await GameCatalog.findOneAndUpdate(
      { folderId: folder.id },
      {
        $set: {
          name: folder.name,
          ownerEmail: email,
          lastSyncedAt: new Date(),
        },
        $setOnInsert: {
          folderId: folder.id,
          fileCount: 0,
          totalSize: 0,
        },
      },
      { upsert: true, new: true, rawResult: true }
    );
    
    if (result.lastErrorObject?.updatedExisting) {
      updated++;
    } else {
      added++;
    }
  }

  // 3. Hapus entry GameCatalog yang sudah tidak ada di Drive (game dihapus/dipindah)
  const currentFolderIds = gameFolders.map(f => f.id);
  const removeResult = await GameCatalog.deleteMany({
    ownerEmail: email,
    folderId: { $nin: currentFolderIds },
  });
  const removed = removeResult.deletedCount || 0;

  // 4. Update lastCatalogSync di WorkspaceAccount
  await WorkspaceAccount.updateOne(
    { email },
    { $set: { lastCatalogSync: new Date() } }
  );

  return { added, updated, removed };
}

/**
 * Sync katalog dari SEMUA workspace yang aktif.
 * @returns {{ results: Array<{ email: string, added: number, updated: number, removed: number, error?: string }> }}
 */
export async function syncAllCatalogs() {
  await connectToDatabase();

  const accounts = await WorkspaceAccount.find({ status: 'active' });
  const results = [];

  // Proses secara sequential agar tidak menghantam Google API secara bersamaan
  for (const account of accounts) {
    const result = await syncWorkspaceCatalog(account.email);
    results.push({ email: account.email, ...result });
  }

  return { results };
}
