import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import UploadHistory from '@/models/UploadHistory'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectToDatabase()
    
    // Ambil 15 riwayat upload terbaru dari UploadHistory
    const history = await UploadHistory.find({})
      .sort({ uploadedAt: -1 })
      .limit(15)
      .lean()

    return NextResponse.json({ history })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
