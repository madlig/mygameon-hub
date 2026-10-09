import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import {
  mountIsoImage,
  dismountIsoImage,
  launchGameSetup,
  getInstallerSession,
  finalizePreInstalledGame,
  runAutoInstallPipeline,
  getPipelineSession,
  abortAutoInstallPipeline
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
        const { exePath, targetDir, silent = false, sessionId, userName } = body
        if (!exePath || !targetDir) {
          return NextResponse.json({ error: 'exePath dan targetDir diperlukan' }, { status: 400 })
        }
        const sessionData = launchGameSetup({ exePath, targetDir, silent, sessionId, userName: userName || 'mygameon' })
        return NextResponse.json({ success: true, session: sessionData })
      }

      case 'check_status': {
        const { sessionId } = body
        if (!sessionId) return NextResponse.json({ error: 'sessionId diperlukan' }, { status: 400 })
        const sessionData = getInstallerSession(sessionId)
        return NextResponse.json({ success: true, session: sessionData })
      }

      case 'finalize': {
        const { targetDir, rawBaseFolder, rawUpdateFolder, isoPath, cleanTitle, userName } = body
        if (!targetDir || !cleanTitle) {
          return NextResponse.json({ error: 'targetDir dan cleanTitle diperlukan' }, { status: 400 })
        }
        const result = finalizePreInstalledGame({
          targetDir,
          rawBaseFolder,
          rawUpdateFolder,
          isoPath,
          cleanTitle,
          userName: userName || 'mygameon'
        })
        return NextResponse.json({ success: true, data: result })
      }

      case 'auto_pipeline': {
        const { folderName, targetDir, userName, silentMode } = body
        if (!folderName) return NextResponse.json({ error: 'folderName diperlukan' }, { status: 400 })
        const config = getDownloadConfig()
        const downloadDir = config.downloadDir || 'D:\\Game\\Shopee\\GameDownload'
        const uploadDir = config.uploadDir || 'D:\\Game\\Shopee\\GameUpload'
        const pipeline = runAutoInstallPipeline({
          downloadDir,
          uploadDir,
          folderName,
          customTargetDir: targetDir,
          userName: userName || 'mygameon',
          silentMode: silentMode || 'headless'
        })
        return NextResponse.json({ success: true, pipeline })
      }

      case 'pipeline_status': {
        const { pipelineId } = body
        if (!pipelineId) return NextResponse.json({ error: 'pipelineId diperlukan' }, { status: 400 })
        const pipeline = getPipelineSession(pipelineId)
        if (!pipeline) return NextResponse.json({ error: 'Pipeline tidak ditemukan' }, { status: 404 })
        return NextResponse.json({ success: true, pipeline })
      }

      case 'abort_pipeline': {
        const { pipelineId } = body
        if (!pipelineId) return NextResponse.json({ error: 'pipelineId diperlukan' }, { status: 400 })
        const aborted = abortAutoInstallPipeline(pipelineId)
        return NextResponse.json({ success: true, aborted })
      }

      case 'delete_raw_folder': {
        const { folderName } = body
        if (!folderName) return NextResponse.json({ error: 'folderName diperlukan' }, { status: 400 })
        const config = getDownloadConfig()
        const downloadDir = config.downloadDir || 'D:\\Game\\Shopee\\GameDownload'
        const targetPath = path.join(downloadDir, folderName)

        // Validasi path traversal
        const resolvedBase = path.resolve(downloadDir).toLowerCase()
        const resolvedTarget = path.resolve(targetPath).toLowerCase()
        if (!resolvedTarget.startsWith(resolvedBase) || resolvedTarget === resolvedBase) {
          return NextResponse.json({ error: 'Akses folder tidak diizinkan' }, { status: 403 })
        }

        if (!fs.existsSync(targetPath)) {
          return NextResponse.json({ error: 'Folder tidak ditemukan' }, { status: 404 })
        }

        try {
          fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
          return NextResponse.json({ success: true, message: `Folder mentahan ${folderName} berhasil dihapus.` })
        } catch (rmErr) {
          console.warn('[delete_raw_folder] fs.rmSync gagal, mencoba fallback OS:', rmErr.message)
          try {
            if (process.platform === 'win32') {
              execSync(`powershell -NoProfile -Command "Remove-Item -LiteralPath '${targetPath.replace(/'/g, "''")}' -Recurse -Force"`, { timeout: 60000 })
            } else {
              execSync(`rm -rf "${targetPath}"`, { timeout: 60000 })
            }
            return NextResponse.json({ success: true, message: `Folder mentahan ${folderName} berhasil dihapus.` })
          } catch (osErr) {
            return NextResponse.json({ error: `Gagal menghapus folder: ${rmErr.message}` }, { status: 500 })
          }
        }
      }

      default:
        return NextResponse.json({ error: `Action '${action}' tidak dikenali` }, { status: 400 })
    }
  } catch (err) {
    console.error('[installer/action] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
