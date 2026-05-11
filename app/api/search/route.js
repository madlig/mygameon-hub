import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('q')

    if (!keyword || keyword.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }

    const { drive } = await getGoogleClients()

    const folderId = process.env.GDRIVE_FOLDER_ID
    const q = `'${folderId}' in parents and name contains '${keyword.replace(/'/g, "\\'")}' and trashed = false`

    const response = await drive.files.list({
      q,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100,
      fields: 'files(id, name, mimeType, shortcutDetails)',
    })

    const files = response.data.files || []

    // Deduplikasi berdasarkan nama (exact, case-insensitive)
    const seen = new Set()
    const unique = files.filter(f => {
      const key = f.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Resolve shortcut — simpan ID shortcut sebagai referensi,
    // tapi kita perlu ID asli untuk share permission nanti
    const results = unique.map(f => ({
      id: f.id, // ID yang disimpan di cart (shortcut ID)
      name: f.name,
      mimeType: f.mimeType,
      isShortcut: f.mimeType === 'application/vnd.google-apps.shortcut',
      targetId: f.shortcutDetails?.targetId || f.id,
    }))

    return NextResponse.json({ results })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Search error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}