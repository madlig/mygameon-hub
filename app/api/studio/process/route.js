import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/db'
import mongoose from 'mongoose'
import fs from 'fs'
import { extractJob, archiveJob, uploadJob, getJobState, updateState } from '@/lib/studioProcessor'

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

    const {
      folderPath,
      targetEmail,
      config,
      action = 'upload',
      mode,
      targetFolderId,
      autoPropagate,
      gameName,
      customTitle,
      cleanReplace,
    } = await request.json()
    if (!folderPath) {
      return NextResponse.json({ error: 'Folder Path tidak lengkap' }, { status: 400 })
    }
    if ((action === 'upload' || action === 'extract_and_upload') && !targetEmail) {
      return NextResponse.json({ error: 'Target Email tidak lengkap untuk upload' }, { status: 400 })
    }

    await connectDB()

    const isLocal = fs.existsSync(folderPath)

    if (isLocal) {
      // ── Eksekusi Langsung di Background Server Lokal ──
      const localState = getJobState()
      if (localState?.status === 'processing') {
        return NextResponse.json({ error: 'Ada proses kompresi/upload/ekstraksi yang sedang berjalan!' }, { status: 429 })
      }

      // Inisialisasi status task
      const actionName =
        action === 'extract'
          ? 'Ekstraksi Arsip'
          : action === 'archive'
          ? 'Kompresi WinRAR'
          : action === 'extract_and_upload'
          ? 'Ekstraksi & Upload Otomatis'
          : 'Upload Game'

      updateState(
        { status: 'processing', progress: 0, text: `Memulai ${actionName}...`, logs: [] },
        `Memulai pekerjaan lokal: ${actionName} untuk ${folderPath}`
      )

      // Jalankan asinkron tanpa menahan response HTTP
      if (action === 'extract') {
        extractJob(folderPath).catch((err) => {
          console.error('Local extractJob failed:', err)
        })
      } else if (action === 'archive') {
        archiveJob(folderPath, config).catch((err) => {
          console.error('Local archiveJob failed:', err)
        })
      } else if (action === 'extract_and_upload') {
        (async () => {
          const { outputDir, cleanGameName } = await extractJob(folderPath)
          await uploadJob(outputDir, targetEmail, config, {
            mode: mode || 'new',
            targetFolderId: targetFolderId || null,
            autoPropagate: !!autoPropagate,
            gameName: customTitle || cleanGameName || gameName || null,
            customTitle: customTitle || cleanGameName || gameName || null,
            cleanReplace: cleanReplace !== false,
            forceArchive: true,
          })
        })().catch((err) => {
          console.error('Local extract_and_upload failed:', err)
        })
      } else {
        // Upload (auto-archive jika folder mentah)
        uploadJob(folderPath, targetEmail, config, {
          mode: mode || 'new',
          targetFolderId: targetFolderId || null,
          autoPropagate: !!autoPropagate,
          gameName: customTitle || gameName || null,
          customTitle: customTitle || gameName || null,
          cleanReplace: cleanReplace !== false,
        }).catch((err) => {
          console.error('Local uploadJob failed:', err)
        })
      }

      return NextResponse.json({
        success: true,
        message: `Pekerjaan ${actionName} dimulai secara lokal.`,
      })
    }

    // ── Fallback: Eksekusi Remote via C2 Queue jika Server di Cloud ──
    const state = await DesktopState.findOne({ machineId: 'mygameon-pc-1' })
    if (state?.currentTask?.status === 'processing') {
      return NextResponse.json({ error: 'Ada proses yang masih berjalan di PC Desktop!' }, { status: 429 })
    }

    let cmdType = 'START_UPLOAD'
    if (action === 'extract') cmdType = 'START_EXTRACT'
    else if (action === 'archive') cmdType = 'START_ARCHIVE'
    else if (action === 'extract_and_upload') cmdType = 'START_EXTRACT_AND_UPLOAD'

    await RemoteCommand.create({
      machineId: 'mygameon-pc-1',
      type: cmdType,
      status: 'pending',
      payload: {
        workspace: targetEmail,
        targetFolder: folderPath,
        rarConfig: config,
        options: {
          mode: mode || 'new',
          targetFolderId: targetFolderId || null,
          autoPropagate: !!autoPropagate,
          gameName: customTitle || gameName || null,
          customTitle: customTitle || gameName || null,
          cleanReplace: cleanReplace !== false,
        },
      },
    })

    return NextResponse.json({ success: true, message: `Command ${cmdType} terkirim ke Desktop PC` })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
