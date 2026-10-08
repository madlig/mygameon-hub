import { NextResponse } from 'next/server'
import { getGoogleClients, getClientForEmail } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'
import Customer from '@/models/Customer'
import AccessLog from '@/models/AccessLog'
import Order from '@/models/Order'
import Sims4License from '@/models/Sims4License'
import BonusSchema from '@/models/BonusSchema'
import { isSims4Game, buildDeliveryChatMessage, SIMS4_EXTRACT_PASSWORD, SIMS4_DOWNLOAD_URL, SIMS4_TUTORIAL_URL } from '@/lib/sims4'
import { isValidEmail } from '@/lib/validators'

export async function POST(request) {
  try {
    const { email, invoice, cart, expirationTime, isBonus } = await request.json()

    if (!Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'Keranjang game tidak boleh kosong' }, { status: 400 })
    }

    const cleanInvoice = (invoice || '').trim()
    const cleanEmail = email ? email.toLowerCase().trim() : ''

    const hasSims4 = cart.some(item => item.isSims4 || isSims4Game(item.name))
    const hasPCGames = cart.some(item => !(item.isSims4 || isSims4Game(item.name)))

    // ── Validasi Aturan Bisnis ──
    // 1. The Sims 4 tidak dapat dijadikan game bonus
    if (isBonus && hasSims4) {
      return NextResponse.json({ error: 'The Sims 4 tidak dapat dikirim sebagai game bonus.' }, { status: 400 })
    }

    // 2. Jika ada The Sims 4, Nomor Pesanan Shopee (invoice) wajib diisi untuk License Key
    if (hasSims4 && !cleanInvoice) {
      return NextResponse.json({ error: 'Nomor Pesanan Shopee wajib diisi untuk mengaktifkan lisensi The Sims 4.' }, { status: 400 })
    }

    // 3. Jika ada Game PC biasa, Email wajib valid
    if (hasPCGames) {
      if (!cleanEmail || !isValidEmail(cleanEmail)) {
        return NextResponse.json({ error: 'Email pembeli valid wajib diisi untuk pengiriman game PC.' }, { status: 400 })
      }
    } else if (cleanEmail && !isValidEmail(cleanEmail)) {
      // Jika hanya The Sims 4 dan email diisi, format harus valid
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 })
    }

    await connectToDatabase()

    // 4. Cek apakah invoice sudah terdaftar di The Sims 4 (Cegah E11000 duplicate key crash)
    if (hasSims4) {
      const existingLicense = await Sims4License.findOne({ invoice: cleanInvoice })
      if (existingLicense) {
        return NextResponse.json({
          error: `Nomor pesanan '${cleanInvoice}' sudah terdaftar sebagai lisensi The Sims 4 aktif.`
        }, { status: 409 })
      }
    }

    // 5. Cek status blacklist customer jika email ada
    if (cleanEmail) {
      const customer = await Customer.findOne({ email: cleanEmail })
      if (customer?.status === 'blacklisted') {
        return NextResponse.json({ error: 'Akses ditolak: Email pelanggan telah diblokir permanen (Blacklisted).' }, { status: 403 })
      }
    }

    // Admin clients: untuk Gmail (kirim email) dan Sheets (log)
    const { drive: adminDrive, gmail, sheets } = await getGoogleClients()
    const sheetId = process.env.GSHEET_ID
    const sims4SheetId = process.env.GSHEET_SIMS4_ID
    const defaultSims4FolderId = process.env.SIMS4_FOLDER_ID

    const report = []
    const successPCGames = []
    const successSims4Items = []
    const allSuccessItems = []

    for (const item of cart) {
      const isSims = item.isSims4 || isSims4Game(item.name)

      if (isSims) {
        // ── PROSES ITEM THE SIMS 4 ──
        try {
          const allowCC = Boolean(item.allowCC)
          const ccVal = allowCC ? 'Y' : 'N'
          const createdAt = new Date()

          // 1. Catat lisensi ke MongoDB (Ground Truth)
          await Sims4License.create({
            invoice: cleanInvoice,
            hwid: '',
            hwids: [],
            cc: ccVal,
            status: 'Active',
            email: cleanEmail,
            createdAt
          })

          // 2. Dual-write ke Sheets Sims 4 (Non-blocking resilient)
          if (sims4SheetId && sheets) {
            try {
              await sheets.spreadsheets.values.append({
                spreadsheetId: sims4SheetId,
                range: 'Licenses!A:G',
                valueInputOption: 'RAW',
                requestBody: {
                  values: [[cleanInvoice, '', '', ccVal, 'Active', cleanEmail, createdAt.toISOString()]],
                },
              })
            } catch (sheetErr) {
              console.warn('[send route] Gagal append ke Sims 4 Sheet:', sheetErr.message)
            }
          }

          // 3. Share Google Drive folder Sims 4 jika email diisi
          let realSimsFolderId = defaultSims4FolderId
          let permissionId = null

          if (cleanEmail && realSimsFolderId) {
            try {
              // Resolve shortcut jika perlu
              try {
                const f = await adminDrive.files.get({
                  fileId: realSimsFolderId,
                  fields: 'mimeType, shortcutDetails',
                  supportsAllDrives: true,
                })
                if (f.data.mimeType === 'application/vnd.google-apps.shortcut') {
                  realSimsFolderId = f.data.shortcutDetails.targetId
                }
              } catch (_) {}

              const permRes = await adminDrive.permissions.create({
                fileId: realSimsFolderId,
                supportsAllDrives: true,
                sendNotificationEmail: false,
                requestBody: { role: 'reader', type: 'user', emailAddress: cleanEmail },
              })
              permissionId = permRes.data.id

              // Catat riwayat akses ke MongoDB (Sims 4 permanen)
              await AccessLog.create({
                email: cleanEmail,
                gameName: item.name || 'The Sims 4',
                folderId: realSimsFolderId,
                permissionId: permissionId || '',
                ownerEmail: process.env.ADMIN_EMAIL || 'mygameon',
                isBonus: false,
                expiresAt: null // Lisensi Sims 4 selalu permanen
              })
            } catch (permErr) {
              console.warn('[send route] Sims 4 Drive permission warning:', permErr.message)
            }
          }

          const simsRecord = {
            name: item.name || 'The Sims 4',
            realId: realSimsFolderId,
            ownerEmail: process.env.ADMIN_EMAIL || 'mygameon',
            isSims4: true,
            allowCC,
            invoice: cleanInvoice
          }

          successSims4Items.push(simsRecord)
          allSuccessItems.push(simsRecord)
          report.push({ name: item.name, status: 'success' })

        } catch (simsErr) {
          console.error(`Gagal memproses The Sims 4:`, simsErr.message)
          report.push({ name: item.name, status: 'error', message: simsErr.message })
        }

      } else {
        // ── PROSES GAME PC BIASA ──
        try {
          // Cari semua opsi workspace dari katalog untuk game ini (urutkan dari sendCount terkecil)
          const catalogEntries = await GameCatalog.find({ name: item.name }).sort({ sendCount: 1 }).lean()

          let driveForShare = null
          let ownerEmail = null
          let realId = null
          let permissionId = null
          let successEntry = null

          // Coba kirim dari workspace yang beban pengirimannya paling sedikit
          for (const entry of catalogEntries) {
            try {
              const drive = await getClientForEmail(entry.ownerEmail)
              const permRes = await drive.permissions.create({
                fileId: entry.folderId,
                supportsAllDrives: true,
                sendNotificationEmail: false,
                requestBody: { role: 'reader', type: 'user', emailAddress: cleanEmail },
              })
              driveForShare = drive
              ownerEmail = entry.ownerEmail
              realId = entry.folderId
              permissionId = permRes.data.id
              successEntry = entry
              break
            } catch (e) {
              console.warn(`Workspace ${entry.ownerEmail} gagal untuk ${item.name}: ${e.message}`)
              if (e.message && (e.message.toLowerCase().includes('invalid') || e.message.toLowerCase().includes('bad request') || e.code === 400)) {
                throw new Error(`Email tujuan salah atau tidak valid (${cleanEmail})`)
              }
            }
          }

          // Fallback ke token admin jika semua workspace gagal atau tidak ada di katalog
          if (!driveForShare) {
            realId = (item.targetId && item.targetId !== item.name) ? item.targetId : (item.id && item.id !== item.name ? item.id : null)
            ownerEmail = item.ownerEmail || 'Unknown'

            if (!realId) {
              const foundCatalog = await GameCatalog.findOne({
                name: { $regex: '^' + item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' }
              }).lean()
              if (foundCatalog?.folderId) {
                realId = foundCatalog.folderId
                ownerEmail = foundCatalog.ownerEmail
              }
            }

            if (!realId) throw new Error(`Game '${item.name}' tidak ditemukan di katalog Google Drive`)

            try {
              const permRes = await adminDrive.permissions.create({
                fileId: realId,
                supportsAllDrives: true,
                sendNotificationEmail: false,
                requestBody: { role: 'reader', type: 'user', emailAddress: cleanEmail },
              })
              permissionId = permRes.data.id
            } catch (e) {
              if (e.message && (e.message.toLowerCase().includes('invalid') || e.message.toLowerCase().includes('bad request') || e.code === 400)) {
                throw new Error(`Email tujuan salah atau tidak valid (${cleanEmail})`)
              } else if (e.code === 404 || (e.message && e.message.toLowerCase().includes('not found'))) {
                throw new Error(`Akses ditolak: File sumber (${realId}) tidak bisa diakses oleh sistem.`)
              }
              throw e
            }
          } else if (successEntry) {
            await GameCatalog.updateOne(
              { _id: successEntry._id },
              { $inc: { sendCount: 1 } }
            )
          }

          // Log Sheet1 (Non-blocking)
          if (sheetId && sheets) {
            try {
              await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'Sheet1!A:E',
                valueInputOption: 'RAW',
                requestBody: {
                  values: [[new Date().toISOString(), cleanEmail, item.name, ownerEmail || 'Unknown', isBonus ? 'bonus' : '']],
                },
              })
            } catch (e) {
              console.warn('[send route] Log Sheet1 error:', e.message)
            }
          }

          // Log ExpiringAccess (Non-blocking)
          if (expirationTime && permissionId && sheetId && sheets) {
            try {
              await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'ExpiringAccess!A:F',
                valueInputOption: 'RAW',
                requestBody: {
                  values: [[cleanEmail, realId, permissionId, item.name, expirationTime, 'active']],
                },
              })
            } catch (e) {
              console.warn('[send route] ExpiringAccess error:', e.message)
            }
          }

          // Log MongoDB AccessLog
          try {
            await AccessLog.create({
              email: cleanEmail,
              gameName: item.name,
              folderId: realId,
              permissionId: permissionId || '',
              ownerEmail: ownerEmail || 'Unknown',
              isBonus: !!isBonus,
              expiresAt: expirationTime ? new Date(expirationTime) : null
            })
          } catch (e) {
            console.error('[send route] AccessLog MongoDB error:', e.message)
          }

          const pcRecord = {
            name: item.name,
            realId,
            ownerEmail: ownerEmail || 'Unknown',
            expirationTime,
            isSims4: false
          }
          successPCGames.push(pcRecord)
          allSuccessItems.push(pcRecord)
          report.push({ name: item.name, status: 'success' })

        } catch (e) {
          report.push({ name: item.name, status: 'error', message: e.message })
        }
      }
    }

    // ── Pencatatan Dokumen Order & Pelanggan ──
    if (allSuccessItems.length > 0) {
      try {
        if (!isBonus) {
          // The Sims 4 terhitung sebagai kuota pembelian game untuk mendapatkan bonus
          const activeSchema = await BonusSchema.findOne({ isActive: true })
          let eligible = 0
          if (activeSchema && activeSchema.rules) {
            const sortedRules = [...activeSchema.rules].sort((a, b) => b.buyMin - a.buyMin)
            for (const rule of sortedRules) {
              if (allSuccessItems.length >= rule.buyMin) {
                eligible = rule.getBonus
                break
              }
            }
          }

          await Order.create({
            email: cleanEmail,
            invoice: cleanInvoice,
            cartItems: allSuccessItems.map(i => ({
              name: i.name,
              targetId: i.realId,
              ownerEmail: i.ownerEmail || 'Unknown',
              isBonus: false,
              isSims4: !!i.isSims4,
              allowCC: !!i.allowCC
            })),
            bonusEligible: eligible,
            bonusClaimed: 0
          })
        } else {
          // Pemenuhan klaim bonus untuk game biasa
          let remainingClaims = allSuccessItems.length
          const pendingOrders = cleanEmail ? await Order.find({
            email: cleanEmail,
            $expr: { $lt: ["$bonusClaimed", "$bonusEligible"] }
          }).sort({ orderDate: 1 }) : []

          let itemIndex = 0
          for (const pOrder of pendingOrders) {
            if (remainingClaims <= 0) break
            const availableInOrder = (pOrder.bonusEligible || 0) - (pOrder.bonusClaimed || 0)
            const toClaim = Math.min(availableInOrder, remainingClaims)

            const itemsForThisOrder = allSuccessItems.slice(itemIndex, itemIndex + toClaim)
            pOrder.bonusClaimed += toClaim
            pOrder.cartItems.push(...itemsForThisOrder.map(i => ({
              name: i.name,
              targetId: i.realId,
              ownerEmail: i.ownerEmail || 'Unknown',
              isBonus: true,
              isSims4: false,
              allowCC: false
            })))
            await pOrder.save()

            remainingClaims -= toClaim
            itemIndex += toClaim
          }

          if (remainingClaims > 0) {
            const leftoverItems = allSuccessItems.slice(itemIndex)
            await Order.create({
              email: cleanEmail,
              invoice: cleanInvoice,
              cartItems: leftoverItems.map(i => ({
                name: i.name,
                targetId: i.realId,
                ownerEmail: i.ownerEmail || 'Unknown',
                isBonus: true,
                isSims4: false,
                allowCC: false
              })),
              bonusEligible: 0,
              bonusClaimed: leftoverItems.length
            })
          }
        }
      } catch (orderErr) {
        console.error('[send route] Order creation error:', orderErr)
      }

      // Update Customer MongoDB
      if (cleanEmail) {
        try {
          await Customer.findOneAndUpdate(
            { email: cleanEmail },
            {
              $inc: { orderCount: isBonus ? 0 : 1 },
              $setOnInsert: { status: 'active', createdAt: new Date() }
            },
            { upsert: true }
          )
        } catch (custErr) {
          console.error('[send route] Customer MongoDB error:', custErr.message)
        }
      }

      // Kirim Email Konfirmasi Gabungan jika email diisi
      if (cleanEmail && gmail) {
        try {
          await sendCombinedPurchaseEmail(gmail, cleanEmail, cleanInvoice, successPCGames, successSims4Items)
        } catch (mailErr) {
          console.error('[send route] Email sending error:', mailErr.message)
        }
      }
    }

    // Buat pesan teks balasan chat Shopee/WhatsApp siap-salin
    const chatMessage = buildDeliveryChatMessage({
      invoice: cleanInvoice,
      email: cleanEmail,
      pcGames: successPCGames,
      sims4Items: successSims4Items
    })

    return NextResponse.json({
      success: allSuccessItems.length > 0,
      report,
      invoice: cleanInvoice,
      email: cleanEmail,
      chatMessage,
      hasSims4: successSims4Items.length > 0,
      hasPCGames: successPCGames.length > 0
    })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Send error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Helper Email Konfirmasi Pembelian Gabungan ──
async function sendCombinedPurchaseEmail(gmail, toEmail, invoice, pcGames = [], sims4Items = []) {
  let pcSectionHtml = ''
  if (pcGames.length > 0) {
    let listHtml = ''
    for (const item of pcGames) {
      const expiryNote = item.expirationTime
        ? `<p style="margin:4px 0 0;font-size:12px;color:#e67e22;">⏱ Akses berlaku hingga: ${new Date(item.expirationTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`
        : `<p style="margin:4px 0 0;font-size:12px;color:#22c55e;">♾ Akses Permanen</p>`

      listHtml += `
        <div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <p style="margin:0;font-weight:bold;color:#111;font-size:14px;">🎮 ${item.name}</p>
          <p style="margin:4px 0 0;"><a href="https://drive.google.com/open?id=${item.realId}" style="color:#2563eb;text-decoration:none;font-weight:bold;font-size:13px;">Klik di sini untuk Download →</a></p>
          ${expiryNote}
        </div>
      `
    }

    pcSectionHtml = `
      <div style="margin-bottom:24px;">
        <h3 style="color:#111;margin:0 0 10px;font-size:15px;border-bottom:2px solid #2563eb;padding-bottom:5px;">📁 Game PC (Akses Google Drive)</h3>
        ${listHtml}
      </div>
    `
  }

  let simsSectionHtml = ''
  if (sims4Items.length > 0) {
    let listHtml = ''
    for (const item of sims4Items) {
      const variantName = item.allowCC ? 'PREMIUM (Full Mods & Custom Content)' : 'STANDARD (Game Only)'
      listHtml += `
        <div style="background:#fff9db;border-left:5px solid #FFD700;padding:14px;margin:12px 0;border-radius:6px;">
          <h4 style="margin:0 0 8px;color:#111;font-size:14px;">💎 ${item.name}</h4>
          <table style="width:100%;font-size:13px;">
            <tr><td style="font-weight:bold;color:#666;width:140px;padding-bottom:4px;">🔑 License Key:</td><td style="font-weight:bold;color:#000;">${invoice || '—'}</td></tr>
            <tr><td style="font-weight:bold;color:#666;padding-bottom:4px;">🔒 Password Extract:</td><td style="font-weight:bold;color:#000;">${SIMS4_EXTRACT_PASSWORD}</td></tr>
            <tr><td style="font-weight:bold;color:#666;padding-bottom:4px;">📦 Tipe Paket:</td><td style="font-weight:bold;color:#000;">${variantName}</td></tr>
          </table>
          <div style="margin-top:10px;">
            <a href="${SIMS4_DOWNLOAD_URL}" style="display:inline-block;background:#FFD700;color:#000;padding:8px 16px;text-decoration:none;font-weight:bold;border-radius:4px;font-size:12px;margin-right:8px;">
              🚀 Download Launcher
            </a>
            ${item.realId ? `<a href="https://drive.google.com/drive/folders/${item.realId}" style="display:inline-block;background:#333;color:#fff;padding:8px 16px;text-decoration:none;font-weight:bold;border-radius:4px;font-size:12px;">📂 Buka Google Drive</a>` : ''}
          </div>
        </div>
      `
    }

    simsSectionHtml = `
      <div style="margin-bottom:24px;">
        <h3 style="color:#111;margin:0 0 10px;font-size:15px;border-bottom:2px solid #FFD700;padding-bottom:5px;">⭐ The Sims 4 Launcher & Akses</h3>
        ${listHtml}
      </div>
    `
  }

  const subject = sims4Items.length > 0 && pcGames.length > 0
    ? `MyGameON | Pengiriman Pesanan Game & The Sims 4`
    : sims4Items.length > 0
      ? `MyGameON | Pengiriman Akses The Sims 4 (${invoice})`
      : pcGames.length === 1
        ? `MyGameON | Pengiriman Akses Download ${pcGames[0].name}`
        : `MyGameON | Pengiriman Akses Download Game Pesananmu`

  const htmlBody = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#333;max-width:620px;margin:0 auto;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;background:#fff;">
      <div style="background:#111;padding:24px;text-align:center;">
        <h1 style="color:#FFD700;margin:0;font-size:22px;letter-spacing:1.5px;">MYGAMEON</h1>
        <p style="color:#bbb;margin:4px 0 0;font-size:12px;">Pusat Game Digital & Launcher Store</p>
      </div>
      <div style="padding:28px 24px;">
        <h2 style="color:#111;margin-top:0;font-size:18px;">Halo, Kak! 👋</h2>
        <p style="color:#555;font-size:14px;line-height:1.6;">Terima kasih sudah berbelanja di MyGameON. Pesanan kamu sudah kami proses dan akses file siap digunakan.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">

        ${pcSectionHtml}
        ${simsSectionHtml}

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <h4 style="color:#111;margin:0 0 8px;font-size:13px;">Petunjuk Penting:</h4>
        <ol style="color:#555;font-size:12.5px;line-height:1.7;padding-left:18px;margin:0 0 16px;">
          <li>Download file <b>satu per satu</b> agar tidak mengalami kendala kuota/corrupt.</li>
          <li>Tambahkan folder game ke <b>Exclusion / Pengecualian Antivirus</b> sebelum ekstrak file.</li>
          <li>Tonton video tutorial melalui tombol di bawah atau putar langsung file video di dalam folder Google Drive.</li>
        </ol>
        <div style="text-align:center;margin:20px 0 10px;">
          <a href="${SIMS4_TUTORIAL_URL}" style="background:#111;color:#fff;padding:10px 24px;text-decoration:none;font-weight:bold;border-radius:6px;display:inline-block;font-size:13px;">
            🎬 Tonton Video Tutorial Instalasi
          </a>
        </div>
        <p style="font-size:11px;color:#aaa;text-align:center;margin-top:24px;">Email ini dikirim otomatis oleh sistem operasional MyGameON.</p>
      </div>
    </div>
  `

  const rawMessage = [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ].join('\r\n')

  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  })
}