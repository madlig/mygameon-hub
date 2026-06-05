import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import { parseSheetDate } from '@/lib/utils'

const LIMIT = 20

function jktDate(t) {
  const d = new Date(t)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const query = (searchParams.get('q') || '').toLowerCase().trim()
    const all = searchParams.get('all') === '1'
    const page = parseInt(searchParams.get('page') || '1')

    const { sheets } = await getGoogleClients()

    const [generalRes, sims4Res] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_ID, range: 'Sheet1!A:D', valueRenderOption: 'UNFORMATTED_VALUE' }),
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.GSHEET_SIMS4_ID, range: 'Licenses!A:G', valueRenderOption: 'UNFORMATTED_VALUE' }),
    ])

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
        source: row[0] || '',
        status: row[4] || 'Active',
      }))

    // Gabung & urut terbaru dulu
    let combined = [...generalRows, ...sims4Rows].sort((a, b) => {
      return (new Date(b.time).getTime() || 0) - (new Date(a.time).getTime() || 0)
    })

    // Stats global (sebelum filter)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const weekAgo = Date.now() - 7 * 86400000
    const stats = {
      total: combined.length,
      today: combined.filter(r => jktDate(r.time) === todayStr).length,
      week: combined.filter(r => (new Date(r.time).getTime() || 0) >= weekAgo).length,
      sims4: combined.filter(r => r.type === 'sims4').length,
      general: combined.filter(r => r.type === 'general').length,
    }

    // Filter tipe / waktu
    if (filter === 'general') combined = combined.filter(r => r.type === 'general')
    if (filter === 'sims4') combined = combined.filter(r => r.type === 'sims4')
    if (filter === 'today') combined = combined.filter(r => jktDate(r.time) === todayStr)
    if (filter === 'week') combined = combined.filter(r => (new Date(r.time).getTime() || 0) >= weekAgo)
    if (filter === 'month') {
      const monthStr = todayStr.slice(0, 7)
      combined = combined.filter(r => { const j = jktDate(r.time); return j && j.slice(0, 7) === monthStr })
    }

    // Search
    if (query) {
      combined = combined.filter(r =>
        (r.email || '').toLowerCase().includes(query) ||
        (r.product || '').toLowerCase().includes(query) ||
        String(r.source || '').toLowerCase().includes(query)
      )
    }

    const total = combined.length

    if (all) {
      return NextResponse.json({ logs: combined, total, stats })
    }

    const start = (page - 1) * LIMIT
    const paginated = combined.slice(start, start + LIMIT)
    return NextResponse.json({ logs: paginated, total, page, limit: LIMIT, stats })
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
