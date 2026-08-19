import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import Customer from '@/models/Customer'
import AccessLog from '@/models/AccessLog'

export async function GET(request) {
  try {
    const { sheets } = await getGoogleClients()
    await connectToDatabase()

    // Ambil data dari Sheets
    const [logRes, expRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_ID, range: 'Sheet1!A:D' }),
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_ID, range: 'ExpiringAccess!A:F' }),
    ])

    const logRows = logRes.data.values || []
    const expRows = expRes.data.values || []

    const customerMap = new Map() // email -> { orderCount }
    
    // 1. Hitung jumlah order dari Sheet1
    for (let i = 1; i < logRows.length; i++) { // skip header
      const row = logRows[i]
      if (!row[1]) continue
      const email = row[1].toLowerCase().trim()
      if (!customerMap.has(email)) customerMap.set(email, { orderCount: 0 })
      customerMap.get(email).orderCount += 1
    }

    // 2. Upsert Customer Profiles
    const customerOps = []
    for (const [email, data] of customerMap.entries()) {
      customerOps.push({
        updateOne: {
          filter: { email },
          update: { 
            $set: { orderCount: data.orderCount },
            $setOnInsert: { status: 'active', createdAt: new Date() }
          },
          upsert: true
        }
      })
    }
    if (customerOps.length > 0) {
      await Customer.bulkWrite(customerOps)
    }

    // 3. Migrate ExpiringAccess to AccessLog
    const accessOps = []
    for (let i = 1; i < expRows.length; i++) { // skip header
      const row = expRows[i]
      if (!row[0] || !row[1] || !row[2]) continue
      const email = row[0].toLowerCase().trim()
      const folderId = row[1]
      const permissionId = row[2]
      const gameName = row[3] || 'Unknown'
      
      let expiresAt = null
      if (row[4]) {
        const parsed = new Date(row[4])
        if (!isNaN(parsed.getTime())) {
          expiresAt = parsed
        }
      }

      const status = (row[5] || 'active').toLowerCase()

      accessOps.push({
        updateOne: {
          filter: { email, folderId, permissionId },
          update: {
            $set: {
              email, gameName, folderId, permissionId,
              ownerEmail: 'Unknown', // Kita tidak tahu pasti dari sheet ini
              status,
              expiresAt
            }
          },
          upsert: true
        }
      })
    }
    
    if (accessOps.length > 0) {
      await AccessLog.bulkWrite(accessOps)
    }

    return NextResponse.json({ 
      success: true, 
      customersMigrated: customerOps.length,
      accessLogsMigrated: accessOps.length 
    })

  } catch (err) {
    console.error('Migration error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
