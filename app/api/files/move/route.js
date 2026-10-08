import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@/lib/db';
import WorkspaceAccount from '@/models/WorkspaceAccount';
import GameCatalog from '@/models/GameCatalog';
import { getClientForEmail } from '@/lib/googleClient';
import { resolveTargetFolderId } from '@/lib/studioProcessor';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { folderId, sourceEmail, targetEmail } = await req.json();

    if (!folderId || !sourceEmail || !targetEmail) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
    }

    await connectToDatabase();

    // 1. Ambil meta game dari katalog DB (jika ada)
    let sourceRecord = await GameCatalog.findOne({ folderId }).lean();

    // 2. Ambil target gameFolderId
    let targetGameFolderId = 'root';
    if (targetEmail.startsWith('shared:')) {
      targetGameFolderId = targetEmail.replace('shared:', '').trim();
    } else {
      const targetAccount = await WorkspaceAccount.findOne({ email: targetEmail }).lean();
      targetGameFolderId = resolveTargetFolderId(targetAccount?.gameFolderId);
    }

    const sourceDrive = await getClientForEmail(sourceEmail);
    const targetDrive = await getClientForEmail(targetEmail);

    // Ambil nama folder dari Drive jika belum ada di database katalog
    let gameName = sourceRecord?.name;
    if (!gameName) {
      try {
        const folderMeta = await sourceDrive.files.get({
          fileId: folderId,
          supportsAllDrives: true,
          fields: 'id, name',
        });
        gameName = folderMeta.data.name;
      } catch (_) {
        gameName = 'Game Folder';
      }
    }

    // 3. Share folder sumber ke akun target sebagai editor (jika bukan akun shared drive)
    if (!targetEmail.startsWith('shared:')) {
      try {
        await sourceDrive.permissions.create({
          fileId: folderId,
          supportsAllDrives: true,
          sendNotificationEmail: false,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: targetEmail,
          },
        });
      } catch (permErr) {
        console.warn('Share permission warning:', permErr.message);
      }
    }

    // 4. Ambil parents lama
    const fileMeta = await targetDrive.files.get({
      fileId: folderId,
      supportsAllDrives: true,
      fields: 'parents',
    });
    const previousParents = (fileMeta.data.parents || []).join(',');

    // 5. Pindahkan folder ke targetGameFolderId
    const updateParams = {
      fileId: folderId,
      addParents: targetGameFolderId,
      supportsAllDrives: true,
      fields: 'id, parents',
    };

    if (previousParents) {
      updateParams.removeParents = previousParents;
    }

    try {
      await targetDrive.files.update(updateParams);
    } catch (moveErr) {
      if (moveErr.message?.includes('File not found') && targetGameFolderId !== 'root') {
        updateParams.addParents = 'root';
        await targetDrive.files.update(updateParams);
      } else {
        throw moveErr;
      }
    }

    // 6. Update database katalog (pertahankan seluruh metadata Steam & status katalog yang sudah ada)
    if (sourceRecord) {
      await GameCatalog.findByIdAndUpdate(sourceRecord._id, {
        $set: {
          ownerEmail: targetEmail,
          name: gameName,
          lastSyncedAt: new Date(),
        },
      });
    } else {
      await GameCatalog.create({
        name: gameName,
        folderId: folderId,
        ownerEmail: targetEmail,
        totalSize: 0,
        fileCount: 0,
        sendCount: 0,
        lastSyncedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Folder '${gameName}' berhasil dialokasikan / dipindahkan ke ${targetEmail}`,
    });
  } catch (error) {
    console.error('[API files/move Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
