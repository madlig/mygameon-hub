import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import AccessLog from '@/models/AccessLog'
import Sims4License from '@/models/Sims4License'
import { auth } from '@/app/api/auth/[...nextauth]/route'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    // 1. Bersihkan Data General Game (AccessLog)
    const logs = await AccessLog.find({ ownerEmail: 'Unknown' }).lean()
    const logOps = []
    let fixedWithExpired = 0
    let fixedWithoutExpired = 0

    for (const log of logs) {
      let newGrantedAt
      
      if (log.expiresAt) {
        // Trik minus 1 tahun dari expired!
        const expDate = new Date(log.expiresAt)
        newGrantedAt = new Date(expDate.setFullYear(expDate.getFullYear() - 1))
        fixedWithExpired++
      } else {
        // Jika permanen, set ke 1 Jan 2026
        newGrantedAt = new Date('2026-01-01T00:00:00Z')
        fixedWithoutExpired++
      }

      logOps.push({
        updateOne: {
          filter: { _id: log._id },
          update: { $set: { grantedAt: newGrantedAt } }
        }
      })
    }

    if (logOps.length > 0) {
      await AccessLog.bulkWrite(logOps)
    }

    // 2. Bersihkan Data The Sims 4 (Sims4License)
    // Semua sims 4 license yang terbuat 'hari ini' (migrasi tanpa tanggal valid) dipindah ke 1 Jan 2026
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const simsResult = await Sims4License.updateMany(
      { createdAt: { $gte: startOfToday } },
      { $set: { createdAt: new Date('2026-01-01T00:00:00Z') } }
    )

    return NextResponse.json({
      success: true,
      message: 'Seluruh Data Historis Berhasil Dibersihkan!',
      details: {
        accessLogFixed: logOps.length,
        accessLog1YearRule: fixedWithExpired,
        accessLogPermanentDefault: fixedWithoutExpired,
        sims4FixedTo2026: simsResult.modifiedCount
      }
    })

  } catch (err) {
    console.error('Cleansing error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
