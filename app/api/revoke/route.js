import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    const { drive } = await getGoogleClients()

    // Cara yang benar — sama persis dengan bot asli
    // Cari semua file dimana email ini adalah reader
    // Tambahkan filter folder saja
const q = `'${email}' in readers and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    const res = await drive.files.list({
      q,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100,
      fields: 'files(id, name, permissions)',
    })

    const files = res.data.files || []
    const accessList = []

    for (const file of files) {
      if (!file.permissions) continue
      const perm = file.permissions.find(
        p => p.emailAddress?.toLowerCase() === email.toLowerCase()
      )
      if (perm) {
        accessList.push({
          fileId: file.id,
          fileName: file.name,
          permissionId: perm.id,
        })
      }
    }

    return NextResponse.json({ accessList })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Revoke scan error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { fileId, permissionId, revokeAll, accessList } = await request.json()

    const { drive } = await getGoogleClients()

    if (revokeAll && accessList?.length > 0) {
      const results = []
      for (const item of accessList) {
        try {
          await drive.permissions.delete({
            fileId: item.fileId,
            permissionId: item.permissionId,
            supportsAllDrives: true,
          })
          results.push({ fileId: item.fileId, status: 'success' })
        } catch (e) {
          results.push({ fileId: item.fileId, status: 'error', message: e.message })
        }
      }
      return NextResponse.json({ results })
    }

    if (fileId && permissionId) {
      await drive.permissions.delete({
        fileId,
        permissionId,
        supportsAllDrives: true,
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}