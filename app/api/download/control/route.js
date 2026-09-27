import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { launchJDownloader } from '@/lib/downloadWatcher'
import { exec } from 'child_process'

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, targetPath } = body

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

    return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
