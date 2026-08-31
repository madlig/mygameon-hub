import { NextResponse } from 'next/server';
import { getClientForEmail } from '@/lib/googleClient';
import { auth } from '@/app/api/auth/[...nextauth]/route';

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
      const drive = await getClientForEmail(email);
      const about = await drive.about.get({ fields: 'storageQuota' });
      const quota = about.data.storageQuota || {};
      
      const usageBytes = parseInt(quota.usage || quota.usageInDrive || 0, 10);
      const limitBytes = quota.limit ? parseInt(quota.limit, 10) : 1024 * (1024 ** 3); // Default 1TB if limit not set
      
      const usageGB = (usageBytes / (1024 ** 3)).toFixed(2);
      const limitGB = Math.round(limitBytes / (1024 ** 3));
      const percentage = Math.min(100, Math.round((usageBytes / (limitBytes || 1)) * 100));

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
