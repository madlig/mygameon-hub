import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import Order from '@/models/Order'
import Sims4License from '@/models/Sims4License'
import GameCatalog from '@/models/GameCatalog'
import { getGoogleClients, getClientForEmail } from '@/lib/googleClient'
import { sendDeliveryEmail } from '@/lib/mailer'
import AccessLog from '@/models/AccessLog'

async function ensureDriveAccess(targetEmail, itemName, folderId, isSims4 = false) {
  const cleanFolderId = folderId || (isSims4 ? process.env.SIMS4_FOLDER_ID : '')
  if (!targetEmail || !cleanFolderId) return cleanFolderId

  try {
    const existingLog = await AccessLog.findOne({
      email: targetEmail,
      folderId: cleanFolderId,
      status: 'active'
    }).lean()
    if (existingLog) return cleanFolderId

    const catalogEntries = await GameCatalog.find(
      isSims4
        ? { $or: [{ folderId: cleanFolderId }, { name: { $regex: 'sims 4', $options: 'i' } }] }
        : { $or: [{ folderId: cleanFolderId }, { name: itemName }] }
    ).sort({ sendCount: 1 }).lean()

    for (const entry of catalogEntries) {
      if (!entry.ownerEmail || !entry.folderId) continue
      try {
        const drive = await getClientForEmail(entry.ownerEmail)
        const permRes = await drive.permissions.create({
          fileId: entry.folderId,
          supportsAllDrives: true,
          sendNotificationEmail: false,
          requestBody: { role: 'reader', type: 'user', emailAddress: targetEmail },
        })
        await AccessLog.create({
          email: targetEmail,
          gameName: itemName || entry.name || 'The Sims 4',
          folderId: entry.folderId,
          permissionId: permRes.data?.id || '',
          ownerEmail: entry.ownerEmail,
          isBonus: false,
          expiresAt: null
        })
        return entry.folderId
      } catch (_) {}
    }
  } catch (_) {}

  return cleanFolderId
}

export async function POST(request) {
  try {
    const { orderId, invoice, email, resendAllRecent } = await request.json()

    if (!orderId && !invoice && !email && !resendAllRecent) {
      return NextResponse.json({ error: 'Order ID, invoice, email, atau flag resendAllRecent wajib diisi' }, { status: 400 })
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
              const resolvedId = await ensureDriveAccess(ord.email, item.name, item.targetId, true)
              sims4Items.push({
                name: item.name || 'The Sims 4',
                realId: resolvedId,
                allowCC: item.allowCC,
                invoice: ord.invoice
              })
            } else {
              const resolvedId = await ensureDriveAccess(ord.email, item.name, item.targetId, false)
              const log = await AccessLog.findOne({ email: ord.email, folderId: resolvedId }).sort({ grantedAt: -1 }).lean()
              pcGames.push({
                name: item.name,
                realId: resolvedId,
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
    const cleanInvoice = invoice ? invoice.trim() : ''
    const cleanEmail = email ? email.trim().toLowerCase() : ''

    let order = null
    if (orderId) {
      try {
        order = await Order.findById(orderId).lean()
      } catch (_) {}
    }
    if (!order && cleanInvoice && cleanEmail) {
      order = await Order.findOne({ invoice: cleanInvoice, email: cleanEmail }).sort({ orderDate: -1 }).lean()
    }
    if (!order && cleanInvoice) {
      order = await Order.findOne({ invoice: cleanInvoice }).sort({ orderDate: -1 }).lean()
    }
    if (!order && cleanEmail) {
      order = await Order.findOne({ email: cleanEmail }).sort({ orderDate: -1 }).lean()
    }

    // Fallback: Jika tidak ada di koleksi Order, cek Sims4License atau AccessLog aktif pelanggan
    if (!order) {
      let lic = null
      if (cleanInvoice) {
        lic = await Sims4License.findOne({ invoice: cleanInvoice }).lean()
      }
      if (!lic && cleanEmail) {
        lic = await Sims4License.findOne({ email: cleanEmail }).sort({ createdAt: -1 }).lean()
      }

      if (lic) {
        const targetEmail = cleanEmail || (lic.email || '').trim().toLowerCase()
        if (!targetEmail) {
          return NextResponse.json({ error: 'Lisensi ini tidak memiliki alamat email pembeli' }, { status: 400 })
        }
        const resolvedId = await ensureDriveAccess(targetEmail, 'The Sims 4', process.env.SIMS4_FOLDER_ID, true)
        await sendDeliveryEmail({
          toEmail: targetEmail,
          invoice: lic.invoice,
          pcGames: [],
          sims4Items: [{
            name: 'The Sims 4',
            realId: resolvedId,
            allowCC: lic.cc === 'Y',
            invoice: lic.invoice
          }],
          gmailClient
        })
        return NextResponse.json({
          success: true,
          message: `Email konfirmasi lisensi #${lic.invoice} berhasil dikirim ulang ke ${targetEmail}`,
          invoice: lic.invoice,
          email: targetEmail,
          itemCount: 1
        })
      }

      if (cleanEmail) {
        const activeLogs = await AccessLog.find({ email: cleanEmail, status: 'active' }).sort({ grantedAt: -1 }).limit(10).lean()
        if (activeLogs.length > 0) {
          const pcGames = activeLogs.map(l => ({
            name: l.gameName,
            realId: l.folderId,
            expirationTime: l.expiresAt || null
          }))
          await sendDeliveryEmail({
            toEmail: cleanEmail,
            invoice: cleanInvoice || '',
            pcGames,
            sims4Items: [],
            gmailClient
          })
          return NextResponse.json({
            success: true,
            message: `Email akses game (${pcGames.length} game) berhasil dikirim ulang ke ${cleanEmail}`,
            invoice: cleanInvoice || '',
            email: cleanEmail,
            itemCount: pcGames.length
          })
        }
      }

      return NextResponse.json({ error: 'Data pesanan atau akses game tidak ditemukan di database' }, { status: 404 })
    }

    const targetEmail = cleanEmail || order.email
    if (!targetEmail) {
      return NextResponse.json({ error: 'Pesanan ini tidak memiliki alamat email pembeli' }, { status: 400 })
    }

    // 3. Format items & pastikan permission Google Drive sudah aktif
    const cartItems = order.cartItems || []
    const pcGames = []
    const sims4Items = []

    for (const item of cartItems) {
      if (item.isSims4) {
        const resolvedId = await ensureDriveAccess(targetEmail, item.name, item.targetId, true)
        sims4Items.push({
          name: item.name || 'The Sims 4',
          realId: resolvedId,
          allowCC: item.allowCC,
          invoice: order.invoice
        })
      } else {
        const resolvedId = await ensureDriveAccess(targetEmail, item.name, item.targetId, false)
        const log = await AccessLog.findOne({ email: targetEmail, folderId: resolvedId }).sort({ grantedAt: -1 }).lean()
        pcGames.push({
          name: item.name,
          realId: resolvedId,
          expirationTime: log?.expiresAt || null
        })
      }
    }

    // 4. Kirim ulang email via mailer (mendukung Multi-Port SMTP App Password & OAuth)
    await sendDeliveryEmail({
      toEmail: targetEmail,
      invoice: order.invoice,
      pcGames,
      sims4Items,
      gmailClient
    })

    return NextResponse.json({
      success: true,
      message: `Email konfirmasi pesanan ${order.invoice ? '#' + order.invoice : ''} berhasil dikirim ulang ke ${targetEmail}`,
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
