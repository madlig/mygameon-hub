import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'
import {
  listAllFiles,
  buildOwnerMap,
  probeFilesBatched,
  aggregateByOwner,
  syncLimitSheet
} from '@/lib/driveQuota'

export const dynamic = 'force-dynamic'

// State-level caching and tracking for the API route
let ownerCache = {}
let lastResult = null
let lastCheck = 0
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

export async function GET() {
  try {
    const { drive, sheets, session } = await getGoogleClients()
    const adminEmail = session?.user?.email || 'Unknown'
    const folderId = process.env.GDRIVE_FOLDER_ID
    const spreadsheetId = process.env.GSHEET_ID

    if (!folderId) {
      return NextResponse.json({ status: 'ok', email: adminEmail })
    }

    // 1. CACHE CHECK
    if (lastResult && (Date.now() - lastCheck < CACHE_TTL_MS)) {
      return NextResponse.json({
        ...lastResult,
        fromCache: true,
        checkedAt: new Date(lastCheck).toISOString()
      })
    }

    // 2. LIST FILES PAGINATED
    const allItems = await listAllFiles(drive, folderId)
    const targetIds = allItems.map(i => i.targetId)

    if (targetIds.length === 0) {
      return NextResponse.json({ status: 'ok', email: adminEmail, fileCount: 0 })
    }

    // 3. BUILD OWNER MAP
    ownerCache = await buildOwnerMap(drive, targetIds, ownerCache)

    // 4. PROBE DOWNLOAD (Batched)
    const fileResults = await probeFilesBatched(drive, allItems, { chunkSize: 8, maxRetries: 2 })

    // 5. AGGREGATE PER OWNER
    const { limited, workspaces } = aggregateByOwner(fileResults, ownerCache)

    // 6. PERSIST TRANSITIONS TO SHEET
    const prevLimited = lastResult?.limited || []
    // Background sync to not block response
    syncLimitSheet(sheets, spreadsheetId, prevLimited, limited).catch(e => 
      console.error('Failed to sync limit sheet:', e)
    )

    // 7. PREPARE RESPONSE (Hybrid)
    const newResult = {
      status: limited.length > 0 ? 'limit' : 'ok',
      // Maintain backward compatibility for TopBar / Sidebar
      email: limited[0]?.email || '',
      reason: limited[0]?.reason || '',
      // New rich fields
      limited,
      workspaces,
      fileCount: allItems.length
    }

    lastResult = newResult
    lastCheck = Date.now()

    return NextResponse.json({
      ...newResult,
      fromCache: false,
      checkedAt: new Date(lastCheck).toISOString()
    })

  } catch (error) {
    console.error('Drive status error:', error)
    return NextResponse.json({ status: 'error', reason: error.message }, { status: 500 })
  }
}
