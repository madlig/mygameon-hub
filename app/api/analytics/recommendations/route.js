import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import Order from '@/models/Order'
import UserPreferences from '@/models/UserPreferences'
import GameCatalog from '@/models/GameCatalog'

export async function GET() {
  try {
    await connectToDatabase()

    const orders = await Order.find({}).lean()
    const prefs = await UserPreferences.findOne({}).lean()
    const currentFavs = new Set((prefs?.favGames || []).map(g => g.name))

    const pairCounts = {}
    const singleCounts = {}

    for (const order of orders) {
      if (!order.cartItems || order.cartItems.length === 0) continue
      
      const games = order.cartItems.filter(i => !i.isBonus).map(i => i.name)
      
      // Count singles
      for (const game of games) {
          singleCounts[game] = (singleCounts[game] || 0) + 1
      }

      // Count pairs
      for (let i = 0; i < games.length; i++) {
          for (let j = i + 1; j < games.length; j++) {
              const pair = [games[i], games[j]].sort().join(' + ')
              pairCounts[pair] = (pairCounts[pair] || 0) + 1
          }
      }
    }

    // Top Bundles
    const topPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pairName, count]) => ({
          name: pairName,
          count
      }))

    // Smart Favorites
    const smartFavorites = Object.entries(singleCounts)
      .filter(([name]) => !currentFavs.has(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
          name,
          count
      }))

    // We also need to get the real catalog IDs for these smart favorites and bundles
    // so the UI can easily add them.
    for (const fav of smartFavorites) {
        const catalogEntry = await GameCatalog.findOne({ name: fav.name }).lean()
        if (catalogEntry) {
            fav.targetId = catalogEntry.folderId
            fav.ownerEmail = catalogEntry.ownerEmail
        }
    }

    return NextResponse.json({
        success: true,
        smartBundles: topPairs,
        smartFavorites
    })
  } catch (err) {
    console.error('Recommendations API Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
