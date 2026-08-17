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
      const res = await drive.about.get({
        fields: 'storageQuota'
      });

      const { usage, limit } = res.data.storageQuota;
      
      // Convert to GB
      const usageGB = (usage / (1024 ** 3)).toFixed(2);
      const limitGB = limit ? (limit / (1024 ** 3)).toFixed(2) : 'Unlmited';
      const percentage = limit ? Math.min(100, Math.round((usage / limit) * 100)) : 0;

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
