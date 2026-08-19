import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import BonusSchema from '@/models/BonusSchema'

export async function GET() {
  try {
    await connectToDatabase()
    
    // Asumsikan hanya ada 1 record konfigurasi
    let config = await BonusSchema.findOne().lean()
    
    if (!config) {
      config = await BonusSchema.create({
        rules: [
          { buyMin: 3, getBonus: 1 },
          { buyMin: 4, getBonus: 2 },
          { buyMin: 5, getBonus: 2 },
          { buyMin: 6, getBonus: 3 }, // Mengakomodasi >5
        ],
        isActive: true
      })
    }

    return NextResponse.json({ success: true, config })
  } catch (err) {
    console.error('Bonus Settings GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { rules, isActive } = await req.json()
    await connectToDatabase()

    let config = await BonusSchema.findOne()
    if (!config) {
      config = new BonusSchema()
    }

    if (rules) config.rules = rules
    if (typeof isActive === 'boolean') config.isActive = isActive

    await config.save()

    return NextResponse.json({ success: true, config })
  } catch (err) {
    console.error('Bonus Settings POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
