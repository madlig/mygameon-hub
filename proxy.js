import { auth } from '@/app/api/auth/[...nextauth]/route'
import { getSiteUrl } from '@/lib/siteUrl'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === '/login'
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth')
  const isCronApi = req.nextUrl.pathname.startsWith('/api/cron')
  const isValidateApi = req.nextUrl.pathname.startsWith('/api/sims4/validate')
  const isC2Api = req.nextUrl.pathname.startsWith('/api/c2')
  const isHealthApi = req.nextUrl.pathname.startsWith('/api/health')
  const isWebhookApi = req.nextUrl.pathname.startsWith('/api/webhook')
  const isDownloadCatchApi = req.nextUrl.pathname.startsWith('/api/download/catch')

  if (isAuthApi || isCronApi || isValidateApi || isC2Api || isHealthApi || isWebhookApi || isDownloadCatchApi) {
    return // biarkan lewat (validasi key di route)
  }

  // Jika belum login dan memanggil API internal, kembalikan 401 JSON bukan 302 redirect HTML
  const isApi = req.nextUrl.pathname.startsWith('/api/')
  if (!isLoggedIn && isApi) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Gunakan baseUrl dinamis dari Host header request (bukan localhost hardcoded)
  const baseUrl = getSiteUrl(req)

  if (!isLoggedIn && !isLoginPage) {
    return Response.redirect(new URL('/login', baseUrl))
  }

  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL('/', baseUrl))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/auth|brand|icons|manifest|favicon.ico).*)'],
}