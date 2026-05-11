import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

// GET — ambil semua lisensi dengan optional search
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20

    const { sheets } = await getGoogleClients()
    const sheetId = process.env.GSHEET_SIMS4_ID

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Licenses!A:G',
    })

    const rows = res.data.values || []

    // Skip header row jika ada, filter berdasarkan query
    const data = rows
      .filter(row => row[0] && row[0] !== 'Invoice') // skip header
      .map(row => ({
        invoice: row[0] || '',
        hwid: row[1] || '',
        cc: row[3] || 'N',
        status: row[4] || 'Active',
        email: row[5] || '',
        createdAt: row[6] || '',
      }))
      .filter(item => {
        if (!query) return true
        const q = query.toLowerCase()
        return item.invoice.toLowerCase().includes(q) ||
               item.email.toLowerCase().includes(q)
      })

    // Pagination
    const total = data.length
    const start = (page - 1) * limit
    const paginated = data.slice(start, start + limit)

    return NextResponse.json({ licenses: paginated, total, page, limit })

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
    // Sheets row index dimulai dari 1, +1 untuk header
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