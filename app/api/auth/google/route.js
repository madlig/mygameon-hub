import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getSiteUrl } from '@/lib/siteUrl';

export async function GET(req) {
  const session = await auth();
  const baseUrl = getSiteUrl(req);

  // Jika belum login, arahkan ke login terlebih dahulu
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent('/api/auth/google')}`, baseUrl));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/auth/google/callback`
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
    ]
  });

  return NextResponse.redirect(url);
}
