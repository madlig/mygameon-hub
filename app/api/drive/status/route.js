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
