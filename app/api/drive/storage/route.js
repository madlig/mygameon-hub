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
      let totalBytes = 0
      let pageToken = null
      
      do {
        const listRes = await drive.files.list({
          q: "trashed=false and 'me' in owners",
          fields: "nextPageToken, files(quotaBytesUsed)",
          pageSize: 1000,
          spaces: 'drive',
        })
        
        for (const f of listRes.data.files || []) {
          if (f.quotaBytesUsed) {
            totalBytes += parseInt(f.quotaBytesUsed, 10)
          }
        }
        pageToken = listRes.data.nextPageToken
      } while (pageToken)
      
      const usageGB = (totalBytes / (1024 ** 3)).toFixed(2)
      const limitGB = 1024
      const percentage = Math.min(100, Math.round((totalBytes / (limitGB * (1024 ** 3))) * 100))

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
