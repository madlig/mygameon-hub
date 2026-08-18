import { NextResponse } from 'next/server';
import { getClientForEmail } from '@/lib/googleClient';

export async function GET(req) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  
  if (!email) return NextResponse.json({ error: 'Need email' });

  try {
    const drive = await getClientForEmail(email);
    console.time('Fetch Storage');
    let totalBytes = 0;
    let pageToken = null;
    let apiCalls = 0;
    
    do {
      apiCalls++;
      const res = await drive.files.list({
        q: "trashed=false and 'me' in owners",
        fields: "nextPageToken, files(quotaBytesUsed)",
        pageSize: 1000,
        spaces: 'drive',
      });
      
      for (const f of res.data.files || []) {
        if (f.quotaBytesUsed) {
          totalBytes += parseInt(f.quotaBytesUsed, 10);
        }
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
    
    console.timeEnd('Fetch Storage');
    const gb = (totalBytes / (1024 ** 3)).toFixed(2);
    
    return NextResponse.json({
      apiCalls,
      totalBytes,
      gb
    });
  } catch (e) {
    return NextResponse.json({ error: e.message });
  }
}
