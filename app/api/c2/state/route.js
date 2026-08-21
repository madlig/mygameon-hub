import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import DesktopState from '@/models/DesktopState'

// Middleware to check C2 Secret
function checkAuth(req) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || authHeader !== `Bearer ${process.env.C2_SECRET_KEY}`) {
    return false
  }
  return true
}

// GET /api/c2/state - For Mobile App to read state (Protected by NextAuth in real app, but for now we'll just return it)
export async function GET(req) {
  try {
    await connectToDatabase()
    const url = new URL(req.url)
    const machineId = url.searchParams.get('machineId') || 'mygameon-pc-1'
    
    const state = await DesktopState.findOne({ machineId })
    return NextResponse.json({ success: true, state })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST /api/c2/state - For Desktop App to report its heartbeat (Protected by C2_SECRET_KEY)
export async function POST(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const data = await req.json()
    const { machineId, folders, currentTask } = data
    
    if (!machineId) return NextResponse.json({ error: 'machineId is required' }, { status: 400 })

    await connectToDatabase()
    
    const state = await DesktopState.findOneAndUpdate(
      { machineId },
      { 
        $set: { 
          isOnline: true, 
          lastSeen: new Date(),
          ...(folders && { folders }),
          ...(currentTask && { currentTask })
        } 
      },
      { new: true, upsert: true }
    )
    
    return NextResponse.json({ success: true, state })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
