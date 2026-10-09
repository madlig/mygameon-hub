import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import Order from '@/models/Order'
import { getGoogleClients } from '@/lib/googleClient'
import { sendDeliveryEmail } from '@/lib/mailer'
import AccessLog from '@/models/AccessLog'

export async function POST(request) {
  try {
    const { invoice, email, resendAllRecent } = await request.json()

    if (!invoice && !email && !resendAllRecent) {
      return NextResponse.json({ error: 'Invoice, email, atau flag resendAllRecent wajib diisi' }, { status: 400 })
    }

    await connectToDatabase()

    let gmailClient = null
    try {
      const clients = await getGoogleClients()
      gmailClient = clients?.gmail || null
    } catch (_) {}

    // KASUS 1: Kirim ulang semua pesanan dalam 24 jam terakhir
    if (resendAllRecent) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentOrders = await Order.find({
        orderDate: { $gte: oneDayAgo },
        email: { $exists: true, $ne: '' }
      }).sort({ orderDate: 1 }).lean()

      const results = []
      for (const ord of recentOrders) {
        try {
          const pcGames = []
          const sims4Items = []
          for (const item of (ord.cartItems || [])) {
            if (item.isSims4) {
              sims4Items.push({
                name: item.name,
                realId: item.targetId,
                allowCC: item.allowCC,
                invoice: ord.invoice
              })
            } else {
              const log = await AccessLog.findOne({ email: ord.email, folderId: item.targetId }).sort({ grantedAt: -1 }).lean()
              pcGames.push({
                name: item.name,
                realId: item.targetId,
                expirationTime: log?.expiresAt || null
              })
            }
          }

          await sendDeliveryEmail({
            toEmail: ord.email,
            invoice: ord.invoice,
            pcGames,
            sims4Items,
            gmailClient
          })
          results.push({ invoice: ord.invoice, email: ord.email, status: 'success' })
        } catch (oErr) {
          results.push({ invoice: ord.invoice, email: ord.email, status: 'error', error: oErr.message })
        }
      }

      const successCount = results.filter(r => r.status === 'success').length
      return NextResponse.json({
        success: true,
        message: `Berhasil memproses pengiriman ulang: ${successCount} dari ${results.length} email terkirim.`,
        results,
        successCount,
        totalCount: results.length
      })
    }

    // KASUS 2: Kirim ulang satu pesanan spesifik
    const query = {}
    if (invoice) query.invoice = invoice.trim()
    if (email) query.email = email.trim().toLowerCase()

    const order = await Order.findOne(query).sort({ orderDate: -1 })
    if (!order) {
      return NextResponse.json({ error: 'Data pesanan tidak ditemukan di database' }, { status: 404 })
    }

    const targetEmail = order.email
    if (!targetEmail) {
      return NextResponse.json({ error: 'Pesanan ini tidak memiliki alamat email pembeli' }, { status: 400 })
    }

    // 3. Format items
    const cartItems = order.cartItems || []
    const pcGames = []
    const sims4Items = []

    for (const item of cartItems) {
      if (item.isSims4) {
        sims4Items.push({
          name: item.name,
          realId: item.targetId,
          allowCC: item.allowCC,
          invoice: order.invoice
        })
      } else {
        // Cek access log untuk dapat expirationTime jika ada
        const log = await AccessLog.findOne({ email: targetEmail, folderId: item.targetId }).sort({ grantedAt: -1 }).lean()
        pcGames.push({
          name: item.name,
          realId: item.targetId,
          expirationTime: log?.expiresAt || null
        })
      }
    }

    // 4. Kirim ulang email via mailer (mendukung App Password & OAuth)
    await sendDeliveryEmail({
      toEmail: targetEmail,
      invoice: order.invoice,
      pcGames,
      sims4Items,
      gmailClient
    })

    return NextResponse.json({
      success: true,
      message: `Email konfirmasi pesanan #${order.invoice} berhasil dikirim ulang ke ${targetEmail}`,
      invoice: order.invoice,
      email: targetEmail,
      itemCount: cartItems.length
    })

  } catch (err) {
    console.error('[resend email route] Error:', err)
    return NextResponse.json({
      error: err.message || 'Gagal mengirim ulang email'
    }, { status: 500 })
  }
}
