/**
 * Helper functions for detecting Google Drive download quota limits.
 * Implements a batched probe-and-observe strategy.
 */

/**
 * Lists all files/shortcuts in a folder using pagination.
 * @returns Array of { targetId, name, id }
 */
export async function listAllFiles(drive, folderId) {
  let allItems = []
  let pageToken = null

  do {
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
      pageSize: 100,
      pageToken: pageToken,
      fields: 'nextPageToken, files(id, name, mimeType, shortcutDetails/targetId, shortcutDetails/targetMimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const files = listRes.data.files || []
    for (const f of files) {
      let targetId = f.id
      let targetMimeType = f.mimeType

      if (f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails) {
        targetId = f.shortcutDetails.targetId
        targetMimeType = f.shortcutDetails.targetMimeType
      }
      if (targetId) {
        allItems.push({ targetId, name: f.name, id: f.id, targetMimeType })
      }
    }
    pageToken = listRes.data.nextPageToken
  } while (pageToken)

  return allItems
}

/**
 * Builds a mapping of targetId to ownerEmail. Uses an in-memory cache to avoid redundant API calls.
 * @param {object} drive - Google Drive API client
 * @param {Array<string>} targetIds - List of target IDs
 * @param {object} cache - In-memory object mapping targetId -> ownerEmail
 */
export async function buildOwnerMap(drive, targetIds, cache) {
  const uniqueIds = [...new Set(targetIds)]
  const missingIds = uniqueIds.filter(id => !cache[id])
  
  // Batch processing missing owners to avoid rapid rate limits
  // We don't want to hit 100s of requests per second.
  const chunkSize = 10
  for (let i = 0; i < missingIds.length; i += chunkSize) {
    const chunk = missingIds.slice(i, i + chunkSize)
    const promises = chunk.map(async (fileId) => {
      try {
        const fileInfo = await drive.files.get({
          fileId,
          fields: 'owners',
          supportsAllDrives: true
        })
        const email = fileInfo.data.owners?.[0]?.emailAddress
        if (email) {
          cache[fileId] = email
        }
      } catch (err) {
        // Log but don't fail entire process
        // console.error(`Error fetching owner for ${fileId}:`, err.message)
      }
    })
    await Promise.allSettled(promises)
    // Small delay between chunks to respect API limits
    if (i + chunkSize < missingIds.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  return cache
}

/**
 * Classifies a Google Drive API error.
 */
export function classifyError(err) {
  if (!err) return 'ok'
  const reason = err.errors?.[0]?.reason || err.message || ''
  const reasonLower = reason.toLowerCase()

  if (reasonLower.includes('downloadquota') || reasonLower.includes('quotaexceeded') || reasonLower.includes('download quota')) {
    // Specifically looking for download quota exceeded
    return 'download_limit'
  }
  if (reasonLower.includes('ratelimit') || reasonLower.includes('userratelimit')) {
    // Rate limit (Too Many Requests), should be retried, not a block
    return 'rate_limit'
  }
  return 'other'
}

/**
 * Probes files by downloading 1 byte, batched to avoid 429s.
 * @returns Array of { targetId, status: 'ok'|'download_limit'|'rate_limit'|'other', name, reason }
 */
export async function probeFilesBatched(drive, items, { chunkSize = 8, maxRetries = 2 } = {}) {
  const results = []
  
  // Create a queue
  let queue = [...items]

  while (queue.length > 0) {
    const chunk = queue.splice(0, chunkSize)
    const promises = chunk.map(async (item) => {
      let attempts = 0
      while (attempts <= maxRetries) {
        try {
          let fileIdToProbe = item.targetId

          // If the target is a folder, we cannot download it. We must find 1 binary file inside it.
          if (item.targetMimeType === 'application/vnd.google-apps.folder') {
            const childRes = await drive.files.list({
              q: `'${item.targetId}' in parents and mimeType != 'application/vnd.google-apps.folder' and mimeType != 'application/vnd.google-apps.shortcut' and trashed=false`,
              pageSize: 1,
              fields: 'files(id)',
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            })
            if (childRes.data.files && childRes.data.files.length > 0) {
              fileIdToProbe = childRes.data.files[0].id
            } else {
              return { ...item, status: 'ok', reason: 'Folder is empty or contains no binary files', rawError: null }
            }
          }

          await drive.files.get(
            { fileId: fileIdToProbe, alt: 'media' },
            { headers: { Range: 'bytes=0-0' } }
          )
          return { ...item, status: 'ok', reason: '' }
        } catch (err) {
          const type = classifyError(err)
          const reason = err.errors?.[0]?.reason || err.message || ''
          
          if (type === 'rate_limit' && attempts < maxRetries) {
            attempts++
            // Exponential backoff
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempts)))
            continue
          }
          return { ...item, status: type, reason, rawError: err.message || JSON.stringify(err) }
        }
      }
    })

    const chunkResults = await Promise.all(promises)
    results.push(...chunkResults)
  }

  return results
}

/**
 * Aggregates individual file results by their owner.
 * @returns { limited: [], workspaces: [], debugErrors: [] }
 */
export function aggregateByOwner(fileResults, ownerMap) {
  const workspacesMap = {}
  const debugErrors = []

  for (const res of fileResults) {
    const email = ownerMap[res.targetId] || 'Unknown Workspace'
    if (!workspacesMap[email]) {
      workspacesMap[email] = {
        email,
        totalFiles: 0,
        limitedFiles: 0,
        files: [],
        reason: ''
      }
    }

    workspacesMap[email].totalFiles++
    
    // Debug: capture any error that is not 'ok'
    if (res.status !== 'ok') {
      debugErrors.push({
        fileId: res.targetId,
        fileName: res.name,
        email,
        status: res.status,
        rawReason: res.reason,
        rawErrorObject: res.rawError // We will add this in probeFilesBatched
      })
    }

    if (res.status === 'download_limit') {
      workspacesMap[email].limitedFiles++
      workspacesMap[email].reason = res.reason
      workspacesMap[email].files.push({ id: res.targetId, name: res.name })
    }
  }

  const workspaces = Object.values(workspacesMap).map(ws => ({
    email: ws.email,
    status: ws.limitedFiles > 0 ? 'limit' : 'ok',
    totalFiles: ws.totalFiles,
    limitedFiles: ws.limitedFiles
  }))

  const limited = Object.values(workspacesMap)
    .filter(ws => ws.limitedFiles > 0)
    .map(ws => ({
      email: ws.email,
      reason: ws.reason,
      files: ws.files
    }))

  return { limited, workspaces, debugErrors }
}

/**
 * Ensures 'DriveLimits' tab exists and appends transitions.
 */
export async function syncLimitSheet(sheets, spreadsheetId, prevSet, nextSet) {
  if (!spreadsheetId) return

  // Compare previous limited emails with current
  const prevEmails = new Set(prevSet.map(l => l.email))
  const nextEmails = new Set(nextSet.map(l => l.email))

  const newLimits = nextSet.filter(l => !prevEmails.has(l.email))
  const resolvedLimits = prevSet.filter(l => !nextEmails.has(l.email))

  if (newLimits.length === 0 && resolvedLimits.length === 0) {
    return // No state change
  }

  try {
    // Check if DriveLimits sheet exists, create if not
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId })
    let sheetId = null
    const targetSheet = sheetMeta.data.sheets.find(s => s.properties.title === 'DriveLimits')
    
    if (!targetSheet) {
      const addSheetRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'DriveLimits',
                gridProperties: { frozenRowCount: 1 }
              }
            }
          }]
        }
      })
      sheetId = addSheetRes.data.replies[0].addSheet.properties.sheetId

      // Add Headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'DriveLimits!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Timestamp', 'Email', 'FileIds', 'FileNames', 'Reason', 'ResolvedAt']]
        }
      })
    }

    // Process new limits (append)
    for (const limit of newLimits) {
      const fileIds = limit.files.map(f => f.id).join(', ')
      const fileNames = limit.files.map(f => f.name).join(', ')
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'DriveLimits!A:F',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            new Date().toISOString(),
            limit.email,
            fileIds,
            fileNames,
            limit.reason,
            '' // ResolvedAt initially empty
          ]]
        }
      })
    }

    // Process resolved limits (update)
    // Finding the specific row to update is complex in a serverless function without full sheet reading.
    // For simplicity, we just append a "RESOLVED" log row.
    for (const resolved of resolvedLimits) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'DriveLimits!A:F',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            new Date().toISOString(),
            resolved.email,
            'ALL',
            'ALL',
            'RESOLVED',
            new Date().toISOString()
          ]]
        }
      })
    }

  } catch (error) {
    console.error('Error syncing limit sheet:', error.message)
  }
}
