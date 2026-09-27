import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { scanDownloadDirectory, getDownloadConfig, saveDownloadConfig } from '@/lib/downloadWatcher'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = scanDownloadDirectory()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const currentConfig = getDownloadConfig()

    const newConfig = {
      ...currentConfig,
      ...body
    }

    const saved = saveDownloadConfig(newConfig)
    return NextResponse.json({ success: true, config: saved })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
