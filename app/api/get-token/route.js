import { auth } from '@/app/api/auth/[...nextauth]/route'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  return NextResponse.json({
    refreshToken: session?.refreshToken || null
  })
}