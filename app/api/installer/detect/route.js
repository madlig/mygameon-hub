import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { detectGameInstallSetup } from '@/lib/gameInstaller'
import { getDownloadConfig } from '@/lib/downloadWatcher'

export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderName = searchParams.get('folderName')

    if (!folderName) {
      return NextResponse.json({ error: 'Parameter folderName diperlukan' }, { status: 400 })
    }

    const config = getDownloadConfig()
    const uploadDir = config.uploadDir || 'D:\\Game\\Shopee\\GameUpload'

    const info = detectGameInstallSetup(uploadDir, folderName)
    return NextResponse.json({ success: true, data: info })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
