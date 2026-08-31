import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@/lib/db';
import WorkspaceAccount from '@/models/WorkspaceAccount';
import { getClientForEmail } from '@/lib/googleClient';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const accounts = await WorkspaceAccount.find({}).lean();

    const workspaces = await Promise.all(
      accounts.map(async (acc) => {
        let storage = { usageGB: '0', limitGB: 1024, percentage: 0, connected: false };
        try {
          const drive = await getClientForEmail(acc.email);
          const about = await drive.about.get({ fields: 'storageQuota' });
          const quota = about.data.storageQuota || {};
          
          const usageBytes = parseInt(quota.usage || quota.usageInDrive || 0, 10);
          const limitBytes = quota.limit ? parseInt(quota.limit, 10) : 1024 * (1024 ** 3);
          
          const usageGB = (usageBytes / (1024 ** 3)).toFixed(2);
          const limitGB = Math.round(limitBytes / (1024 ** 3));
          const percentage = Math.min(100, Math.round((usageBytes / (limitBytes || 1)) * 100));

          storage = { usageGB, limitGB, percentage, connected: true };
        } catch (err) {
          storage.error = err.message;
        }

        return {
          email: acc.email,
          gameFolderId: acc.gameFolderId || 'root',
          createdAt: acc.createdAt,
          storage,
        };
      })
    );

    // Sort by email ascending
    workspaces.sort((a, b) => a.email.localeCompare(b.email, undefined, { numeric: true }));

    return NextResponse.json({ success: true, workspaces });
  } catch (error) {
    console.error('[API files/workspaces Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
