import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/db'
import mongoose from 'mongoose'
import { activeJobController, getJobState } from '@/lib/studioProcessor'

const remoteCommandSchema = new mongoose.Schema({
  machineId: String,
  type: String,
  payload: mongoose.Schema.Types.Mixed,
  status: String,
  result: mongoose.Schema.Types.Mixed,
  error: String,
  createdAt: { type: Date, default: Date.now, expires: 86400 }
})

let RemoteCommand
try { RemoteCommand = mongoose.model('RemoteCommand') } catch(e) { RemoteCommand = mongoose.model('RemoteCommand', remoteCommandSchema) }

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await request.json()
    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Aksi tidak valid. Pilihan: pause, resume, cancel' }, { status: 400 })
    }

    // 1. Eksekusi kontrol proses pada server lokal
    let localResult = null
    if (action === 'pause') {
      localResult = activeJobController.pause()
    } else if (action === 'resume') {
      localResult = activeJobController.resume()
    } else if (action === 'cancel') {
      localResult = activeJobController.cancel()
    }

    // 2. Kirim juga command remote ke PC Desktop jika menggunakan mode remote C2
    try {
      await connectDB()
      let cmdType = 'CANCEL_TASK'
      if (action === 'pause') cmdType = 'PAUSE_TASK'
      else if (action === 'resume') cmdType = 'RESUME_TASK'

      await RemoteCommand.create({
        machineId: 'mygameon-pc-1',
        type: cmdType,
        status: 'pending',
        payload: { timestamp: new Date().toISOString() }
      })
    } catch (_) {}

    return NextResponse.json({
      success: true,
      action,
      localResult,
      jobState: getJobState()
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
