import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { executeHandoff } from '@/lib/downloadWatcher'

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { folderName, mode, cleanReplace, targetGameId, workspace } = body

    if (!folderName) {
      return NextResponse.json({ error: 'Nama folder game wajib diisi' }, { status: 400 })
    }

    const result = await executeHandoff(folderName, {
      mode: mode || 'new',
      cleanReplace: cleanReplace !== undefined ? cleanReplace : true,
      targetGameId: targetGameId || '',
      workspace: workspace || null
    })

    return NextResponse.json({ success: true, ...result, result })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
