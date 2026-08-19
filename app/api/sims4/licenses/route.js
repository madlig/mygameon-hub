import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import Sims4License from '@/models/Sims4License'

const LIMIT = 20

function ts(s) {
  const t = new Date(s).getTime()
  return isNaN(t) ? 0 : t
}

// GET — daftar lisensi dengan search, filter, paginasi, + stats global
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = (searchParams.get('q') || '').toLowerCase()
    const filter = searchParams.get('filter') || 'all'
    const page = parseInt(searchParams.get('page') || '1')

    await connectToDatabase()

    let dbQuery = {}
    if (query) {
      dbQuery = {
        $or: [
          { invoice: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      }
    }

    if (filter && filter !== 'all') {
      switch (filter) {
        case 'active': dbQuery.status = 'Active'; break;
        case 'banned': dbQuery.status = { $ne: 'Active' }; break;
        case 'premium': dbQuery.cc = 'Y'; break;
        case 'standard': dbQuery.cc = { $ne: 'Y' }; break;
        case 'hwidEmpty': dbQuery.hwid = { $in: [null, ''] }; break;
      }
    }

    const total = await Sims4License.countDocuments(dbQuery)
    const start = (page - 1) * LIMIT
    
    const paginated = await Sims4License.find(dbQuery)
      .sort({ createdAt: -1 })
      .skip(start)
      .limit(LIMIT)
      .lean()

    // Hitung stats global
    const [statsTotal, statsActive, statsBanned, statsPremium, statsStandard, statsHwidEmpty] = await Promise.all([
      Sims4License.countDocuments(),
      Sims4License.countDocuments({ status: 'Active' }),
      Sims4License.countDocuments({ status: { $ne: 'Active' } }),
      Sims4License.countDocuments({ cc: 'Y' }),
      Sims4License.countDocuments({ cc: { $ne: 'Y' } }),
      Sims4License.countDocuments({ hwid: { $in: [null, ''] } }),
    ])

    const stats = {
      total: statsTotal,
      active: statsActive,
      banned: statsBanned,
      premium: statsPremium,
      standard: statsStandard,
      hwidEmpty: statsHwidEmpty,
    }

    return NextResponse.json({ licenses: paginated, total, page, limit: LIMIT, stats })
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — update satu lisensi (reset HWID, toggle CC, ban/unban)
export async function PATCH(request) {
  try {
    const { invoice, action } = await request.json()

    if (!invoice || !action) {
      return NextResponse.json({ error: 'Invoice dan action wajib diisi' }, { status: 400 })
    }

    const { sheets } = await getGoogleClients()
    const sheetId = process.env.GSHEET_SIMS4_ID
    await connectToDatabase()

    // Update di MongoDB dulu
    let dbUpdate = {}

    // Ambil baris dari Sheets
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Licenses!A:G',
    })

    const rows = res.data.values || []
    const rowIndex = rows.findIndex(row => row[0] === invoice)

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Lisensi tidak ditemukan di Sheets' }, { status: 404 })
    }

    // Kolom: A=invoice, B=hwid, C=?, D=cc, E=status, F=email, G=createdAt
    const sheetRow = rowIndex + 1

    if (action === 'resetHwid') {
      dbUpdate = { hwid: '' }
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Licenses!B${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['']] },
      })
    } else if (action === 'toggleCC') {
      const currentCC = rows[rowIndex][3] || 'N'
      const newCC = currentCC === 'Y' ? 'N' : 'Y'
      dbUpdate = { cc: newCC }
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Licenses!D${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[newCC]] },
      })
    } else if (action === 'ban') {
      dbUpdate = { status: 'Banned' }
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Licenses!E${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Banned']] },
      })
    } else if (action === 'unban') {
      dbUpdate = { status: 'Active' }
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Licenses!E${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Active']] },
      })
    } else {
      return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
    }

    // Terapkan ke MongoDB
    await Sims4License.findOneAndUpdate({ invoice }, { $set: dbUpdate })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
