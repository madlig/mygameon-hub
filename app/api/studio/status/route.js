import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import connectDB from '@/lib/db'
import mongoose from 'mongoose'

import { activeJobController } from '@/lib/studioProcessor'

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
    const activeStatuses = ['processing', 'paused', 'cancelled', 'success', 'error']
    if (localState && activeStatuses.includes(localState.status)) {
      // Deteksi zombie state jika proses lokal mati akibat restart PC/server
      // Berikan toleransi grace period 35 detik berdasarkan updatedAt untuk mencegah false-positive saat inisialisasi
      const ctrlStatus = activeJobController.getStatus()
      const now = Date.now()
      const lastUpdate = localState.updatedAt || 0
      const isStale = (now - lastUpdate) > 35000

      if (
        (localState.status === 'processing' || localState.status === 'paused') &&
        isStale &&
        !ctrlStatus.isPaused &&
        !ctrlStatus.hasActiveStream &&
        !ctrlStatus.hasActiveChild
      ) {
        localState.status = 'error'
        localState.text = 'Operasi terputus karena PC/server terestart. Silakan klik tombol Upload kembali untuk melanjutkan.'
        localState.errorDetail = {
          category: 'RESTART_RECOVERY',
          title: 'Koneksi Terputus (PC / Server Terestart)',
          cause: 'Proses upload terhenti karena komputer atau aplikasi dimatikan/direstart.',
          solution: 'File part yang sudah selesai (100%) aman tersimpan di Google Drive. Klik tombol Upload kembali untuk otomatis menyambung.',
        }
        setLocalJobState(localState)
      }

      if (localState.status === 'success' || localState.phase === 'done') {
        localState.overallProgress = 100
        localState.progress = 100
        localState.speedMBps = 0
        localState.etaSeconds = 0
        if (localState.action === 'archive' && localState.totalParts) {
          localState.currentPart = localState.totalParts
        }
      }
      return NextResponse.json({ success: true, state: localState, ...localState })
    }

    // 2. Fallback ke DesktopState MongoDB (Remote C2 Mode)
    await connectDB()
    const state = await DesktopState.findOne({ machineId: 'mygameon-pc-1' })
    
    if (state && state.currentTask && activeStatuses.includes(state.currentTask.status)) {
      const remoteState = {
        status: state.currentTask.status,
        progress: state.currentTask.progress || 0,
        text: state.currentTask.text || '',
        logs: [],
        errorDetail: state.currentTask.errorDetail || null,
      }
      return NextResponse.json({ success: true, state: remoteState, ...remoteState })
    }

    // 3. Status Netral (Idle) jika tidak ada task yang sedang berjalan
    const idleState = { status: 'idle', progress: 0, text: '', logs: [], errorDetail: null }
    return NextResponse.json({ success: true, state: idleState, ...idleState })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    setLocalJobState({ status: 'idle', progress: 0, text: '', logs: [], errorDetail: null })
    await connectDB()
    await DesktopState.updateOne(
      { machineId: 'mygameon-pc-1' },
      { $set: { 'currentTask.status': 'idle', 'currentTask.progress': 0, 'currentTask.text': '', 'currentTask.errorDetail': null } }
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
