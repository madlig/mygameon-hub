import { auth } from '@/app/api/auth/[...nextauth]/route'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === '/login'
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth')
  const isCronApi = req.nextUrl.pathname.startsWith('/api/cron')
  const isValidateApi = req.nextUrl.pathname.startsWith('/api/sims4/validate')
  const isC2Api = req.nextUrl.pathname.startsWith('/api/c2')
  const isHealthApi = req.nextUrl.pathname.startsWith('/api/health')

  if (isAuthApi || isCronApi || isValidateApi || isC2Api || isHealthApi) return // biarkan lewat tanpa auth check

  if (!isLoggedIn && !isLoginPage) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }

  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL('/', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}