import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

/**
 * GET /api/catalog/pipeline
 * Query params:
 *   status?: comma-separated pipelineStatus values to filter (e.g. "on_drive,listing_ready")
 *   shopeeListed?: "true" | "false"
 *   limit?: number (default 100)
 *
 * Returns list of games with pipeline and listing status.
 * Sorted: unlisted on_drive first, then listing_ready, then listed last.
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const shopeeListedFilter = searchParams.get('shopeeListed')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    await connectToDatabase()

    const query = {}

    if (statusFilter) {
      const statuses = statusFilter.split(',').map(s => s.trim())
      if (statuses.includes('on_drive')) {
        query.$or = [
          { pipelineStatus: { $in: statuses } },
          { pipelineStatus: null, folderId: { $exists: true } },
          { pipelineStatus: { $exists: false }, folderId: { $exists: true } }
        ]
      } else {
        query.pipelineStatus = { $in: statuses }
      }
    }

    if (shopeeListedFilter !== null) {
      query.shopeeListed = shopeeListedFilter === 'true' ? true : { $ne: true }
    }

    const games = await GameCatalog.find(query)
      .select('name cleanTitle folderId ownerEmail pipelineStatus shopeeListed shopeeListedAt shopeeUrl listingAssets lastUploadedAt coverImageUrl steamAppId driveWorkspaceEmail')
      .sort({ shopeeListed: 1, pipelineStatus: -1, updatedAt: -1 })
      .limit(limit)
      .lean()

    // Summary counts (resilient against unmigrated records)
    const totalOnDrive = await GameCatalog.countDocuments({
      $or: [
        { pipelineStatus: { $in: ['on_drive', 'listing_ready', 'listed'] } },
        { folderId: { $exists: true, $ne: '' } }
      ]
    })
    const totalListed = await GameCatalog.countDocuments({ shopeeListed: true })
    const totalUnlisted = await GameCatalog.countDocuments({
      shopeeListed: { $ne: true },
      $or: [
        { pipelineStatus: { $in: ['on_drive', 'listing_ready'] } },
        { folderId: { $exists: true, $ne: '' } }
      ]
    })

    return NextResponse.json({
      success: true,
      data: games,
      summary: { totalOnDrive, totalUnlisted, totalListed }
    })
  } catch (err) {
    console.error('[GET /api/catalog/pipeline] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
