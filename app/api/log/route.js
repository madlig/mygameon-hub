import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import { parseSheetDate } from '@/lib/utils'
import connectToDatabase from '@/lib/db'
import Sims4License from '@/models/Sims4License'
import Order from '@/models/Order'
import AccessLog from '@/models/AccessLog'

const LIMIT = 20

function jktDate(t) {
  const d = new Date(t)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'orders' // 'orders' | 'games'
    const filter = searchParams.get('filter') || 'all'
    const query = (searchParams.get('q') || '').toLowerCase().trim()
    const all = searchParams.get('all') === '1'
    const page = parseInt(searchParams.get('page') || '1')

    await connectToDatabase()

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const weekAgo = Date.now() - 7 * 86400000

    // ── MODE 1: PESANAN / ORDERS (DEFAULT LOG TRANSAKSI) ──
    if (mode === 'orders') {
      const rawOrders = await Order.find().sort({ orderDate: -1 }).lean()

      // Pengelompokan: 1 keranjang ke 1 email dengan nomor pesanan yang sama dihitung menjadi 1 pesanan
      const groupedMap = new Map()
      const orderRows = []

      for (const ord of rawOrders) {
        const inv = (ord.invoice || '').trim()
        const em = (ord.email || '').trim().toLowerCase()
        const key = inv ? `${inv.toLowerCase()}__${em}` : ord._id.toString()

        if (groupedMap.has(key)) {
          const existing = groupedMap.get(key)
          const existingNames = new Set(existing.cartItems.map(i => (i.name || '').toLowerCase()))
          for (const item of (ord.cartItems || [])) {
            const itemKey = (item.name || '').toLowerCase()
            if (!existingNames.has(itemKey)) {
              existing.cartItems.push({
                name: item.name || '',
                isBonus: !!item.isBonus,
                isSims4: !!item.isSims4,
                allowCC: !!item.allowCC,
                ownerEmail: item.ownerEmail || '',
              })
              existingNames.add(itemKey)
            }
          }
          existing.bonusEligible = Math.max(existing.bonusEligible, ord.bonusEligible || 0)
          existing.bonusClaimed = Math.max(existing.bonusClaimed, ord.bonusClaimed || 0)
          existing.itemCount = existing.cartItems.length
        } else {
          const entry = {
            id: ord._id.toString(),
            type: 'order',
            invoice: inv,
            displayInvoice: inv ? `#${inv}` : 'Pesanan Langsung',
            email: ord.email || '',
            time: ord.orderDate ? new Date(ord.orderDate).toISOString() : new Date().toISOString(),
            cartItems: (ord.cartItems || []).map(i => ({
              name: i.name || '',
              isBonus: !!i.isBonus,
              isSims4: !!i.isSims4,
              allowCC: !!i.allowCC,
              ownerEmail: i.ownerEmail || '',
            })),
            itemCount: (ord.cartItems || []).length,
            bonusEligible: ord.bonusEligible || 0,
            bonusClaimed: ord.bonusClaimed || 0,
            status: 'Terkirim',
          }
          groupedMap.set(key, entry)
          orderRows.push(entry)
        }
      }

      // Urutkan terbaru dulu
      let combined = orderRows.sort((a, b) => {
        return (new Date(b.time).getTime() || 0) - (new Date(a.time).getTime() || 0)
      })

      // Stats global pesanan (sebelum filter)
      const stats = {
        total: combined.length,
        today: combined.filter(r => jktDate(r.time) === todayStr).length,
        week: combined.filter(r => (new Date(r.time).getTime() || 0) >= weekAgo).length,
        totalGames: combined.reduce((acc, r) => acc + r.itemCount, 0),
        bonusOrders: combined.filter(r => r.bonusEligible > 0 || r.cartItems.some(i => i.isBonus)).length,
      }

      // Filter
      if (filter === 'today') combined = combined.filter(r => jktDate(r.time) === todayStr)
      if (filter === 'week') combined = combined.filter(r => (new Date(r.time).getTime() || 0) >= weekAgo)
      if (filter === 'month') {
        const monthStr = todayStr.slice(0, 7)
        combined = combined.filter(r => { const j = jktDate(r.time); return j && j.slice(0, 7) === monthStr })
      }
      if (filter === 'bonus') {
        combined = combined.filter(r => r.bonusEligible > 0 || r.cartItems.some(i => i.isBonus))
      }
      if (filter === 'sims4') {
        combined = combined.filter(r => r.cartItems.some(i => i.isSims4 || (i.name && i.name.toLowerCase().includes('sims 4'))))
      }

      // Pencarian multi-field (invoice, email, atau judul game di keranjang)
      if (query) {
        combined = combined.filter(r =>
          (r.invoice || '').toLowerCase().includes(query) ||
          (r.email || '').toLowerCase().includes(query) ||
          r.cartItems.some(i => (i.name || '').toLowerCase().includes(query))
        )
      }

      const total = combined.length

      if (all) {
        return NextResponse.json({ logs: combined, total, stats, mode: 'orders' })
      }

      const start = (page - 1) * LIMIT
      const paginated = combined.slice(start, start + LIMIT)
      return NextResponse.json({ logs: paginated, total, page, limit: LIMIT, stats, mode: 'orders' })
    }

    // ── MODE 2: LOG GAME SATUAN (LEGACY AUDIT / GRANULAR ITEMS) ──
    let generalRows = []
    let sims4Docs = []

    try {
      const { sheets } = await getGoogleClients()
      const [generalRes, sims4Data] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_ID, range: 'Sheet1!A:D', valueRenderOption: 'UNFORMATTED_VALUE' }).catch(() => ({ data: { values: [] } })),
        Sims4License.find().lean()
      ])

      generalRows = (generalRes.data.values || [])
        .filter(row => row[0] && row[0] !== 'Date')
        .map(row => ({
          type: 'general',
          time: parseSheetDate(row[0]),
          email: row[1] || '',
          product: row[2] || '',
          source: row[3] || '',
          status: 'Terkirim',
        }))

      sims4Docs = sims4Data
    } catch {
      // Fallback ke MongoDB AccessLog jika Google Sheets gagal
      const accessLogs = await AccessLog.find().sort({ grantedAt: -1 }).limit(1000).lean()
      generalRows = accessLogs.map(a => ({
        type: 'general',
        time: new Date(a.grantedAt).toISOString(),
        email: a.email || '',
        product: a.gameName || '',
        source: a.ownerEmail || '',
        status: a.status === 'revoked' ? 'Dicabut' : 'Terkirim',
      }))
      sims4Docs = await Sims4License.find().lean()
    }

    const sims4Rows = sims4Docs.map(doc => ({
      type: 'sims4',
      time: new Date(doc.createdAt).toISOString(),
      email: doc.email || '',
      product: `Sims 4 · ${doc.cc === 'Y' ? 'Premium CC' : 'Standard'}`,
      source: doc.invoice || '',
      status: doc.status || 'Active',
    }))

    // Gabung & urut terbaru dulu
    let combinedGames = [...generalRows, ...sims4Rows].sort((a, b) => {
      return (new Date(b.time).getTime() || 0) - (new Date(a.time).getTime() || 0)
    })

    // Stats global game items
    const gameStats = {
      total: combinedGames.length,
      today: combinedGames.filter(r => jktDate(r.time) === todayStr).length,
      week: combinedGames.filter(r => (new Date(r.time).getTime() || 0) >= weekAgo).length,
      sims4: combinedGames.filter(r => r.type === 'sims4').length,
      general: combinedGames.filter(r => r.type === 'general').length,
    }

    // Filter tipe / waktu
    if (filter === 'general') combinedGames = combinedGames.filter(r => r.type === 'general')
    if (filter === 'sims4') combinedGames = combinedGames.filter(r => r.type === 'sims4')
    if (filter === 'today') combinedGames = combinedGames.filter(r => jktDate(r.time) === todayStr)
    if (filter === 'week') combinedGames = combinedGames.filter(r => (new Date(r.time).getTime() || 0) >= weekAgo)
    if (filter === 'month') {
      const monthStr = todayStr.slice(0, 7)
      combinedGames = combinedGames.filter(r => { const j = jktDate(r.time); return j && j.slice(0, 7) === monthStr })
    }

    // Search
    if (query) {
      combinedGames = combinedGames.filter(r =>
        (r.email || '').toLowerCase().includes(query) ||
        (r.product || '').toLowerCase().includes(query) ||
        String(r.source || '').toLowerCase().includes(query)
      )
    }

    const totalGamesCount = combinedGames.length

    if (all) {
      return NextResponse.json({ logs: combinedGames, total: totalGamesCount, stats: gameStats, mode: 'games' })
    }

    const startGames = (page - 1) * LIMIT
    const paginatedGames = combinedGames.slice(startGames, startGames + LIMIT)
    return NextResponse.json({ logs: paginatedGames, total: totalGamesCount, page, limit: LIMIT, stats: gameStats, mode: 'games' })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
