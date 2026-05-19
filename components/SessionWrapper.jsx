'use client'

import { useEffect } from 'react'
import { SessionProvider, signIn, useSession } from 'next-auth/react'

function TokenGuard({ children }) {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.error === 'RefreshTokenError') {
      signIn('google')
    }
  }, [session?.error])

  return children
}

export default function SessionWrapper({ children }) {
  return (
    <SessionProvider>
      <TokenGuard>{children}</TokenGuard>
    </SessionProvider>
  )
}