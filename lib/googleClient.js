import { google } from 'googleapis'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectToDatabase from '@/lib/db'
import WorkspaceAccount from '@/models/WorkspaceAccount'

export async function getGoogleClients() {
  const session = await auth()

  if (!session?.accessToken) {
    throw new Error('Unauthorized')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  })

  // Auto refresh token jika expired
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.access_token) {
      session.accessToken = tokens.access_token
    }
  })

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