import { NextResponse } from 'next/server';
import { google } from 'googleapis';
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
      // If no refresh token, they might have already authorized without prompt=consent.
      // We forced prompt=consent in the initiator, but just in case.
      console.warn('No refresh token received for', email);
    }

    await connectToDatabase();
    
    // Upsert account
    const updateData = { status: 'active' };
    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }
    // We only strictly NEED refresh token. If it's not provided and we don't have it, we can't do much.

    await WorkspaceAccount.findOneAndUpdate(
      { email },
      { $set: updateData },
      { upsert: true, new: true }
    );

    return NextResponse.redirect(new URL('/accounts?success=1', baseUrl));
  } catch (err) {
    console.error('Google OAuth Callback Error:', err);
    return NextResponse.redirect(new URL('/accounts?error=callback_failed', baseUrl));
  }
}
