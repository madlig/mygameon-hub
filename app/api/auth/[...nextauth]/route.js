import { google } from 'googleapis'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/spreadsheets',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],

  callbacks: {
  async signIn({ user }) {
    return user.email === process.env.ADMIN_EMAIL
  },
  async jwt({ token, account }) {
    if (account) {
      token.accessToken = account.access_token
      token.refreshToken = account.refresh_token
      token.expiresAt = account.expires_at
    }

    // Cek apakah token sudah expired
    if (Date.now() < token.expiresAt * 1000) {
      return token // Masih valid
    }

    // Token expired — refresh
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      )
      oauth2Client.setCredentials({ refresh_token: token.refreshToken })
      const { credentials } = await oauth2Client.refreshAccessToken()

      return {
        ...token,
        accessToken: credentials.access_token,
        expiresAt: Math.floor(credentials.expiry_date / 1000),
      }
    } catch (e) {
      console.error('Refresh token error:', e)
      return { ...token, error: 'RefreshTokenError' }
    }
  },
  async session({ session, token }) {
    session.accessToken = token.accessToken
    session.error = token.error
    return session
  },
},

  pages: {
    signIn: '/login',
    error: '/login',
  },
})

export const { GET, POST } = handlers