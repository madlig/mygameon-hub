import { NextResponse } from 'next/server'
import { getGoogleClients } from '@/lib/googleClient'

export async function GET() {
  try {
    const { drive, session } = await getGoogleClients()
    const email = session?.user?.email || 'Unknown'

    // Try to get quota and user info
    const res = await drive.about.get({ fields: 'user, storageQuota' })
    const quota = res.data.storageQuota

    let isStorageLimit = false
    if (quota && quota.limit) {
      // Check if usage is >= limit
      const usage = BigInt(quota.usage || 0)
      const limit = BigInt(quota.limit)
      if (usage >= limit) {
        isStorageLimit = true
      }
    }

    if (isStorageLimit) {
      return NextResponse.json({
        status: 'limit',
        reason: 'Storage Quota Exceeded',
        email,
      })
    }

    // NEW: Check Download Limit (Bandwidth) by trying to read 1 byte of 1 file
    try {
      const listRes = await drive.files.list({
        pageSize: 1,
        fields: 'files(id)',
        q: "mimeType != 'application/vnd.google-apps.folder' and mimeType != 'application/vnd.google-apps.document' and mimeType != 'application/vnd.google-apps.spreadsheet'"
      })
      if (listRes.data.files && listRes.data.files.length > 0) {
        const testFileId = listRes.data.files[0].id
        await drive.files.get(
          { fileId: testFileId, alt: 'media' },
          { headers: { Range: 'bytes=0-0' } }
        )
      }
    } catch (downloadErr) {
      const dReason = downloadErr.errors?.[0]?.reason || downloadErr.message || ''
      if (dReason.toLowerCase().includes('downloadquota') || dReason.toLowerCase().includes('quota')) {
        return NextResponse.json({
          status: 'limit',
          reason: 'Download Quota Exceeded (Bandwidth Limit)',
          email,
        })
      }
      // if it's another error (like file not readable), we ignore and assume ok
    }

    return NextResponse.json({
      status: 'ok',
      email,
      quota,
    })

  } catch (error) {
    console.error('Drive status error:', error)
    const email = error.response?.config?.data ? 'Unknown' : 'Workspace Email'
    const reasonStr = error.errors?.[0]?.reason || error.message || ''

    if (reasonStr.toLowerCase().includes('ratelimit') || reasonStr.toLowerCase().includes('quota')) {
      return NextResponse.json({
        status: 'limit',
        reason: 'Rate Limit / Quota Exceeded',
        email,
        details: reasonStr
      })
    }

    return NextResponse.json({
      status: 'error',
      reason: error.message,
    }, { status: 500 })
  }
}
