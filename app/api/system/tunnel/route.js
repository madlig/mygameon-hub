import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { remoteTunnel } from '@/lib/remoteTunnel'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const status = remoteTunnel.getStatus()
    return NextResponse.json({ success: true, tunnel: status })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { action = 'start', port = 3000, token = null } = body

    if (action === 'stop') {
      const status = remoteTunnel.stop()
      return NextResponse.json({ success: true, tunnel: status })
    }

    const status = await remoteTunnel.start({ port, token })
    return NextResponse.json({ success: true, tunnel: status })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
