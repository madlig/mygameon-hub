import { NextResponse } from 'next/server'
import { generateShopeeListing } from '@/lib/aiGenerator'
import { auth } from '@/app/api/auth/[...nextauth]/route'

export async function POST(req) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameTitle, gameSynopsis } = await req.json()
    
    if (!gameTitle || !gameSynopsis) {
      return NextResponse.json({ error: 'Data game tidak lengkap' }, { status: 400 })
    }

    const result = await generateShopeeListing(gameTitle, gameSynopsis)
    
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
