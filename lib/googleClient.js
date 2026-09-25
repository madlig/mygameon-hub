import { google } from 'googleapis'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectToDatabase from '@/lib/db'
import WorkspaceAccount from '@/models/WorkspaceAccount'

export async function getGoogleClients() {
  let session = null
  try {
    session = await auth()
  } catch (_) {}

  const refreshToken = session?.refreshToken || process.env.GOOGLE_REFRESH_TOKEN

  if (!session?.accessToken && !refreshToken) {
    throw new Error('Unauthorized: No session token or GOOGLE_REFRESH_TOKEN configured')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  if (session?.accessToken) {
    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: refreshToken,
    })

    oauth2Client.on('tokens', (tokens) => {
      if (tokens.access_token && session) {
        session.accessToken = tokens.access_token
      }
    })
  } else {
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    })
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

  return { drive, gmail, sheets, session }
}

export async function getClientForEmail(email) {
  await connectToDatabase();
  const account = await WorkspaceAccount.findOne({ email });
  
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