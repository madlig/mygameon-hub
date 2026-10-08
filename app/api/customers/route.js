import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import Customer from '@/models/Customer'
import AccessLog from '@/models/AccessLog'
import Sims4License from '@/models/Sims4License'
import GameCatalog from '@/models/GameCatalog'
import Order from '@/models/Order'
import { getGoogleClients, getClientForEmail } from '@/lib/googleClient'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = (searchParams.get('email') || searchParams.get('q'))?.trim()
    const all = searchParams.get('all')

    await connectToDatabase()

    if (all) {
      const [customers, orders, recentLogs] = await Promise.all([
        Customer.find().lean(),
        Order.find().lean(),
        AccessLog.find().sort({ grantedAt: -1 }).limit(100).lean()
      ])
      
      const bonusMap = {}
      const orderCountMap = {}
      const lastActivityMap = {}

      for (const order of orders) {
        const em = (order.email || '').toLowerCase()
        if (!em) continue
        orderCountMap[em] = (orderCountMap[em] || 0) + 1
        if (!bonusMap[em]) bonusMap[em] = { eligible: 0, claimed: 0 }
        bonusMap[em].eligible += (order.bonusEligible || 0)
        bonusMap[em].claimed += (order.bonusClaimed || 0)

        const orderTime = order.orderDate ? new Date(order.orderDate).getTime() : 0
        if (!lastActivityMap[em] || orderTime > lastActivityMap[em].time) {
          lastActivityMap[em] = {
            time: orderTime,
            date: order.orderDate,
            invoice: order.invoice || '',
            games: order.cartItems?.map(i => i.name).filter(Boolean) || []
          }
        }
      }

      for (const log of recentLogs) {
        const em = (log.email || '').toLowerCase()
        if (!em) continue
        const logTime = log.grantedAt ? new Date(log.grantedAt).getTime() : 0
        if (!lastActivityMap[em] || logTime > lastActivityMap[em].time) {
          lastActivityMap[em] = {
            time: logTime,
            date: log.grantedAt,
            invoice: '',
            games: log.gameName ? [log.gameName] : []
          }
        }
      }
      
      const enriched = customers.map(c => {
        const em = (c.email || '').toLowerCase()
        const b = bonusMap[em] || { eligible: 0, claimed: 0 }
        const act = lastActivityMap[em]
        return {
          ...c,
          orderCount: orderCountMap[em] || c.orderCount || 0,
          bonusPending: b.eligible - b.claimed,
          lastOrderDate: act?.date || c.updatedAt || c.createdAt,
          lastInvoice: act?.invoice || '',
          lastGames: act?.games || []
        }
      })
      
      const customerEmails = new Set(customers.map(c => (c.email || '').toLowerCase()))
      for (const em of Object.keys(bonusMap)) {
        if (!customerEmails.has(em)) {
          const b = bonusMap[em]
          const act = lastActivityMap[em]
          enriched.push({
            email: em,
            orderCount: orderCountMap[em],
            bonusPending: b.eligible - b.claimed,
            status: 'active',
            lastOrderDate: act?.date || new Date(),
            lastInvoice: act?.invoice || '',
            lastGames: act?.games || [],
            createdAt: act?.date || new Date()
          })
        }
      }

      for (const em of Object.keys(lastActivityMap)) {
        if (!customerEmails.has(em) && !bonusMap[em]) {
          const act = lastActivityMap[em]
          enriched.push({
            email: em,
            orderCount: orderCountMap[em] || 1,
            bonusPending: 0,
            status: 'active',
            lastOrderDate: act?.date || new Date(),
            lastInvoice: act?.invoice || '',
            lastGames: act?.games || [],
            createdAt: act?.date || new Date()
          })
        }
      }

      return NextResponse.json({ customers: enriched })
    }

    if (!rawQuery) {
      return NextResponse.json({ error: 'Email atau Nomor Pesanan Shopee wajib diisi' }, { status: 400 })
    }

    let targetEmail = ''
    let directLic = null

    if (rawQuery.includes('@')) {
      targetEmail = rawQuery.toLowerCase()
    } else {
      // Cari sebagai Nomor Invoice Shopee
      directLic = await Sims4License.findOne({ invoice: new RegExp(`^${rawQuery}$`, 'i') }).lean()
      if (directLic && directLic.email) {
        targetEmail = directLic.email.toLowerCase()
      } else {
        const ord = await Order.findOne({ invoice: new RegExp(`^${rawQuery}$`, 'i') }).lean()
        if (ord && ord.email) {
          targetEmail = ord.email.toLowerCase()
        }
      }
    }

    // Jika pencarian via invoice tapi lisensi tidak memiliki email (lisensi mandiri)
    if (!targetEmail && directLic) {
      const phantomCustomer = {
        email: directLic.invoice,
        orderCount: 1,
        status: directLic.status || 'active',
        notes: directLic.notes || '',
        createdAt: directLic.createdAt || new Date(),
        bonusPending: 0,
        isLicenseOnly: true
      }
      return NextResponse.json({
        customer: phantomCustomer,
        accessLogs: [],
        sims4Licenses: [directLic],
        orders: []
      })
    }

    if (!targetEmail) {
      return NextResponse.json({ error: `Data tidak ditemukan untuk "${rawQuery}". Periksa kembali email atau nomor pesanan.` }, { status: 404 })
    }

    const email = targetEmail

    // 1. Fetch Customer Profile
    let customer = await Customer.findOne({ email }).lean()
    
    // 2. Fetch Access Logs
    const accessLogs = await AccessLog.find({ email }).sort({ grantedAt: -1 }).lean()
    
    // 3. Fetch Sims 4 Licenses
    const sims4Licenses = await Sims4License.find({ email }).lean()

    // 4. Fetch Orders for bonus calculation
    const orders = await Order.find({ email }).sort({ orderDate: -1 }).lean()
    let bonusEligible = 0
    let bonusClaimed = 0
    let orderCount = 0
    for (const o of orders) {
        orderCount++
        bonusEligible += (o.bonusEligible || 0)
        bonusClaimed += (o.bonusClaimed || 0)
    }

    // If customer doesn't exist but has access logs or sims licenses, create a phantom profile in memory
    if (!customer && (accessLogs.length > 0 || sims4Licenses.length > 0 || orders.length > 0)) {
      customer = { email, orderCount, status: 'active', notes: '', createdAt: new Date() }
    }
    
    if (customer) {
        customer.bonusPending = bonusEligible - bonusClaimed
        if (orderCount > (customer.orderCount || 0)) customer.orderCount = orderCount
    }

    return NextResponse.json({ customer, accessLogs, sims4Licenses, orders })

  } catch (err) {
    console.error('GET Customer error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const { email, status, notes } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    await connectToDatabase()

    const updateData = {}
    if (status) updateData.status = status
    if (typeof notes !== 'undefined') updateData.notes = notes

    const customer = await Customer.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: updateData },
      { new: true, upsert: true }
    )

    return NextResponse.json({ customer })

  } catch (err) {
    console.error('PATCH Customer error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { items } = await request.json()
    // items = [{ _id: 'AccessLogId', fileId: '...', permissionId: '...', ownerEmail: '...' }]
    
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Tidak ada akses yang dipilih' }, { status: 400 })
    }

    await connectToDatabase()
    const { sheets } = await getGoogleClients()

    const results = []
    for (const item of items) {
      const targetId = item.fileId || item.folderId
      if (!targetId || !item.permissionId) {
        results.push({ id: item._id, status: 'error', message: 'Parameter tidak lengkap' })
        continue
      }
      
      try {
        let drive
        if (item.ownerEmail === 'admin' || !item.ownerEmail || item.ownerEmail === 'Unknown') {
          const clients = await getGoogleClients()
          drive = clients.drive
        } else {
          try {
            drive = await getClientForEmail(item.ownerEmail)
          } catch (e) {
            // Fallback
            const game = await GameCatalog.findOne({ folderId: targetId }).lean()
            if (game?.ownerEmail) {
              drive = await getClientForEmail(game.ownerEmail)
            } else {
              const clients = await getGoogleClients()
              drive = clients.drive
            }
          }
        }

        // Hapus dari Google Drive API
        await drive.permissions.delete({
          fileId: targetId,
          permissionId: item.permissionId,
          supportsAllDrives: true,
        })
        
        // Update di MongoDB AccessLog
        if (item._id) {
          await AccessLog.findByIdAndUpdate(item._id, { status: 'revoked' })
        }

        results.push({ id: item._id, fileId: targetId, fileName: item.gameName || item.fileName, status: 'success' })

      } catch (e) {
        // Jika 404 File Not Found atau Permission Not Found, angkat tangan dan anggap sukses (karena memang sudah tidak ada)
        if (e.code === 404 || (e.message && e.message.toLowerCase().includes('not found'))) {
          if (item._id) {
            await AccessLog.findByIdAndUpdate(item._id, { status: 'revoked' })
          }
          results.push({ id: item._id, fileId: targetId, fileName: item.gameName || item.fileName, status: 'success', note: 'Sudah tidak ada di drive' })
        } else {
          results.push({ id: item._id, fileId: targetId, fileName: item.gameName || item.fileName, status: 'error', message: e.message })
        }
      }
    }

    return NextResponse.json({ results })

  } catch (err) {
    console.error('DELETE Access error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
