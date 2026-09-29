import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import {
  mountIsoImage,
  dismountIsoImage,
  launchGameSetup,
  getInstallerSession,
  finalizePreInstalledGame,
  runAutoInstallPipeline,
  getPipelineSession
} from '@/lib/gameInstaller'
import { getDownloadConfig } from '@/lib/downloadWatcher'

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (!action) {
      return NextResponse.json({ error: 'Parameter action diperlukan' }, { status: 400 })
    }

    switch (action) {
      case 'mount': {
        const { isoPath } = body
        if (!isoPath) return NextResponse.json({ error: 'isoPath diperlukan' }, { status: 400 })
        const mountData = mountIsoImage(isoPath)
        return NextResponse.json({ success: true, data: mountData })
      }

      case 'dismount': {
        const { isoPath } = body
        if (!isoPath) return NextResponse.json({ error: 'isoPath diperlukan' }, { status: 400 })
        const ok = dismountIsoImage(isoPath)
        return NextResponse.json({ success: true, dismounted: ok })
      }

      case 'launch_setup': {
        const { exePath, targetDir, silent = false, sessionId } = body
        if (!exePath || !targetDir) {
          return NextResponse.json({ error: 'exePath dan targetDir diperlukan' }, { status: 400 })
        }
        const sessionData = launchGameSetup({ exePath, targetDir, silent, sessionId })
        return NextResponse.json({ success: true, session: sessionData })
      }

      case 'check_status': {
        const { sessionId } = body
        if (!sessionId) return NextResponse.json({ error: 'sessionId diperlukan' }, { status: 400 })
        const sessionData = getInstallerSession(sessionId)
        return NextResponse.json({ success: true, session: sessionData })
      }

      case 'finalize': {
        const { targetDir, rawBaseFolder, rawUpdateFolder, isoPath, cleanTitle } = body
        if (!targetDir || !cleanTitle) {
          return NextResponse.json({ error: 'targetDir dan cleanTitle diperlukan' }, { status: 400 })
        }
        const result = finalizePreInstalledGame({
          targetDir,
          rawBaseFolder,
          rawUpdateFolder,
          isoPath,
          cleanTitle
        })
        return NextResponse.json({ success: true, data: result })
      }

      case 'auto_pipeline': {
        const { folderName } = body
        if (!folderName) return NextResponse.json({ error: 'folderName diperlukan' }, { status: 400 })
        const config = getDownloadConfig()
        const uploadDir = config.uploadDir || 'D:\\Game\\Shopee\\GameUpload'
        const pipeline = runAutoInstallPipeline({ uploadDir, folderName })
        return NextResponse.json({ success: true, pipeline })
      }

      case 'pipeline_status': {
        const { pipelineId } = body
        if (!pipelineId) return NextResponse.json({ error: 'pipelineId diperlukan' }, { status: 400 })
        const pipeline = getPipelineSession(pipelineId)
        if (!pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })
        return NextResponse.json({ success: true, pipeline })
      }

      default:
        return NextResponse.json({ error: `Action '${action}' tidak dikenali` }, { status: 400 })
    }
  } catch (err) {
    console.error('[installer/action] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
