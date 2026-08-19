import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import Order from '@/models/Order'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'Tanggal mulai dan selesai wajib diisi' }, { status: 400 })
    }

    await connectToDatabase()

    const startDate = new Date(startDateParam)
    const endDate = new Date(endDateParam)
    endDate.setHours(23, 59, 59, 999) // Set ke akhir hari

    // Ambil semua order dalam rentang waktu
    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endDate }
    }).lean()

    const totalOrders = orders.length
    let paidCount = 0
    let bonusCount = 0

    // Hitung Game Terlaris
    const gameMap = {}
    
    // Hitung Pelanggan Paling Aktif (Sultan)
    const customerMap = {}

    for (const order of orders) {
      const email = order.email.toLowerCase()
      customerMap[email] = (customerMap[email] || 0) + 1
      
      for (const item of order.cartItems || []) {
          if (item.isBonus) {
              bonusCount++
          } else {
              paidCount++
              gameMap[item.name] = (gameMap[item.name] || 0) + 1
          }
      }
    }

    const topGames = Object.entries(gameMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const topCustomers = Object.entries(customerMap)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      summary: {
        totalOrders,
        paidCount,
        bonusCount,
        bonusRatio: totalOrders === 0 ? 0 : Math.round((bonusCount / (paidCount + bonusCount || 1)) * 100)
      },
      topGames,
      topCustomers
    })

  } catch (err) {
    console.error('Analytics error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
