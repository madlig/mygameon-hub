import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/db'
import mongoose from 'mongoose'

const desktopStateSchema = new mongoose.Schema({
  machineId: String,
  isOnline: Boolean,
  lastSeen: Date,
  folders: [{ name: String, path: String }],
  currentTask: {
    status: String,
    progress: Number,
    text: String,
    commandId: String
  }
}, { timestamps: true })

let DesktopState
try {
  DesktopState = mongoose.model('DesktopState')
} catch (e) {
  DesktopState = mongoose.model('DesktopState', desktopStateSchema)
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const state = await DesktopState.findOne({ machineId: 'mygameon-pc-1' })
    
    if (!state || !state.currentTask) {
      return NextResponse.json({ status: 'idle', progress: 0, text: '' })
    }

    return NextResponse.json({
      status: state.currentTask.status || 'idle',
      progress: state.currentTask.progress || 0,
      text: state.currentTask.text || ''
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
