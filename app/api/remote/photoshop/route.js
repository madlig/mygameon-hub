import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import RemoteCommand from '@/models/RemoteCommand'
import { auth } from '@/app/api/auth/[...nextauth]/route'

export async function POST(req) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await req.json()
    const { title, coverImage, images } = data
    
    if (!title || !coverImage || !images || images.length === 0) {
      return NextResponse.json({ error: 'Data gambar tidak lengkap untuk diekspor' }, { status: 400 })
    }

    await connectToDatabase()
    
    // We send a PHOTOSHOP_EXPORT command to the desktop
    const command = await RemoteCommand.create({
      machineId: 'mygameon-pc-1',
      type: 'PHOTOSHOP_EXPORT',
      payload: { title, coverImage, images },
      status: 'pending'
    })
    
    return NextResponse.json({ success: true, commandId: command._id })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
