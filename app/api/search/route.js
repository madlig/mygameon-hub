import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

function fmtSize(bytes) {
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(2)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('q')

    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 30
    const skip = (page - 1) * limit

    // Auth check
    const { session } = await getGoogleClients()

    await connectToDatabase()
    
    const pipeline = []

    if (keyword && keyword.trim().length >= 2) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      pipeline.push({ $match: { name: { $regex: escapedKeyword, $options: 'i' } } })
    }

    pipeline.push(
      { $sort: { name: 1 } },
      { $group: {
          _id: { $toLower: "$name" },
          name: { $first: "$name" },
          size: { $first: "$size" },
          totalFiles: { $first: "$totalFiles" },
          sources: { $push: { folderId: "$folderId", ownerEmail: "$ownerEmail", sendCount: { $ifNull: ["$sendCount", 0] } } }
        }
      },
      { $sort: { name: 1 } },
      { $skip: skip },
      { $limit: limit }
    )

    const groupedGames = await GameCatalog.aggregate(pipeline)

    const results = groupedGames.map(g => {
      // Sort sources by sendCount
      g.sources.sort((a, b) => a.sendCount - b.sendCount)
      return {
        id: g.name,
        name: g.name,
        size: fmtSize(g.size),
        totalFiles: g.totalFiles,
        mimeType: 'application/vnd.google-apps.folder',
        isShortcut: false,
        sources: g.sources,
        ownerEmail: g.sources.map(s => s.ownerEmail).join(', '),
        availableIn: g.sources.length
      }
    })

    return NextResponse.json({ results, page, hasMore: results.length === limit })

  } catch (err) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Search error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}