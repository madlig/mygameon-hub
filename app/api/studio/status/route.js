import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import connectDB from '@/lib/db'
import mongoose from 'mongoose'

const STATE_FILE = path.join(process.cwd(), 'studio-state.json')

function getLocalJobState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
    } catch (_) {}
  }
  return { status: 'idle', progress: 0, text: '', logs: [] }
}

function setLocalJobState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  } catch (_) {}
}

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
    // 1. Prioritaskan status lokal dari studio-state.json (Electron Desktop Mode)
    const localState = getLocalJobState()
    if (localState && (localState.status === 'processing' || localState.status === 'success' || localState.status === 'error')) {
      return NextResponse.json(localState)
    }

    // 2. Fallback ke DesktopState MongoDB (Remote C2 Mode)
    await connectDB()
    const state = await DesktopState.findOne({ machineId: 'mygameon-pc-1' })
    
    if (state && state.currentTask && (state.currentTask.status === 'processing' || state.currentTask.status === 'success' || state.currentTask.status === 'error')) {
      return NextResponse.json({
        status: state.currentTask.status,
        progress: state.currentTask.progress || 0,
        text: state.currentTask.text || '',
        logs: []
      })
    }

    // 3. Status Netral (Idle) jika tidak ada task yang sedang berjalan
    return NextResponse.json({ status: 'idle', progress: 0, text: '', logs: [] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    setLocalJobState({ status: 'idle', progress: 0, text: '', logs: [] })
    await connectDB()
    await DesktopState.updateOne(
      { machineId: 'mygameon-pc-1' },
      { $set: { 'currentTask.status': 'idle', 'currentTask.progress': 0, 'currentTask.text': '' } }
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
