import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

/**
 * PATCH /api/catalog/[id]/status
 * Body (all fields optional — only provided fields are updated):
 * {
 *   pipelineStatus?: string,
 *   shopeeListed?: boolean,
 *   shopeeListedAt?: string (ISO date),
 *   shopeeUrl?: string,
 *   listingAssets?: { seoTitle, description, slidesFolderPath, generatedAt },
 *   lastUploadedAt?: string (ISO date),
 *   uploadMode?: 'new' | 'update',
 *   driveWorkspaceEmail?: string
 * }
 */
export async function PATCH(request, { params }) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const id = resolvedParams?.id
    if (!id) {
      return NextResponse.json({ error: 'ID game wajib diisi' }, { status: 400 })
    }

    const body = await request.json()

    // Whitelist fields yang boleh diupdate via endpoint ini
    const allowedFields = [
      'pipelineStatus',
      'shopeeListed',
      'shopeeListedAt',
      'shopeeUrl',
      'listingAssets',
      'lastUploadedAt',
      'uploadMode',
      'driveWorkspaceEmail'
    ]

    const updateData = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang valid untuk diupdate' }, { status: 400 })
    }

    await connectToDatabase()
    const updated = await GameCatalog.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )

    if (!updated) {
      return NextResponse.json({ error: 'Game tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('[PATCH /api/catalog/[id]/status] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
