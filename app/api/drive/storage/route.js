import { NextResponse } from 'next/server';
import { getClientForEmail } from '@/lib/googleClient';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@/lib/db';
import GameCatalog from '@/models/GameCatalog';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    try {
      await connectToDatabase();
      const drive = await getClientForEmail(email);
      const about = await drive.about.get({ fields: 'storageQuota' });
      const quota = about.data.storageQuota || {};
      
      const rawLimitBytes = quota.limit ? parseInt(quota.limit, 10) : 0;
      let limitGB = 1024;
      if (rawLimitBytes > 0 && rawLimitBytes <= 2048 * (1024 ** 3)) {
        limitGB = Math.round(rawLimitBytes / (1024 ** 3));
      }

      let usageBytes = parseInt(quota.usageInDrive || 0, 10);
      if (usageBytes <= 0 || usageBytes > limitGB * (1024 ** 3)) {
        // Fallback ke GameCatalog Ground Truth
        const catRes = await GameCatalog.aggregate([
          { $match: { ownerEmail: email } },
          { $group: { _id: null, totalBytes: { $sum: '$totalSize' } } },
        ]);
        usageBytes = catRes[0]?.totalBytes || 0;
      }
      
      const usageGB = (usageBytes / (1024 ** 3)).toFixed(2);
      const percentage = Math.min(100, Math.round((usageBytes / (limitGB * (1024 ** 3))) * 100));

      return NextResponse.json({ 
        success: true, 
        usageGB, 
        limitGB, 
        percentage 
      });

    } catch (e) {
      if (e.message.includes('Token tidak ditemukan')) {
        return NextResponse.json({ 
          success: false, 
          notConnected: true,
          message: 'Akun belum dihubungkan. Silakan hubungkan di menu Kelola Akun.'
        });
      }
      throw e;
    }

  } catch (error) {
    console.error('Error fetching storage:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
