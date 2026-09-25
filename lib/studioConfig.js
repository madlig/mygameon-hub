import fs from 'fs'
import path from 'path'

const CONFIG_FILE = path.join(process.cwd(), 'studio-config.json')

export function getStagingConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
      return data || {}
    } catch (_) {}
  }
  return {}
}

export function saveStagingConfig(config) {
  try {
    const current = getStagingConfig()
    const updated = { ...current, ...config }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8')
    return updated
  } catch (err) {
    console.error('Failed to save studio-config.json:', err)
    return null
  }
}

export function resolveUploadDirectory(customPath = null) {
  if (customPath && typeof customPath === 'string' && fs.existsSync(customPath)) {
    return customPath
  }

  const config = getStagingConfig()
  if (config.stagingPath && fs.existsSync(config.stagingPath)) {
    return config.stagingPath
  }

  const possiblePaths = [
    process.env.STUDIO_UPLOAD_DIR,
    'D:\\Game\\Shopee\\GameUpload',
    'D:\\Game\\Shopee',
    'C:\\Game\\Shopee\\GameUpload',
  ].filter(Boolean)

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p
    }
  }

  return possiblePaths[0] || 'D:\\Game\\Shopee\\GameUpload'
}

const QUEUE_FILE = path.join(process.cwd(), 'studio-queue.json')

export function getStudioQueue() {
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'))
      return Array.isArray(data) ? data : []
    } catch (_) {}
  }
  return []
}

export function saveStudioQueue(items) {
  try {
    const list = Array.isArray(items) ? items : []
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(list, null, 2), 'utf-8')
    return list
  } catch (err) {
    console.error('Failed to save studio-queue.json:', err)
    return []
  }
}

