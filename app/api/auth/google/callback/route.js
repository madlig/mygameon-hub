import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import connectToDatabase from '@/lib/db';
import WorkspaceAccount from '@/models/WorkspaceAccount';
import { getSiteUrl } from '@/lib/siteUrl';

export async function GET(req) {
  const baseUrl = getSiteUrl(req);
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/accounts?error=oauth_rejected', baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/accounts?error=no_code', baseUrl));
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${baseUrl}/api/auth/google/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    if (!email) {
      throw new Error('No email found in Google profile');
    }

    if (!tokens.refresh_token) {
      console.warn('No refresh token received for', email);
    }

    await connectToDatabase();
    
    // Upsert account ke WorkspaceAccount MongoDB (Ground Truth)
    const updateData = { status: 'active' };
    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }

    await WorkspaceAccount.findOneAndUpdate(
      { email },
      { $set: updateData },
      { upsert: true, new: true }
    );

    // Jika akun yang dihubungkan adalah akun Admin, update juga ke .env.local & runtime memory
    const adminEmail = (process.env.ADMIN_EMAIL || 'mygameonhub@gmail.com').trim().toLowerCase();
    if (tokens.refresh_token && (email.toLowerCase() === adminEmail || email.toLowerCase().includes('mygameonhub'))) {
      try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
          let envText = fs.readFileSync(envPath, 'utf8');
          if (envText.includes('GOOGLE_REFRESH_TOKEN=')) {
            envText = envText.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
          } else {
            envText += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
          }
          fs.writeFileSync(envPath, envText, 'utf8');
          process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
          console.log('[OAuth Callback] Berhasil update GOOGLE_REFRESH_TOKEN di .env.local & runtime');
        }
      } catch (envErr) {
        console.warn('[OAuth Callback] Gagal update .env.local:', envErr.message);
      }
    }

    return NextResponse.redirect(new URL('/accounts?success=1', baseUrl));
  } catch (err) {
    console.error('Google OAuth Callback Error:', err);
    return NextResponse.redirect(new URL('/accounts?error=callback_failed', baseUrl));
  }
}
