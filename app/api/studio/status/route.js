import { NextResponse } from 'next/server'
import { getJobState } from '@/lib/studioProcessor'
import { auth } from '@/app/api/auth/[...nextauth]/route'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const state = getJobState()
    return NextResponse.json(state)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
