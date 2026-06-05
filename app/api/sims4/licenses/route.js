import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

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

    const { sheets } = await getGoogleClients()
    const sheetId = process.env.GSHEET_SIMS4_ID

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Licenses!A:G',
    })

    const rows = res.data.values || []
    const all = rows
      .filter(row => row[0] && row[0] !== 'Invoice')
      .map(row => ({
        invoice: row[0] || '',
        hwid: row[1] || '',
        cc: row[3] || 'N',
        status: row[4] || 'Active',
        email: row[5] || '',
        createdAt: row[6] || '',
      }))

    // Stats global (sebelum search/filter)
    const stats = {
      total: all.length,
      active: all.filter(x => x.status === 'Active').length,
      banned: all.filter(x => x.status !== 'Active').length,
      premium: all.filter(x => x.cc === 'Y').length,
      standard: all.filter(x => x.cc !== 'Y').length,
      hwidEmpty: all.filter(x => !x.hwid).length,
    }

    // Urut terbaru dulu
    all.sort((a, b) => ts(b.createdAt) - ts(a.createdAt))

    // Search
    let data = all
    if (query) {
      data = data.filter(item =>
        item.invoice.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query)
      )
    }

    // Filter
    if (filter && filter !== 'all') {
      data = data.filter(item => {
        switch (filter) {
          case 'active': return item.status === 'Active'
          case 'banned': return item.status !== 'Active'
          case 'premium': return item.cc === 'Y'
          case 'standard': return item.cc !== 'Y'
          case 'hwidEmpty': return !item.hwid
          default: return true
        }
      })
    }

    const total = data.length
    const start = (page - 1) * LIMIT
    const paginated = data.slice(start, start + LIMIT)

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

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Licenses!A:G',
    })

    const rows = res.data.values || []
    const rowIndex = rows.findIndex(row => row[0] === invoice)

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Lisensi tidak ditemukan' }, { status: 404 })
    }

    // Kolom: A=invoice, B=hwid, C=?, D=cc, E=status, F=email, G=createdAt
    const sheetRow = rowIndex + 1

    if (action === 'resetHwid') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Licenses!B${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['']] },
      })
    } else if (action === 'toggleCC') {
      const currentCC = rows[rowIndex][3] || 'N'
      const newCC = currentCC === 'Y' ? 'N' : 'Y'
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Licenses!D${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[newCC]] },
      })
    } else if (action === 'ban') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Licenses!E${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Banned']] },
      })
    } else if (action === 'unban') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Licenses!E${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Active']] },
      })
    } else {
      return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
