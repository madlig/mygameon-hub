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

const remoteCommandSchema = new mongoose.Schema({
  machineId: String,
  type: String,
  payload: mongoose.Schema.Types.Mixed,
  status: String,
  result: mongoose.Schema.Types.Mixed,
  error: String,
  createdAt: { type: Date, default: Date.now, expires: 86400 }
})

let DesktopState, RemoteCommand
try { DesktopState = mongoose.model('DesktopState') } catch(e) { DesktopState = mongoose.model('DesktopState', desktopStateSchema) }
try { RemoteCommand = mongoose.model('RemoteCommand') } catch(e) { RemoteCommand = mongoose.model('RemoteCommand', remoteCommandSchema) }

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { folderPath, targetEmail, config, action } = await request.json()
    if (!folderPath) {
      return NextResponse.json({ error: 'Folder Path tidak lengkap' }, { status: 400 })
    }
    if (action === 'upload' && !targetEmail) {
      return NextResponse.json({ error: 'Target Email tidak lengkap untuk upload' }, { status: 400 })
    }

    await connectDB()

    // Cek apakah ada proses yang masih berjalan di PC
    const state = await DesktopState.findOne({ machineId: 'mygameon-pc-1' })
    if (state?.currentTask?.status === 'processing') {
      return NextResponse.json({ error: 'Ada proses yang masih berjalan di PC Zombi!' }, { status: 429 })
    }

    // Eksekusi di background via C2
    const cmdType = action === 'archive' ? 'START_ARCHIVE' : 'START_UPLOAD'
    await RemoteCommand.create({
      machineId: 'mygameon-pc-1',
      type: cmdType,
      status: 'pending',
      payload: { workspace: targetEmail, targetFolder: folderPath, rarConfig: config }
    })

    return NextResponse.json({ success: true, message: `Command ${cmdType} terkirim ke Zombi PC` })

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
