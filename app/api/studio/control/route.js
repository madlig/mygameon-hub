import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/db'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { activeJobController, getJobState, updateState, uploadJob } from '@/lib/studioProcessor'

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

      // Jika activeJobController tidak sedang menjeda proses in-memory (misal: proses mati karena error atau server restart)
      if (!localResult || !localResult.success) {
        const localState = getJobState()
        const isInterruptedUpload =
          localState &&
          (localState.status === 'error' || localState.status === 'paused' || localState.status === 'idle') &&
          (localState.phase === 'uploading' || localState.targetEmail || localState.driveFolderId)

        if (isInterruptedUpload && localState.targetEmail) {
          // Cari folder lokal yang valid
          let targetPath = localState.folderPath
          if (!targetPath || !fs.existsSync(targetPath)) {
            const candidates = [
              path.join('D:\\Game\\Shopee\\GameUpload', localState.gameName || ''),
              'D:\\Game\\Shopee\\GameUpload',
            ]
            for (const cand of candidates) {
              if (fs.existsSync(cand)) {
                targetPath = cand
                break
              }
            }
          }

          if (targetPath && fs.existsSync(targetPath)) {
            updateState(
              {
                status: 'processing',
                text: `Melanjutkan kembali upload '${localState.gameName || 'Game'}' ke Google Drive...`,
                errorDetail: null,
              },
              `Perintah resume diterima. Menghubungkan ulang upload ke Google Drive (${localState.targetEmail})...`
            )

            // Jalankan uploadJob di background tanpa menahan HTTP response
            uploadJob(targetPath, localState.targetEmail, {}, {
              resume: true,
              targetFolderId: localState.driveFolderId || null,
              gameName: localState.gameName,
              customTitle: localState.gameName,
              cleanReplace: false,
              forceWipeExisting: false,
              fileVersion: localState.fileVersion || '',
            }).catch((err) => {
              console.error('[Resume Dead Upload Error]', err)
            })

            localResult = { success: true, resumed: true, status: 'processing' }
          } else {
            localResult = {
              success: false,
              reason: `Folder lokal tidak ditemukan untuk melanjutkan: ${targetPath || localState.gameName}`,
            }
          }
        }
      }
    } else if (action === 'cancel') {
      localResult = activeJobController.cancel()
      if (!localResult || !localResult.success) {
        updateState({
          status: 'cancelled',
          progress: 0,
          text: 'Proses dibatalkan oleh pengguna.',
          phase: 'cancelled',
        }, 'Pekerjaan dibatalkan atas permintaan pengguna.')
        localResult = { success: true, status: 'cancelled' }
      }
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
