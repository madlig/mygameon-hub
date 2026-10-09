import { NextResponse } from 'next/server'
import { getGoogleClients, getClientForEmail } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'
import Customer from '@/models/Customer'
import AccessLog from '@/models/AccessLog'
import Order from '@/models/Order'
import Sims4License from '@/models/Sims4License'
import { isValidEmail } from '@/lib/validators'
import { sendDeliveryEmail } from '@/lib/mailer'

// Validasi otentikasi webhook via API Secret Token
function verifyWebhookAuth(request) {
  const authHeader = request.headers.get('authorization') || ''
  const apiKeyHeader = request.headers.get('x-api-key') || ''
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : apiKeyHeader.trim()
  const validSecrets = [
    process.env.ORDER_WEBHOOK_SECRET,
    process.env.CRON_SECRET,
    process.env.C2_SECRET_KEY,
    process.env.NEXTAUTH_SECRET,
  ].filter(Boolean)

  return validSecrets.includes(token)
}

export async function GET(request) {
  const isAuthorized = verifyWebhookAuth(request)
  return NextResponse.json({
    status: 'online',
    endpoint: '/api/webhook/order',
    authorized: isAuthorized,
    message: isAuthorized 
      ? 'MyGameON Webhook Ingestion API is ready to receive orders' 
      : 'Include Authorization: Bearer <ORDER_WEBHOOK_SECRET> to verify credentials'
  })
}

export async function POST(request) {
  try {
    // 1. Verifikasi Keamanan Token
    if (!verifyWebhookAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing webhook secret key' }, { status: 401 })
    }

    const payload = await request.json()
    const {
      customerEmail,
      invoice: rawInvoice,
      platform = 'n8n-automation',
      items = [],
      expirationDays,
      sendEmail = true,
      notes = ''
    } = payload

    // 2. Validasi Input Minimum
    if (!customerEmail || !isValidEmail(customerEmail)) {
      return NextResponse.json({ error: 'customerEmail valid wajib disertakan' }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items berupa array game/produk wajib disertakan' }, { status: 400 })
    }

    const email = customerEmail.toLowerCase().trim()
    const invoice = (rawInvoice || `MGO-${Date.now().toString(36).toUpperCase()}`).trim()

    await connectToDatabase()

    // 3. Cek Status Blacklist Pelanggan
    const customer = await Customer.findOne({ email })
    if (customer?.status === 'blacklisted') {
      return NextResponse.json({ error: 'Order ditolak: Email pelanggan berada dalam daftar blacklist' }, { status: 403 })
    }

    // 4. Inisialisasi Klien Google (Drive, Gmail, Sheets)
    const { drive: adminDrive, gmail, sheets } = await getGoogleClients()
    const sheetId = process.env.GSHEET_ID
    const sims4SheetId = process.env.GSHEET_SIMS4_ID
    const defaultSims4FolderId = process.env.SIMS4_FOLDER_ID

    // Hitung tanggal kadaluarsa jika ada
    let expirationTime = null
    if (expirationDays && !isNaN(Number(expirationDays)) && Number(expirationDays) > 0) {
      const d = new Date()
      d.setDate(d.getDate() + Number(expirationDays))
      expirationTime = d.toISOString()
    }

    const processedItems = []
    const sims4Licenses = []
    const errorItems = []

    // 5. Eksekusi Pemrosesan Tiap Item
    for (let i = 0; i < items.length; i++) {
      const rawItem = items[i]
      const itemName = typeof rawItem === 'string' ? rawItem.trim() : (rawItem.name || '').trim()
      const itemType = typeof rawItem === 'object' && rawItem.type ? rawItem.type.toLowerCase() : ''
      const isBonus = typeof rawItem === 'object' ? !!rawItem.isBonus : false

      if (!itemName) continue

      const isSims4 = itemType === 'sims4' || itemName.toLowerCase().includes('sims 4') || itemName.toLowerCase().includes('the sims 4')

      if (isSims4) {
        // --- PROSES PRODUK THE SIMS 4 ---
        try {
          const itemInvoice = items.length > 1 ? `${invoice}-${i + 1}` : invoice
          const allowCC = typeof rawItem === 'object' && typeof rawItem.allowCC === 'boolean'
            ? rawItem.allowCC
            : (itemName.toLowerCase().includes('premium') || itemName.toLowerCase().includes('vip') || itemName.toLowerCase().includes('cc'))
          const ccVal = allowCC ? 'Y' : 'N'
          const createdAt = new Date()

          // Simpan lisensi ke MongoDB
          await Sims4License.findOneAndUpdate(
            { invoice: itemInvoice },
            {
              invoice: itemInvoice,
              hwid: '',
              hwids: [],
              cc: ccVal,
              status: 'Active',
              email,
              createdAt
            },
            { upsert: true, new: true }
          )

          // Dual-write ke Google Sheets Sims 4
          if (sims4SheetId) {
            try {
              await sheets.spreadsheets.values.append({
                spreadsheetId: sims4SheetId,
                range: 'Licenses!A:G',
                valueInputOption: 'RAW',
                requestBody: {
                  values: [[itemInvoice, '', '', ccVal, 'Active', email, createdAt.toISOString()]],
                },
              })
            } catch (e) {
              console.error('Sims 4 Sheet log error:', e.message)
            }
          }

          // Share Google Drive folder Sims 4
          let realSims4FolderId = defaultSims4FolderId
          if (realSims4FolderId) {
            try {
              const f = await adminDrive.files.get({
                fileId: realSims4FolderId,
                fields: 'mimeType, shortcutDetails',
                supportsAllDrives: true,
              })
              if (f.data.mimeType === 'application/vnd.google-apps.shortcut') {
                realSims4FolderId = f.data.shortcutDetails.targetId
              }

              await adminDrive.permissions.create({
                fileId: realSims4FolderId,
                supportsAllDrives: true,
                sendNotificationEmail: false,
                requestBody: {
                  role: 'reader',
                  type: 'user',
                  emailAddress: email,
                },
              })
            } catch (e) {
              console.error('Sims 4 Drive permission error:', e.message)
            }
          }

          const licenseRecord = {
            name: itemName,
            invoice: itemInvoice,
            allowCC,
            folderId: realSims4FolderId,
            driveLink: realSims4FolderId ? `https://drive.google.com/drive/folders/${realSims4FolderId}` : null
          }

          sims4Licenses.push(licenseRecord)
          processedItems.push({
            name: itemName,
            isSims4: true,
            invoice: itemInvoice,
            folderId: realSims4FolderId,
            isBonus
          })

        } catch (simsErr) {
          console.error(`Gagal memproses Sims 4 (${itemName}):`, simsErr.message)
          errorItems.push({ name: itemName, error: simsErr.message })
        }

      } else {
        // --- PROSES GAME PC BIASA (MULTI-WORKSPACE G-DRIVE) ---
        try {
          const catalogEntries = await GameCatalog.find({ name: itemName }).sort({ sendCount: 1 }).lean()

          let driveForShare = null
          let ownerEmail = null
          let realId = null
          let permissionId = null
          let successEntry = null

          // Coba dari workspace dengan sendCount terendah
          for (const entry of catalogEntries) {
            try {
              const drive = await getClientForEmail(entry.ownerEmail)
              const permRes = await drive.permissions.create({
                fileId: entry.folderId,
                supportsAllDrives: true,
                sendNotificationEmail: false,
                requestBody: { role: 'reader', type: 'user', emailAddress: email },
              })
              driveForShare = drive
              ownerEmail = entry.ownerEmail
              realId = entry.folderId
              permissionId = permRes.data.id
              successEntry = entry
              break
            } catch (e) {
              console.warn(`Workspace ${entry.ownerEmail} gagal untuk ${itemName}: ${e.message}`)
            }
          }

          // Fallback ke targetId dari payload atau pencarian case-insensitive jika belum berhasil
          if (!driveForShare) {
            realId = (typeof rawItem === 'object' && rawItem.targetId) ? rawItem.targetId : null
            if (!realId) {
              const foundCatalog = await GameCatalog.findOne({
                name: { $regex: '^' + itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' }
              }).lean()
              if (foundCatalog?.folderId) {
                realId = foundCatalog.folderId
                ownerEmail = foundCatalog.ownerEmail
              }
            }

            if (!realId) {
              throw new Error(`Game '${itemName}' tidak ditemukan di katalog Google Drive`)
            }

            const permRes = await adminDrive.permissions.create({
              fileId: realId,
              supportsAllDrives: true,
              sendNotificationEmail: false,
              requestBody: { role: 'reader', type: 'user', emailAddress: email },
            })
            permissionId = permRes.data.id
          } else if (successEntry) {
            await GameCatalog.updateOne({ _id: successEntry._id }, { $inc: { sendCount: 1 } })
          }

          // Log Sheets Sheet1
          if (sheetId) {
            try {
              await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'Sheet1!A:E',
                valueInputOption: 'RAW',
                requestBody: {
                  values: [[new Date().toISOString(), email, itemName, ownerEmail || 'Unknown', isBonus ? 'bonus' : '']],
                },
              })
            } catch (e) {
              console.error('Log error Sheet1:', e.message)
            }
          }

          // Log Sheets ExpiringAccess jika ada batas waktu
          if (expirationTime && permissionId && sheetId) {
            try {
              await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'ExpiringAccess!A:F',
                valueInputOption: 'RAW',
                requestBody: {
                  values: [[email, realId, permissionId, itemName, expirationTime, 'active']],
                },
              })
            } catch (e) {
              console.error('ExpiringAccess error:', e.message)
            }
          }

          // Log MongoDB AccessLog
          try {
            await AccessLog.create({
              email,
              gameName: itemName,
              folderId: realId,
              permissionId,
              ownerEmail: ownerEmail || 'Unknown',
              isBonus: !!isBonus,
              expiresAt: expirationTime ? new Date(expirationTime) : null
            })
          } catch (e) {
            console.error('AccessLog error:', e.message)
          }

          processedItems.push({
            name: itemName,
            isSims4: false,
            folderId: realId,
            ownerEmail: ownerEmail || 'Unknown',
            expirationTime,
            isBonus
          })

        } catch (gameErr) {
          console.error(`Gagal memproses game PC (${itemName}):`, gameErr.message)
          errorItems.push({ name: itemName, error: gameErr.message })
        }
      }
    }

    // 6. Simpan Riwayat Order dan Update Data Pelanggan
    if (processedItems.length > 0) {
      try {
        await Order.create({
          email,
          invoice: rawInvoice || '',
          cartItems: processedItems.map(p => ({
            name: p.name,
            targetId: p.folderId,
            ownerEmail: p.ownerEmail || 'Unknown',
            isBonus: !!p.isBonus
          })),
          bonusEligible: 0,
          bonusClaimed: 0
        })

        await Customer.findOneAndUpdate(
          { email },
          {
            $inc: { orderCount: 1 },
            $setOnInsert: { status: 'active', createdAt: new Date() }
          },
          { upsert: true }
        )
      } catch (dbErr) {
        console.error('Error saving Order/Customer to MongoDB:', dbErr.message)
      }

      // 7. Kirim Email Notifikasi Pelanggan via Gmail
      if (sendEmail) {
        try {
          await sendCombinedWebhookEmail(gmail, email, invoice, processedItems, sims4Licenses)
        } catch (mailErr) {
          console.error('Gagal mengirim email konfirmasi via Gmail API:', mailErr.message)
        }
      }
    }

    // 8. Kembalikan Response Detail ke n8n
    return NextResponse.json({
      success: processedItems.length > 0,
      invoice,
      customerEmail: email,
      platform,
      totalRequested: items.length,
      processedCount: processedItems.length,
      processedItems,
      sims4Licenses,
      failedItems: errorItems,
      emailSent: sendEmail && processedItems.length > 0,
      timestamp: new Date().toISOString()
    })

  } catch (globalErr) {
    console.error('Webhook order handler fatal error:', globalErr)
    return NextResponse.json({ error: globalErr.message }, { status: 500 })
  }
}

// Helper: Format & Kirim Email Gabungan (Game PC + The Sims 4)
async function sendCombinedWebhookEmail(gmail, toEmail, invoice, processedItems, sims4Licenses) {
  const pcGames = (processedItems || [])
    .filter(p => !p.isSims4)
    .map(p => ({
      name: p.name,
      realId: p.folderId || p.realId,
      expirationTime: p.expirationTime || null
    }))

  const sims4Items = (sims4Licenses || []).map(s => ({
    name: 'The Sims 4',
    realId: s.driveLink ? s.driveLink.replace(/.*id=/, '') : '',
    allowCC: s.allowCC,
    invoice: s.invoice || invoice
  }))

  return sendDeliveryEmail({
    toEmail,
    invoice,
    pcGames,
    sims4Items,
    gmailClient: gmail
  })
}
