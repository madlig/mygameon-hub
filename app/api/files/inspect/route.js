import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@/lib/db';
import GameCatalog from '@/models/GameCatalog';
import { getClientForEmail } from '@/lib/googleClient';

function parsePartNumber(filename) {
  // 1. Pola standar: name.part01.rar, name.part1.rar, name.part001.rar
  const partMatch = filename.match(/\.part(\d+)\.rar$/i) || filename.match(/part(\d+)/i);
  if (partMatch) return parseInt(partMatch[1], 10);

  // 2. Pola 7-Zip / HJSplit: name.zip.001, name.7z.001, name.001
  const numExtMatch = filename.match(/\.(\d{3})$/i);
  if (numExtMatch) return parseInt(numExtMatch[1], 10);

  // 3. Pola WinRAR lawas: name.r00, name.r01
  const oldRarMatch = filename.match(/\.r(\d{2})$/i);
  if (oldRarMatch) return parseInt(oldRarMatch[1], 10) + 1;

  // 4. Pola Zip split: name.z01, name.z02
  const oldZipMatch = filename.match(/\.z(\d{2})$/i);
  if (oldZipMatch) return parseInt(oldZipMatch[1], 10);

  return null;
}

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const email = searchParams.get('email');

    if (!fileId || !email) {
      return NextResponse.json({ error: 'Parameter fileId dan email wajib diisi' }, { status: 400 });
    }

    await connectToDatabase();
    const drive = await getClientForEmail(email);

    // Ambil info folder
    const folderRes = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, webViewLink',
    });
    const folderData = folderRes.data;

    // Ambil semua item di dalam folder
    let pageToken;
    const allFiles = [];

    do {
      const listRes = await drive.files.list({
        q: `'${fileId}' in parents and trashed = false`,
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'nextPageToken, files(id, name, size, mimeType, modifiedTime)',
      });

      allFiles.push(...(listRes.data.files || []));
      pageToken = listRes.data.nextPageToken;
    } while (pageToken);

    let totalBytes = 0;
    const parts = [];
    const subfolders = [];
    const others = [];

    for (const f of allFiles) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        subfolders.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
        });
      } else {
        const bytes = parseInt(f.size || 0, 10);
        totalBytes += bytes;
        const partNumber = parsePartNumber(f.name);

        const itemObj = {
          id: f.id,
          name: f.name,
          sizeBytes: bytes,
          mimeType: f.mimeType,
          partNumber,
          modifiedTime: f.modifiedTime,
        };

        if (partNumber !== null) {
          parts.push(itemObj);
        } else {
          others.push(itemObj);
        }
      }
    }

    // Urutkan part berdasarkan partNumber
    parts.sort((a, b) => (a.partNumber || 0) - (b.partNumber || 0));

    // Validasi kelengkapan urutan part file (Sequence Validator)
    let isHealthy = true;
    const missingParts = [];

    if (parts.length > 0) {
      const partNums = parts.map((p) => p.partNumber).filter((n) => typeof n === 'number' && !isNaN(n));
      const minPart = Math.min(...partNums);
      const maxPart = Math.max(...partNums);

      // Cek jika part awal bukan 1
      if (minPart > 1) {
        for (let i = 1; i < minPart; i++) {
          missingParts.push(i);
        }
      }

      // Cek apakah ada part yang bolong di tengah
      const partSet = new Set(partNums);
      for (let i = minPart; i <= maxPart; i++) {
        if (!partSet.has(i)) {
          missingParts.push(i);
        }
      }

      if (missingParts.length > 0) {
        isHealthy = false;
      }
    }

    const totalCount = parts.length + others.length;

    // Update otomatis ke MongoDB GameCatalog jika ada record-nya
    await GameCatalog.updateMany(
      { folderId: fileId },
      { $set: { fileCount: totalCount, totalSize: totalBytes, lastSyncedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      folder: {
        id: folderData.id,
        name: folderData.name,
        driveUrl: folderData.webViewLink || `https://drive.google.com/drive/folders/${folderData.id}`,
      },
      stats: {
        totalBytes,
        totalCount,
        partsCount: parts.length,
        subfoldersCount: subfolders.length,
        othersCount: others.length,
      },
      health: {
        isHealthy,
        missingParts,
        hasParts: parts.length > 0,
      },
      parts,
      others,
      subfolders,
    });
  } catch (error) {
    console.error('[API files/inspect Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
