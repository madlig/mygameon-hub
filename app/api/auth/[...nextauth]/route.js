import { google } from 'googleapis'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'

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
    Credentials({
      id: 'credentials',
      name: 'PIN Admin Mobile',
      credentials: {
        pin: { label: 'PIN Admin', type: 'password' },
      },
      async authorize(credentials) {
        const correctPin = process.env.ADMIN_PIN || process.env.C2_SECRET_KEY || 'mygameon'
        if (credentials?.pin && credentials.pin === correctPin) {
          return {
            id: 'admin_mobile',
            name: 'Administrator (Mobile)',
            email: process.env.ADMIN_EMAIL || 'admin@mygameon.store',
            image: '/icons/icon-192.png',
          }
        }
        return null
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') {
        return true
      }
      return user.email === process.env.ADMIN_EMAIL
    },
    async jwt({ token, user, account }) {
      if (account?.provider === 'credentials') {
        token.accessToken = token.accessToken || null
        token.email = user.email
        token.name = user.name
        return token
      }

      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }

      // Cek apakah token expired (hanya untuk provider google)
      if (token.expiresAt && Date.now() < token.expiresAt * 1000) {
        return token // Masih valid
      }

      if (token.refreshToken) {
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
      }

      return token
    },
    async session({ session, token }) {
      if (token.email) session.user.email = token.email
      if (token.name) session.user.name = token.name
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