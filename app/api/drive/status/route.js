import { NextResponse } from 'next/server'
import { getGoogleClients, getClientForEmail } from '@/lib/googleClient'
import { syncLimitSheet } from '@/lib/driveQuota'
import connectToDatabase from '@/lib/db'
import WorkspaceAccount from '@/models/WorkspaceAccount'
import GameCatalog from '@/models/GameCatalog'

export const dynamic = 'force-dynamic'

// State-level caching
let lastResult = null
let lastCheck = 0
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

export async function GET() {
  try {
    const { sheets, session } = await getGoogleClients()
    const adminEmail = session?.user?.email || 'Unknown'

    // 1. CACHE CHECK
    if (lastResult && (Date.now() - lastCheck < CACHE_TTL_MS)) {
      return NextResponse.json({
        ...lastResult,
        fromCache: true,
        checkedAt: new Date(lastCheck).toISOString()
      })
    }

    // 2. AMBIL SEMUA WORKSPACE YANG AKTIF
    await connectToDatabase()
    const accounts = await WorkspaceAccount.find({ status: 'active' })

    if (accounts.length === 0) {
      return NextResponse.json({ status: 'ok', email: adminEmail, fileCount: 0, workspaces: [], limited: [] })
    }

    // 3. UNTUK SETIAP WORKSPACE: ambil 1 game sebagai sampel, probe download-ability
    const workspaces = []
    const limited = []
    let globalPooledStorage = null

    await Promise.all(accounts.map(async (acc) => {
      try {
        const drive = await getClientForEmail(acc.email)

        // Ambil daftar game dari katalog
        const games = await GameCatalog.find({ ownerEmail: acc.email }).lean()

        if (games.length === 0) {
          workspaces.push({
            email: acc.email,
            status: 'ok',
            reason: '',
            allFiles: [],
          })
          return
        }

        // Probe 1 game sebagai sampel (download cek)
        const sampleGame = games[0]
        let wsStatus = 'ok'
        let wsReason = ''
        let hasSharedDriveAccess = true
        let storageInfo = null

        try {
          // Check Shared Drive Access
          await drive.files.get({ fileId: '0ALxyHsjPxl82Uk9PVA', fields: 'id', supportsAllDrives: true })
        } catch (sharedErr) {
          hasSharedDriveAccess = false
          wsReason = 'Belum tergabung ke Shared Drive KEBERSAMAAN'
        }

        try {
          // Hanya fetch Pooled Storage sekali untuk efisiensi API
          if (!globalPooledStorage) {
            const aboutRes = await drive.about.get({ fields: 'storageQuota' })
            const { usage, limit } = aboutRes.data.storageQuota
            if (limit && parseInt(limit, 10) >= (100 * 1024 ** 3)) { // Jika limit >= 100 TB
              const pooledUsageGB = (usage / (1024 ** 3)).toFixed(2)
              const pooledLimitGB = (limit / (1024 ** 3)).toFixed(2)
              const pooledPercentage = Math.min(100, Math.round((usage / limit) * 100))
              globalPooledStorage = { usageGB: pooledUsageGB, limitGB: pooledLimitGB, percentage: pooledPercentage }
            }
          }

          // Hitung ukuran aktual via pencarian global super cepat
          let totalBytes = 0
          let pageToken = null
          
          do {
            const res = await drive.files.list({
              q: "trashed=false and 'me' in owners",
              fields: "nextPageToken, files(quotaBytesUsed)",
              pageSize: 1000,
              spaces: 'drive',
            })
            
            for (const f of res.data.files || []) {
              if (f.quotaBytesUsed) {
                totalBytes += parseInt(f.quotaBytesUsed, 10)
              }
            }
            pageToken = res.data.nextPageToken
          } while (pageToken)
          
          const usageGB = (totalBytes / (1024 ** 3)).toFixed(2)
          const limitGB = 1024 // 1 TB Hardcoded
          const percentage = Math.min(100, Math.round((totalBytes / (limitGB * (1024 ** 3))) * 100))
          storageInfo = { usageGB, limitGB, percentage }
        } catch (storageErr) {
          // Abaikan error storage agar tidak memblokir fungsionalitas lain
        }

        try {
          // Cari 1 file biner di dalam folder game
          const childRes = await drive.files.list({
            q: `'${sampleGame.folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
            pageSize: 1,
            fields: 'files(id)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          })

          if (childRes.data.files && childRes.data.files.length > 0) {
            const fileIdToProbe = childRes.data.files[0].id
            await drive.files.get(
              { fileId: fileIdToProbe, alt: 'media' },
              { headers: { Range: 'bytes=0-0' } }
            )
          } else {
            wsStatus = 'ok'
            wsReason = 'Folder kosong atau tidak ada file biner'
          }
        } catch (probeErr) {
          const code = probeErr?.code || probeErr?.response?.status
          const reason = probeErr?.errors?.[0]?.reason || ''

          if (code === 403 && (reason === 'downloadQuotaExceeded' || reason === 'rateLimitExceeded')) {
            wsStatus = 'limit'
            wsReason = 'Download quota exceeded'
          } else if (code === 403) {
            wsStatus = 'limit'
            wsReason = reason || 'Forbidden'
          } else if (code === 429) {
            wsStatus = 'ok' // Anggap OK sementara jika kena rate limit umum Google
            wsReason = 'Rate Limit API'
          }
          // 404, other errors: bukan limit, game mungkin dihapus — skip
        }

        const wsData = {
          email: acc.email,
          status: wsStatus,
          reason: wsReason,
          hasSharedDriveAccess,
          storage: storageInfo,
          allFiles: games.map(g => ({
            id: g.folderId,
            name: g.name,
            targetId: g.folderId,
            status: wsStatus, // semua game di workspace sama statusnya
            reason: wsReason,
          })),
        }

        workspaces.push(wsData)

        if (wsStatus === 'limit') {
          limited.push(wsData)
        }
      } catch (e) {
        console.error(`Drive status check failed for ${acc.email}:`, e.message)
        workspaces.push({
          email: acc.email,
          status: 'error',
          reason: e.message,
          allFiles: [],
        })
      }
    }))

    // Sort workspaces A-Z (natural)
    workspaces.sort((a, b) => a.email.localeCompare(b.email, undefined, { numeric: true }))

    // 4. PREPARE RESPONSE
    const totalFiles = workspaces.reduce((s, w) => s + w.allFiles.length, 0)

    const newResult = {
      status: limited.length > 0 ? 'limit' : 'ok',
      email: limited[0]?.email || '',
      reason: limited[0]?.reason || '',
      limited,
      workspaces,
      fileCount: totalFiles,
      globalPooledStorage
    }

    // 5. PERSIST TRANSITIONS TO SHEET
    const prevLimited = lastResult?.limited || []
    // Background sync to not block response
    syncLimitSheet(sheets, process.env.GSHEET_ID, prevLimited, limited).catch(e => 
      console.error('Failed to sync limit sheet:', e)
    )

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
