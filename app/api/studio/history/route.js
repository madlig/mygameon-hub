import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectToDatabase()
    
    // Ambil 15 riwayat upload terbaru yang lastSyncedAt nya tidak null
    const history = await GameCatalog.find({ lastSyncedAt: { $exists: true, $ne: null } })
      .sort({ lastSyncedAt: -1 })
      .limit(15)
      .lean()

    return NextResponse.json({ history })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
