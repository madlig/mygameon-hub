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
    const { url } = data
    
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    await connectToDatabase()
    
    // We send a SCRAPE command to the desktop
    const command = await RemoteCommand.create({
      machineId: 'mygameon-pc-1',
      type: 'SCRAPE',
      payload: { url },
      status: 'pending'
    })
    
    return NextResponse.json({ success: true, commandId: command._id })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// GET method to check the status of a specific scrape command
export async function GET(req) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const commandId = searchParams.get('commandId')
    
    if (!commandId) return NextResponse.json({ error: 'commandId is required' }, { status: 400 })

    await connectToDatabase()
    
    const command = await RemoteCommand.findById(commandId)
    if (!command) return NextResponse.json({ error: 'Command not found' }, { status: 404 })

    return NextResponse.json({ success: true, command })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
