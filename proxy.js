import { auth } from '@/app/api/auth/[...nextauth]/route'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === '/login'
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth')

  if (isAuthApi) return // biarkan NextAuth handle sendiri

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