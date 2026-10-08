import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { launchJDownloader } from '@/lib/downloadWatcher'
import { streamDownloader, StreamDownloader } from '@/lib/streamDownloader'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

function invokeStream(methodName, ...args) {
  if (streamDownloader && typeof streamDownloader[methodName] === 'function') {
    return streamDownloader[methodName](...args)
  }
  if (StreamDownloader?.prototype && typeof StreamDownloader.prototype[methodName] === 'function') {
    return StreamDownloader.prototype[methodName].apply(streamDownloader, args)
  }
  console.warn(`[Download Control] Method ${methodName} tidak ditemukan pada streamDownloader instance`)
  return false
}

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, taskId, url, filename, referrer, cookies, targetPath, deleteFile } = body

    if (action === 'pause') {
      if (!taskId) return NextResponse.json({ error: 'Task ID wajib diisi' }, { status: 400 })
      const ok = invokeStream('pauseDownload', taskId)
      return NextResponse.json({ success: ok, message: ok ? 'Unduhan dijeda' : 'Gagal menjeda unduhan' })
    }

    if (action === 'resume') {
      if (!taskId) return NextResponse.json({ error: 'Task ID wajib diisi' }, { status: 400 })
      const ok = invokeStream('resumeDownload', taskId)
      return NextResponse.json({ success: ok, message: ok ? 'Unduhan dilanjutkan' : 'Gagal melanjutkan unduhan' })
    }

    if (action === 'cancel') {
      if (!taskId) return NextResponse.json({ error: 'Task ID wajib diisi' }, { status: 400 })
      const ok = invokeStream('cancelDownload', taskId, deleteFile !== false)
      return NextResponse.json({ success: ok, message: ok ? 'Unduhan dibatalkan' : 'Gagal membatalkan unduhan' })
    }

    if (action === 'pause_package') {
      const packageName = body.packageName
      if (!packageName) return NextResponse.json({ error: 'Nama paket wajib diisi' }, { status: 400 })
      const ok = invokeStream('pausePackage', packageName)
      return NextResponse.json({ success: ok, message: ok ? `Paket "${packageName}" dijeda` : 'Gagal menjeda paket' })
    }

    if (action === 'resume_package') {
      const packageName = body.packageName
      if (!packageName) return NextResponse.json({ error: 'Nama paket wajib diisi' }, { status: 400 })
      const ok = invokeStream('resumePackage', packageName)
      return NextResponse.json({ success: ok, message: ok ? `Paket "${packageName}" dilanjutkan` : 'Gagal melanjutkan paket' })
    }

    if (action === 'cancel_package') {
      const packageName = body.packageName
      if (!packageName) return NextResponse.json({ error: 'Nama paket wajib diisi' }, { status: 400 })
      let ok = invokeStream('cancelPackage', packageName, deleteFile !== false)

      // Fallback: Jika tidak terdaftar di streamDownloader tasks, periksa folder fisik di downloadDir
      if (!ok) {
        try {
          const { getDownloadConfig } = await import('@/lib/downloadWatcher')
          const config = getDownloadConfig()
          const downloadDir = config.downloadDir || 'D:\\Game\\Shopee\\GameDownload'
          const candidateFolder = path.join(downloadDir, packageName)
          if (fs.existsSync(candidateFolder)) {
            if (deleteFile !== false) {
              fs.rmSync(candidateFolder, { recursive: true, force: true })
            }
            ok = true
          }
        } catch (_) {}
      }

      return NextResponse.json({ success: ok, message: ok ? `Paket "${packageName}" dibatalkan` : 'Gagal membatalkan paket' })
    }

    if (action === 'pause_all') {
      const ok = invokeStream('pauseAll')
      return NextResponse.json({ success: ok, message: 'Seluruh unduhan dijeda' })
    }

    if (action === 'resume_all') {
      const ok = invokeStream('resumeAll')
      return NextResponse.json({ success: ok, message: 'Seluruh antrean unduhan dilanjutkan' })
    }

    if (action === 'set_concurrency') {
      const { getDownloadConfig, saveDownloadConfig } = await import('@/lib/downloadWatcher')
      const current = getDownloadConfig()
      const limit = Math.max(1, Math.min(5, parseInt(body.concurrency || 1, 10)))
      const updated = saveDownloadConfig({ ...current, maxConcurrent: limit })
      invokeStream('processQueue')
      return NextResponse.json({ success: true, message: `Batas unduhan aktif diatur ke ${limit} game`, config: updated })
    }

    if (action === 'start_task') {
      if (!taskId) return NextResponse.json({ error: 'Task ID wajib diisi' }, { status: 400 })
      const ok = invokeStream('startTask', taskId)
      return NextResponse.json({ success: ok, message: ok ? 'Unduhan dimulai' : 'Gagal memulai unduhan' })
    }

    if (action === 'start_package') {
      const packageName = body.packageName
      if (!packageName) return NextResponse.json({ error: 'Nama paket wajib diisi' }, { status: 400 })
      const ok = invokeStream('startPackage', packageName)
      return NextResponse.json({
        success: ok,
        message: ok ? `Paket "${packageName}" masuk ke antrean unduh!` : 'Gagal memulai paket unduhan'
      })
    }

    if (action === 'start_all_staged') {
      const ok = invokeStream('startAllStaged')
      return NextResponse.json({
        success: ok,
        message: ok ? 'Seluruh paket yang ditampung mulai diunduh!' : 'Tidak ada paket yang ditampung'
      })
    }

    if (action === 'remove_staged') {
      if (taskId) {
        const ok = invokeStream('removeStaged', taskId)
        return NextResponse.json({ success: ok, message: ok ? 'Unduhan dihapus dari penampungan' : 'Gagal menghapus unduhan' })
      }
      if (body.packageName) {
        const ok = invokeStream('removePackage', body.packageName)
        return NextResponse.json({ success: ok, message: ok ? `Paket "${body.packageName}" dihapus dari penampungan` : 'Gagal menghapus paket' })
      }
      return NextResponse.json({ error: 'Task ID atau Nama Paket wajib diisi' }, { status: 400 })
    }

    if (action === 'add_url') {
      if (!url) return NextResponse.json({ error: 'URL unduhan wajib diisi' }, { status: 400 })
      const autoStart = !!body.autoStart
      const startFn = typeof streamDownloader.startDownload === 'function'
        ? streamDownloader.startDownload.bind(streamDownloader)
        : StreamDownloader.prototype.startDownload.bind(streamDownloader)
      const task = await startFn({
        url,
        filename,
        referrer,
        cookies,
        userAgent: request.headers.get('user-agent') || '',
        autoStart
      })
      const msg = autoStart
        ? `Unduhan "${task.filename}" berhasil dimulai!`
        : `Tautan "${task.filename}" berhasil ditampung di antrean (Siap Mulai).`
      return NextResponse.json({ success: true, message: msg, task })
    }

    if (action === 'launch_jd') {
      launchJDownloader()
      return NextResponse.json({ success: true, message: 'JDownloader berhasil diluncurkan' })
    }

    if (action === 'open_folder') {
      const p = targetPath || 'D:\\Game\\Shopee\\GameDownload'
      if (process.platform === 'win32') {
        exec(`explorer.exe "${p}"`)
      }
      return NextResponse.json({ success: true, message: 'Folder dibuka di Windows Explorer' })
    }

    if (action === 'delete_file' || action === 'delete_raw') {
      let filePath = targetPath || body.filePath || body.folderPath
      if (!filePath && body.folderName) {
        const { getDownloadConfig } = await import('@/lib/downloadWatcher')
        const config = getDownloadConfig()
        const downloadDir = config.downloadDir || 'D:\\Game\\Shopee\\GameDownload'
        filePath = path.join(downloadDir, body.folderName)
      }
      if (filePath && fs.existsSync(filePath)) {
        const stats = await fs.promises.stat(filePath)
        if (stats.isDirectory()) {
          await fs.promises.rm(filePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
        } else {
          await fs.promises.unlink(filePath)
        }
        return NextResponse.json({ success: true, message: 'Berkas atau folder berhasil dihapus' })
      }
      return NextResponse.json({ error: 'Berkas tidak ditemukan' }, { status: 404 })
    }

    if (action === 'extract_now') {
      let p = targetPath || body.folderPath
      if (!p && body.folderName) {
        const { getDownloadConfig } = await import('@/lib/downloadWatcher')
        const config = getDownloadConfig()
        const downloadDir = config.downloadDir || 'D:\\Game\\Shopee\\GameDownload'
        p = path.join(downloadDir, body.folderName)
      }
      if (!p || !fs.existsSync(p)) {
        return NextResponse.json({ error: 'Folder arsip game tidak ditemukan' }, { status: 404 })
      }
      const { extractMultiPartArchive } = await import('@/lib/extractor')
      // Jalankan ekstraksi di background tanpa blocking
      extractMultiPartArchive({
        folderPath: p,
        packageName: body.packageName || path.basename(p),
        password: body.password !== undefined ? String(body.password).trim() : 'mygameon',
        autoCleanRar: !!body.autoCleanRar
      }).catch((err) => {
        console.error('[Control Action] Gagal ekstraksi manual:', err.message)
      })

      return NextResponse.json({
        success: true,
        message: `Proses ekstraksi UnRAR untuk "${path.basename(p)}" dimulai di background.`
      })
    }

    if (action === 'dismiss_extraction') {
      const { dismissExtraction } = await import('@/lib/extractor')
      dismissExtraction(body.taskId)
      return NextResponse.json({ success: true, message: 'Notifikasi ekstraksi ditutup' })
    }

    if (action === 'stop_jd') {
      const { killJDownloaderProcess, startCNLServer } = await import('@/lib/cnlServer')
      await killJDownloaderProcess()
      const cnlState = startCNLServer()
      return NextResponse.json({
        success: true,
        message: 'JDownloader 2 ditutup. Port 9666 kini dikendalikan oleh MyGameON.',
        cnlState
      })
    }

    if (action === 'start_cnl') {
      const { startCNLServer } = await import('@/lib/cnlServer')
      const cnlState = startCNLServer()
      return NextResponse.json({
        success: true,
        message: cnlState.running
          ? 'Click\'n\'Load Server MyGameON aktif di port 9666'
          : `Gagal mengikat port 9666: ${cnlState.error}`,
        cnlState
      })
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
