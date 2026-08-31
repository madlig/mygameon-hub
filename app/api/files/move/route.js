import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@/lib/db';
import WorkspaceAccount from '@/models/WorkspaceAccount';
import GameCatalog from '@/models/GameCatalog';
import { getClientForEmail } from '@/lib/googleClient';

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

    // 1. Ambil meta game dari katalog DB
    const sourceRecord = await GameCatalog.findOne({ folderId, ownerEmail: sourceEmail }).lean();
    if (!sourceRecord) {
      return NextResponse.json({ error: 'Game tidak ditemukan di katalog workspace sumber' }, { status: 404 });
    }

    // 2. Ambil target gameFolderId
    const targetAccount = await WorkspaceAccount.findOne({ email: targetEmail }).lean();
    const targetGameFolderId = targetAccount?.gameFolderId || 'root';

    const sourceDrive = await getClientForEmail(sourceEmail);
    const targetDrive = await getClientForEmail(targetEmail);

    // 3. Share folder sumber ke akun target sebagai editor
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

    await targetDrive.files.update(updateParams);

    // 6. Update database katalog
    await GameCatalog.deleteOne({ _id: sourceRecord._id });
    await GameCatalog.create({
      name: sourceRecord.name,
      folderId: sourceRecord.folderId,
      ownerEmail: targetEmail,
      totalSize: sourceRecord.totalSize || 0,
      fileCount: sourceRecord.fileCount || 0,
      sendCount: sourceRecord.sendCount || 0,
      lastSyncedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Folder '${sourceRecord.name}' berhasil dipindahkan ke ${targetEmail}`,
    });
  } catch (error) {
    console.error('[API files/move Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
