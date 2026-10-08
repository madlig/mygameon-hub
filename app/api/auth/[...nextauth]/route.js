import { google } from 'googleapis'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 hari (sesi awet di PWA iPhone)
  },
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
      name: 'Email & PIN Admin Mobile',
      credentials: {
        email: { label: 'Email Admin', type: 'email' },
        pin: { label: 'PIN Admin', type: 'password' },
      },
      async authorize(credentials) {
        const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
        const correctPin = process.env.ADMIN_PIN || 'mygameon'

        const inputEmail = (credentials?.email || '').trim().toLowerCase()
        const inputPin = credentials?.pin || ''

        // Validasi ganda: Wajib Email Admin DAN PIN Admin cocok
        if (
          adminEmail &&
          inputEmail === adminEmail &&
          inputPin === correctPin
        ) {
          return {
            id: 'admin_mobile',
            name: 'Administrator (Mobile)',
            email: process.env.ADMIN_EMAIL,
            image: '/brand/AMON_Shopee_Avatar_Circular_TransparentCorner.png',
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
      if (user) {
        token.email = user.email
        token.name = user.name
        token.picture = user.image
      }

      if (account?.provider === 'credentials') {
        token.accessToken = token.accessToken || null
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
      session.user = session.user || {}
      if (token.email) session.user.email = token.email
      if (token.name) session.user.name = token.name
      if (token.picture) session.user.image = token.picture
      session.accessToken = token.accessToken
      session.error = token.error
      return session
    },
    async redirect({ url, baseUrl }) {
      // Selalu izinkan path relatif agar diarahkan ke origin aktif (baik domain tunnel atau LAN)
      if (url.startsWith('/')) return url
      try {
        const u = new URL(url)
        // Hindari redirect ke internal host 0.0.0.0
        if (u.hostname !== '0.0.0.0' && u.hostname !== '127.0.0.1') return url
      } catch (_) {}
      return '/'
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
})

export const { GET, POST } = handlers