import { google } from 'googleapis'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectToDatabase from '@/lib/db'
import WorkspaceAccount from '@/models/WorkspaceAccount'

export async function getGoogleClients() {
  await connectToDatabase()
  let session = null
  try {
    session = await auth()
  } catch (_) {}

  // 1. Prioritaskan refresh token admin dari MongoDB WorkspaceAccount
  let refreshToken = null
  const adminEmail = (process.env.ADMIN_EMAIL || 'mygameonhub@gmail.com').trim().toLowerCase()

  try {
    const adminAccount = await WorkspaceAccount.findOne({
      email: { $regex: new RegExp('^' + adminEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
    })
    if (adminAccount?.refreshToken) {
      refreshToken = adminAccount.refreshToken
    }
  } catch (dbErr) {
    console.warn('[getGoogleClients] Gagal cek WorkspaceAccount admin:', dbErr.message)
  }

  // 2. Fallback ke session refreshToken atau env GOOGLE_REFRESH_TOKEN
  if (!refreshToken) {
    refreshToken = session?.refreshToken || process.env.GOOGLE_REFRESH_TOKEN
  }

  if (!session?.accessToken && !refreshToken) {
    throw new Error('Unauthorized: No session token or GOOGLE_REFRESH_TOKEN configured')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  if (refreshToken) {
    oauth2Client.setCredentials({
      access_token: session?.accessToken,
      refresh_token: refreshToken,
    })

    oauth2Client.on('tokens', (tokens) => {
      if (tokens.access_token && session) {
        session.accessToken = tokens.access_token
      }
    })
  } else {
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    })
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

  return { drive, gmail, sheets, session }
}

export async function getClientForEmail(email) {
  await connectToDatabase();
  let account = await WorkspaceAccount.findOne({ email });
  
  // Jika identifier berupa shared drive (misal shared:0ALxyHsjPxl82Uk9PVA atau kebersamaan), pakai akun workspace aktif
  if (!account && (email?.startsWith('shared:') || email === 'shared_drive' || email?.toLowerCase().includes('kebersamaan'))) {
    account = await WorkspaceAccount.findOne({ status: 'active', refreshToken: { $exists: true, $ne: '' } });
    if (!account) {
      account = await WorkspaceAccount.findOne({ refreshToken: { $exists: true, $ne: '' } });
    }
  }

  if (!account || !account.refreshToken) {
    throw new Error(`Token tidak ditemukan untuk email: ${email}. Harap hubungkan akun ini di menu Kelola Akun.`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: account.refreshToken,
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  return drive;
}