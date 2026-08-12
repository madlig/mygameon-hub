import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

// Global Cache
let limitCache = {
  status: 'ok',
  email: '',
  reason: '',
  lastCheck: 0
}

// Stores 1 fileId per unique workspace: { 'workspace1@': 'fileId1', 'workspace2@': 'fileId2' }
let knownWorkspaces = {}
let lastWorkspaceDiscovery = 0
let isDiscovering = false

async function discoverWorkspaces(drive, folderId) {
  if (isDiscovering) return
  isDiscovering = true
  try {
    const listRes = await drive.files.list({
      // Do NOT restrict to shortcuts only, because files might be real files!
      // But exclude folders so we don't accidentally test download quota on a folder.
      q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
      pageSize: 150,
      orderBy: 'createdTime desc',
      fields: 'files(id, mimeType, shortcutDetails/targetId)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const files = listRes.data.files || []
    
    // Resolve target IDs (if shortcut, get targetId, else use its own id)
    const targetIds = files.map(f => 
      f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails 
        ? f.shortcutDetails.targetId 
        : f.id
    ).filter(Boolean)

    for (const targetId of targetIds) {
      try {
        const fileInfo = await drive.files.get({
          fileId: targetId,
          fields: 'owners',
          supportsAllDrives: true
        })
        const ownerEmail = fileInfo.data.owners?.[0]?.emailAddress
        if (ownerEmail && !knownWorkspaces[ownerEmail]) {
          knownWorkspaces[ownerEmail] = targetId
        }
      } catch (err) {
        // ignore individual file errors during discovery
      }
    }
    lastWorkspaceDiscovery = Date.now()
  } catch (error) {
    console.error('Workspace discovery failed:', error)
  } finally {
    isDiscovering = false
  }
}

export async function GET() {
  try {
    const { drive, session } = await getGoogleClients()
    const adminEmail = session?.user?.email || 'Unknown'
    const folderId = process.env.GDRIVE_FOLDER_ID

    if (!folderId) return NextResponse.json({ status: 'ok', email: adminEmail })

    // 1. Kick off background discovery if we haven't discovered yet or it's been 24 hours
    if (Object.keys(knownWorkspaces).length === 0 || Date.now() - lastWorkspaceDiscovery > 1000 * 60 * 60 * 24) {
      // Don't await it, let it run in background so UI doesn't hang
      discoverWorkspaces(drive, folderId)
    }

    // Return cached result if checked within the last 15 seconds (reduced for testing)
    if (Date.now() - limitCache.lastCheck < 15 * 1000) {
      if (limitCache.status === 'limit') {
        return NextResponse.json({
          status: 'limit',
          reason: limitCache.reason,
          email: limitCache.email
        })
      }
      return NextResponse.json({ status: 'ok', email: adminEmail })
    }

    let limitedEmail = null
    let limitedReason = ''

    // 2. Test 1-byte download on ONE file from EVERY known workspace!
    const testFileIds = Object.values(knownWorkspaces)
    
    // If discovery hasn't finished yet (first load), fallback to testing a few random files
    let idsToTest = testFileIds
    if (idsToTest.length === 0) {
      const listRes = await drive.files.list({
        q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
        pageSize: 5,
        fields: 'files(id, mimeType, shortcutDetails/targetId)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })
      idsToTest = listRes.data.files?.map(f => 
        f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails 
          ? f.shortcutDetails.targetId 
          : f.id
      ).filter(Boolean) || []
    }

    if (idsToTest.length > 0) {
      const downloadPromises = idsToTest.map(targetId =>
        drive.files.get(
          { fileId: targetId, alt: 'media' },
          { headers: { Range: 'bytes=0-0' } }
        ).catch(err => ({ error: err, targetId }))
      )

      const results = await Promise.all(downloadPromises)

      for (const res of results) {
        if (res && res.error) {
          const dReason = res.error.errors?.[0]?.reason || res.error.message || ''
          if (dReason.toLowerCase().includes('downloadquota') || dReason.toLowerCase().includes('quota')) {
            // Find which email owns this failing targetId
            limitedEmail = Object.keys(knownWorkspaces).find(key => knownWorkspaces[key] === res.targetId)
            if (!limitedEmail) {
              // If not found in cache (fallback mode), fetch owner
              try {
                const info = await drive.files.get({ fileId: res.targetId, fields: 'owners', supportsAllDrives: true })
                limitedEmail = info.data.owners?.[0]?.emailAddress || 'Unknown Workspace'
              } catch (e) {
                limitedEmail = 'Unknown Workspace'
              }
            }
            limitedReason = 'Download Quota Exceeded (Bandwidth Limit)'
            break
          }
        }
      }
    }

    // Update Cache
    limitCache.lastCheck = Date.now()
    if (limitedEmail) {
      limitCache.status = 'limit'
      limitCache.email = limitedEmail
      limitCache.reason = limitedReason
      return NextResponse.json({
        status: 'limit',
        reason: limitedReason,
        email: limitedEmail
      })
    } else {
      limitCache.status = 'ok'
      limitCache.email = ''
      limitCache.reason = ''
      return NextResponse.json({ status: 'ok', email: adminEmail })
    }

  } catch (error) {
    console.error('Drive status error:', error)
    return NextResponse.json({ status: 'error', reason: error.message }, { status: 500 })
  }
}
