import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import { parseSheetDate } from '@/lib/utils'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20

    const { sheets } = await getGoogleClients()

    // Ambil log General Games
    const generalRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GSHEET_ID,
      range: 'Sheet1!A:D',
      valueRenderOption: 'UNFORMATTED_VALUE',
    })

    // Ambil log Sims 4
    const sims4Res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GSHEET_SIMS4_ID,
      range: 'Licenses!A:G',
      valueRenderOption: 'UNFORMATTED_VALUE',
    })

    const generalRows = (generalRes.data.values || [])
      .filter(row => row[0] && row[0] !== 'Date')
      .map(row => ({
        type: 'general',
        time: parseSheetDate(row[0]),
        email: row[1] || '',
        product: row[2] || '',
        source: row[3] || '',
        status: 'Terkirim',
      }))

    const sims4Rows = (sims4Res.data.values || [])
      .filter(row => row[0] && row[0] !== 'Invoice')
      .map(row => ({
        type: 'sims4',
        time: parseSheetDate(row[6]),
        email: row[5] || '',
        product: `Sims 4 · ${row[3] === 'Y' ? 'Premium CC' : 'Standard'}`,
        source: row[0] || '', // invoice number
        status: row[4] || 'Active',
      }))

    // Gabung dan sort berdasarkan waktu (terbaru dulu)
    let combined = [...generalRows, ...sims4Rows].sort((a, b) => {
      const ta = new Date(a.time).getTime() || 0
      const tb = new Date(b.time).getTime() || 0
      return tb - ta
    })

    // Filter
    if (filter === 'general') combined = combined.filter(r => r.type === 'general')
    if (filter === 'sims4') combined = combined.filter(r => r.type === 'sims4')
    if (filter === 'today') {
      const today = new Date().toDateString()
      combined = combined.filter(r => new Date(r.time).toDateString() === today)
    }
    if (filter === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      combined = combined.filter(r => new Date(r.time) >= weekAgo)
    }

    // Pagination
    const total = combined.length
    const start = (page - 1) * limit
    const paginated = combined.slice(start, start + limit)

    return NextResponse.json({ logs: paginated, total, page, limit })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}