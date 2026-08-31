import { NextResponse } from 'next/server';
import { getClientForEmail } from '@/lib/googleClient';
import { auth } from '@/app/api/auth/[...nextauth]/route';

// Helper for recursive copy with pagination and shared drive support
async function copyFolderContents(sourceDrive, targetDrive, sourceFolderId, targetFolderId) {
  let pageToken;
  const files = [];

  do {
    const res = await sourceDrive.files.list({
      q: `'${sourceFolderId}' in parents and trashed = false`,
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'nextPageToken, files(id, name, mimeType)',
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  
  for (const file of files) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      // Create subfolder in target
      const folderRes = await targetDrive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name: file.name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [targetFolderId]
        },
        fields: 'id'
      });
      // Recursively copy subfolder
      await copyFolderContents(sourceDrive, targetDrive, file.id, folderRes.data.id);
    } else {
      // Copy file
      await targetDrive.files.copy({
        fileId: file.id,
        supportsAllDrives: true,
        requestBody: {
          parents: [targetFolderId],
          name: file.name
        }
      });
    }
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sourceFileId, sourceFileName, targetEmail } = await req.json();

    if (!sourceFileId || !targetEmail) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Initialize both clients
    // sourceDrive is just the admin's normal drive (or the session drive) to read the source folder
    // But since the folder is public/shared, we can just use targetDrive for everything, 
    // but targetDrive might not have 'reader' access if it's not shared to them yet? 
    // Actually all workspaces have access to the main folder.
    const targetDrive = await getClientForEmail(targetEmail);
    const sourceDrive = targetDrive; // targetEmail can read the source file because it's shared in the main folder

    // 1. Create a new backup folder in the main GDRIVE_FOLDER_ID
    const folderMetadata = {
      name: `[BACKUP] ${sourceFileName}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [process.env.GDRIVE_FOLDER_ID]
    };

    const targetFolderRes = await targetDrive.files.create({
      requestBody: folderMetadata,
      fields: 'id'
    });
    
    const targetFolderId = targetFolderRes.data.id;

    // 2. Copy all contents from sourceFileId to targetFolderId
    await copyFolderContents(sourceDrive, targetDrive, sourceFileId, targetFolderId);

    return NextResponse.json({ 
      success: true, 
      targetFolderId,
      message: 'Backup created successfully'
    });

  } catch (error) {
    console.error('Error during auto-copy:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
