import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import RemoteCommand from '@/models/RemoteCommand'

// Middleware to check C2 Secret
function checkAuth(req) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || authHeader !== `Bearer ${process.env.C2_SECRET_KEY}`) {
    return false
  }
  return true
}

// GET /api/c2/command - For Desktop App to poll for new commands (Protected by C2_SECRET_KEY)
export async function GET(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    await connectToDatabase()
    const url = new URL(req.url)
    const machineId = url.searchParams.get('machineId') || 'mygameon-pc-1'
    
    // Find the oldest pending command
    const command = await RemoteCommand.findOneAndUpdate(
      { machineId, status: 'pending' },
      { $set: { status: 'processing' } },
      { sort: { createdAt: 1 }, new: true }
    )
    
    return NextResponse.json({ success: true, command })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST /api/c2/command - For Mobile App to send a command (Protected by NextAuth, but we'll simulate for now)
export async function POST(req) {
  try {
    const data = await req.json()
    const { machineId = 'mygameon-pc-1', type, payload } = data
    
    if (!type) return NextResponse.json({ error: 'Type is required' }, { status: 400 })

    await connectToDatabase()
    
    const command = await RemoteCommand.create({
      machineId,
      type,
      payload,
      status: 'pending'
    })
    
    return NextResponse.json({ success: true, command })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PATCH /api/c2/command - For Desktop App to update command status (completed/failed) (Protected by C2_SECRET_KEY)
export async function PATCH(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const data = await req.json()
    const { commandId, status, result, error } = data
    
    if (!commandId) return NextResponse.json({ error: 'commandId is required' }, { status: 400 })

    await connectToDatabase()
    
    const command = await RemoteCommand.findByIdAndUpdate(
      commandId,
      { $set: { status, ...(result && { result }), ...(error && { error }) } },
      { new: true }
    )
    
    return NextResponse.json({ success: true, command })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
