import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { startJob, getJobState } from '@/lib/studioProcessor'

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { folderPath, targetEmail, config } = await request.json()
    if (!folderPath || !targetEmail) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    // Cek apakah ada proses yang masih berjalan
    const state = getJobState()
    if (state.status === 'processing') {
      return NextResponse.json({ error: 'Ada proses kompresi/upload yang masih berjalan!' }, { status: 429 })
    }

    // Eksekusi di background tanpa di-await (biarkan berjalan)
    startJob(folderPath, targetEmail, config)

    return NextResponse.json({ success: true, message: 'Job started' })

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
