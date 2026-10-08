import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@/lib/db';
import WorkspaceAccount from '@/models/WorkspaceAccount';
import GameCatalog from '@/models/GameCatalog';
import { getClientForEmail } from '@/lib/googleClient';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const accounts = await WorkspaceAccount.find({}).lean();

    // Ground Truth inventori game dari database GameCatalog
    const catalogUsage = await GameCatalog.aggregate([
      {
        $group: {
          _id: '$ownerEmail',
          totalBytes: { $sum: '$totalSize' },
          count: { $sum: 1 },
        },
      },
    ]);
    const usageMap = new Map();
    for (const item of catalogUsage) {
      if (item._id) usageMap.set(item._id, item.totalBytes);
    }

    const workspaces = await Promise.all(
      accounts.map(async (acc) => {
        const catalogBytes = usageMap.get(acc.email) || 0;
        let limitGB = 1024; // Kuota standar 1 TB per akun personal workspace
        let usageBytes = catalogBytes;
        let connected = false;

        try {
          const drive = await getClientForEmail(acc.email);
          const about = await drive.about.get({ fields: 'storageQuota' });
          const quota = about.data.storageQuota || {};
          
          // Google Workspace Enterprise/Edu domain pooled storage check
          const rawLimitBytes = quota.limit ? parseInt(quota.limit, 10) : 0;
          if (rawLimitBytes > 0 && rawLimitBytes <= 2048 * (1024 ** 3)) {
            // Jika limit spesifik akun <= 2 TB, gunakan limit tersebut
            limitGB = Math.round(rawLimitBytes / (1024 ** 3));
          }

          // Cek usageInDrive individual jika ada dan wajar (tidak melebihi limit akun)
          const apiUsageInDrive = parseInt(quota.usageInDrive || 0, 10);
          if (apiUsageInDrive > 0 && apiUsageInDrive <= limitGB * (1024 ** 3) && apiUsageInDrive >= catalogBytes) {
            usageBytes = apiUsageInDrive;
          }

          connected = true;
        } catch (err) {
          // Tetap gunakan data catalogBytes jika API Google timeout/error
        }

        const usageGB = (usageBytes / (1024 ** 3)).toFixed(2);
        const percentage = Math.min(100, Math.round((usageBytes / (limitGB * (1024 ** 3))) * 100));
        const storage = { usageGB, limitGB, percentage, connected };

        return {
          email: acc.email,
          gameFolderId: acc.gameFolderId || 'root',
          createdAt: acc.createdAt,
          lastCatalogSync: acc.lastCatalogSync || null,
          storage,
        };
      })
    );

    // Sort by email ascending
    workspaces.sort((a, b) => a.email.localeCompare(b.email, undefined, { numeric: true }));

    // Ambil daftar Shared Drives (KEBERSAMAAN) yang terhubung ke workspace
    const sharedDrives = [];
    const activeAcc = accounts.find((a) => a.status === 'active' && a.refreshToken) || accounts.find((a) => a.refreshToken);

    if (activeAcc) {
      try {
        const drive = await getClientForEmail(activeAcc.email);
        const dList = await drive.drives.list({ pageSize: 50 });
        for (const d of dList.data.drives || []) {
          sharedDrives.push({
            id: `shared_${d.id}`,
            email: `shared:${d.id}`,
            name: d.name,
            displayName: `📁 Shared Drive — ${d.name} (Penampungan)`,
            isSharedDrive: true,
            sharedDriveId: d.id,
            gameFolderId: d.id,
            storage: {
              usageGB: 'Staging',
              limitGB: 'Unlimited / Pooled',
              percentage: 0,
              connected: true,
              isSharedDrive: true,
            },
          });
        }
      } catch (sdErr) {
        console.warn('[files/workspaces] Gagal scan list shared drives:', sdErr.message);
      }
    }

    // Pastikan Shared Drive KEBERSAMAAN selalu ada sebagai opsi penampungan utama
    if (!sharedDrives.some((sd) => sd.sharedDriveId === '0ALxyHsjPxl82Uk9PVA')) {
      sharedDrives.unshift({
        id: 'shared_0ALxyHsjPxl82Uk9PVA',
        email: 'shared:0ALxyHsjPxl82Uk9PVA',
        name: 'KEBERSAMAAN',
        displayName: '📁 Shared Drive — KEBERSAMAAN (Penampungan)',
        isSharedDrive: true,
        sharedDriveId: '0ALxyHsjPxl82Uk9PVA',
        gameFolderId: '0ALxyHsjPxl82Uk9PVA',
        storage: {
          usageGB: 'Staging',
          limitGB: 'Unlimited / Pooled',
          percentage: 0,
          connected: true,
          isSharedDrive: true,
        },
      });
    }

    const allWorkspaces = [...sharedDrives, ...workspaces];

    return NextResponse.json({ success: true, workspaces: allWorkspaces });
  } catch (error) {
    console.error('[API files/workspaces Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
