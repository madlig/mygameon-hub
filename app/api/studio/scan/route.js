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

export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const state = await DesktopState.findOne({ machineId: 'mygameon-pc-1' })

    if (!state || !state.isOnline) {
      return NextResponse.json({ 
        success: false, 
        error: `Desktop PC Offline. Pastikan Zombi Pekerja berjalan di PC Anda.`, 
        path: '-',
        items: [] 
      })
    }

    return NextResponse.json({
      success: true,
      path: 'D:\\Game\\Shopee\\GameUpload (via C2)',
      folders: state.folders || [],
      archives: []
    })

  } catch (err) {
    console.error('Studio Scan Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
