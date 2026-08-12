import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

// Cache to avoid spamming Google Drive API
let limitCache = {
  status: 'ok', // 'ok' or 'limit'
  email: '',
  reason: '',
  lastCheck: 0
}

export async function GET() {
  try {
    const { drive, session } = await getGoogleClients()
    const adminEmail = session?.user?.email || 'Unknown'

    // Return cached result if checked within the last 5 minutes
    if (Date.now() - limitCache.lastCheck < 5 * 60 * 1000) {
      if (limitCache.status === 'limit') {
        return NextResponse.json({
          status: 'limit',
          reason: limitCache.reason,
          email: limitCache.email
        })
      } else {
        return NextResponse.json({ status: 'ok', email: adminEmail })
      }
    }

    const folderId = process.env.GDRIVE_FOLDER_ID
    if (!folderId) return NextResponse.json({ status: 'ok', email: adminEmail })

    // 1. Get 10 recent shortcuts from the main folder
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.shortcut' and trashed=false`,
      pageSize: 10,
      fields: 'files(shortcutDetails/targetId)'
    })

    const targetIds = listRes.data.files
      ?.map(f => f.shortcutDetails?.targetId)
      .filter(Boolean) || []

    let limitedEmail = null
    let limitedReason = ''

    // 2. Test 1-byte download on all 10 target files in parallel
    if (targetIds.length > 0) {
      const downloadPromises = targetIds.map(targetId =>
        drive.files.get(
          { fileId: targetId, alt: 'media' },
          { headers: { Range: 'bytes=0-0' } }
        ).catch(err => ({ error: err, targetId })) // catch and return error object
      )

      const results = await Promise.all(downloadPromises)

      for (const res of results) {
        if (res && res.error) {
          const dReason = res.error.errors?.[0]?.reason || res.error.message || ''
          if (dReason.toLowerCase().includes('downloadquota') || dReason.toLowerCase().includes('quota')) {
            // Found a limited file! Let's get its owner.
            try {
              const fileInfo = await drive.files.get({
                fileId: res.targetId,
                fields: 'owners',
                supportsAllDrives: true
              })
              limitedEmail = fileInfo.data.owners?.[0]?.emailAddress || 'Unknown Workspace'
              limitedReason = 'Download Quota Exceeded (Bandwidth Limit)'
              break // Stop checking others
            } catch (ownerErr) {
              limitedEmail = 'Unknown Workspace'
              limitedReason = 'Download Quota Exceeded (Bandwidth Limit)'
              break
            }
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
