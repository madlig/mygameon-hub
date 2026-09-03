const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

function getEnvValue(key) {
  if (process.env[key]) return process.env[key]
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config')
  const possiblePaths = [
    path.join(appData, 'MyGameON Studio', '.env.local'),
    path.join(process.resourcesPath || '', '.env.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(__dirname, '..', '.env.local')
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const envData = fs.readFileSync(p, 'utf8')
        for (const line of envData.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/)
          if (match && match[1].trim() === key) {
            let val = match[2] ? match[2].trim() : ''
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1)
            }
            return val
          }
        }
      } catch (_) {}
    }
  }
  return ''
}

let MONGODB_URI = getEnvValue('MONGODB_URI')
let STUDIO_UPLOAD_DIR = getEnvValue('STUDIO_UPLOAD_DIR')

// Minimal Schemas
const desktopStateSchema = new mongoose.Schema({
  machineId: String,
  isOnline: Boolean,
  lastSeen: Date,
  folders: [{ name: String, path: String, hasArchive: Boolean, archiveParts: Number }],
  uploadPath: String,
  currentTask: {
    status: String,
    progress: Number,
    text: String,
    commandId: String
  }
}, { timestamps: true })

const remoteCommandSchema = new mongoose.Schema({
  machineId: String,
  type: String,
  payload: mongoose.Schema.Types.Mixed,
  status: String,
  result: mongoose.Schema.Types.Mixed,
  error: String,
  createdAt: { type: Date, default: Date.now, expires: 86400 }
})

let DesktopState, RemoteCommand
try {
  DesktopState = mongoose.model('DesktopState')
} catch (e) {
  DesktopState = mongoose.model('DesktopState', desktopStateSchema)
}

try {
  RemoteCommand = mongoose.model('RemoteCommand')
} catch (e) {
  RemoteCommand = mongoose.model('RemoteCommand', remoteCommandSchema)
}

const MACHINE_ID = 'mygameon-pc-1'
let heartbeatInterval = null
let changeStream = null
let currentCommandId = null

function resolveTargetPath() {
  const possiblePaths = [
    STUDIO_UPLOAD_DIR || process.env.STUDIO_UPLOAD_DIR,
    'D:\\Game\\Shopee\\GameUpload',
    'D:\\Game\\Shopee',
    'C:\\Game\\Shopee\\GameUpload',
    path.join(process.cwd(), 'GameUpload')
  ].filter(Boolean)

  const configPath = path.join(process.cwd(), 'studio-settings.json')
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      if (cfg.folderPath && fs.existsSync(cfg.folderPath)) return cfg.folderPath
    } catch (_) {}
  }

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }

  return possiblePaths[0] || 'D:\\Game\\Shopee\\GameUpload'
}

async function scanLocalFolders() {
  const targetPath = resolveTargetPath()
  const gameMap = new Map()
  
  if (fs.existsSync(targetPath)) {
    const items = fs.readdirSync(targetPath)
    // Pass 1: Raw folders
    for (const item of items) {
      if (item.startsWith('.') || item === '$RECYCLE.BIN' || item === 'System Volume Information' || item === 'node_modules') continue

      const fullPath = path.join(targetPath, item)
      try {
        const stats = fs.statSync(fullPath)
        if (stats.isDirectory()) {
          const parentParts = items.filter(f => f.startsWith(item) && (f.endsWith('.rar') || f.endsWith('.7z') || f.endsWith('.zip')))
          let insideParts = []
          try {
            insideParts = fs.readdirSync(fullPath).filter(f => f.endsWith('.rar') || f.endsWith('.7z') || f.endsWith('.zip'))
          } catch (_) {}
          const partsCount = parentParts.length > 0 ? parentParts.length : insideParts.length
          gameMap.set(item.toLowerCase(), { name: item, path: fullPath, hasArchive: partsCount > 0, archiveParts: partsCount })
        }
      } catch (_) {}
    }

    // Pass 2: Archives with smart merge
    for (const item of items) {
      if (item.startsWith('.') || item === '$RECYCLE.BIN' || item === 'System Volume Information' || item === 'node_modules') continue

      const fullPath = path.join(targetPath, item)
      try {
        const stats = fs.statSync(fullPath)
        if (stats.isFile() && (item.endsWith('.rar') || item.endsWith('.7z') || item.endsWith('.zip'))) {
          const isSecondaryPart = /\.part(0*[2-9]|[1-9][0-9]+)\.rar$/i.test(item)
          if (!isSecondaryPart) {
            const baseName = item.replace(/\.part0*1\.rar$/i, '').replace(/\.(rar|7z|zip)$/i, '')
            const key = baseName.toLowerCase()
            const siblingParts = items.filter(f => f.startsWith(baseName) && (f.endsWith('.rar') || f.endsWith('.7z') || f.endsWith('.zip')))
            const partsCount = Math.max(1, siblingParts.length)

            if (gameMap.has(key)) {
              const existing = gameMap.get(key)
              existing.hasArchive = true
              existing.archiveParts = partsCount
            } else {
              gameMap.set(key, { name: baseName, path: fullPath, isArchiveFile: true, hasArchive: true, archiveParts: partsCount })
            }
          }
        }
      } catch (_) {}
    }
  }
  return { folders: Array.from(gameMap.values()), targetPath }
}

function getJobState() {
  const stateFile = path.join(process.cwd(), 'studio-state.json')
  if (fs.existsSync(stateFile)) {
    try { return JSON.parse(fs.readFileSync(stateFile, 'utf-8')) } catch(e){}
  }
  return { status: 'idle', progress: 0, text: '' }
}

async function sendHeartbeat() {
  try {
    const { folders, targetPath } = await scanLocalFolders()
    const jobState = getJobState()
    
    await DesktopState.findOneAndUpdate(
      { machineId: MACHINE_ID },
      { 
        $set: { 
          isOnline: true, 
          lastSeen: new Date(),
          folders,
          uploadPath: targetPath,
          currentTask: {
            status: jobState.status,
            progress: jobState.progress,
            text: jobState.text,
            commandId: currentCommandId
          }
        } 
      },
      { upsert: true }
    )
  } catch (err) {
    console.error('C2 Heartbeat Error:', err.message)
  }
}

async function startC2Client() {
  if (!MONGODB_URI) {
    console.log('No MONGODB_URI found, C2 Client will not start.')
    return
  }

  try {
    console.log('Connecting to MongoDB for C2 Client...')
    await mongoose.connect(MONGODB_URI)
    console.log('C2 Client Connected to DB.')

    // 1. Start Heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    heartbeatInterval = setInterval(sendHeartbeat, 5000)
    await sendHeartbeat()

    // 2. Start Change Stream
    if (changeStream) changeStream.close()
    
    // Catch any pending commands that were missed while offline
    setInterval(async () => {
      if (currentCommandId) return; // Don't interrupt if busy
      try {
        const missedCmd = await RemoteCommand.findOneAndUpdate(
          { machineId: MACHINE_ID, status: 'pending' },
          { status: 'processing' },
          { sort: { createdAt: 1 } }
        )
        if (missedCmd) {
          console.log('Caught missed pending command:', missedCmd.type)
          processCommand(missedCmd)
        }
      } catch (e) {}
    }, 5000)
    
    changeStream = RemoteCommand.watch([{ $match: { operationType: 'insert' } }])
    
    changeStream.on('change', async (change) => {
      const doc = change.fullDocument
      if (doc.machineId === MACHINE_ID && doc.status === 'pending') {
        console.log('Received new remote command:', doc.type)
        
        if (currentCommandId) return; // Busy
        
        // Mark as processing
        const updated = await RemoteCommand.findOneAndUpdate(
          { _id: doc._id, status: 'pending' }, 
          { status: 'processing' }
        )
        
        if (updated) {
          processCommand(doc)
        }
      }
    })
    
    // Abstract the processing logic into a function
    async function processCommand(doc) {
      if (currentCommandId) return; // Prevent concurrent processing
      currentCommandId = doc._id.toString()
      
      try {
        if (doc.type === 'START_ARCHIVE' || doc.type === 'START_UPLOAD') {
          // Dynamic import to use ESM module in CommonJS electron main
          const studioProcessor = await import('./studioProcessor.js')
          
          try {
            if (doc.type === 'START_ARCHIVE') {
              await studioProcessor.archiveJob(
                doc.payload.targetFolder,
                doc.payload.rarConfig
              )
            } else if (doc.type === 'START_UPLOAD') {
              await studioProcessor.uploadJob(
                doc.payload.targetFolder,
                doc.payload.workspace,
                doc.payload.rarConfig,
                doc.payload.options || {}
              )
            }
            
            await RemoteCommand.findByIdAndUpdate(doc._id, { status: 'completed', result: { message: 'Done' } })
          } catch (err) {
            console.error('RemoteCommand Execution Error:', err)
            await RemoteCommand.findByIdAndUpdate(doc._id, { status: 'failed', error: err.message })
            // Ensure UI doesn't get stuck if it crashes
            const fs = require('fs')
            const path = require('path')
            fs.writeFileSync(path.join(process.cwd(), 'studio-state.json'), JSON.stringify({
              status: 'error',
              progress: 0,
              text: 'Sistem error: ' + err.message,
              logs: []
            }))
          } finally {
            currentCommandId = null
          }
        } else if (doc.type === 'SCRAPE') {
          const { BrowserWindow } = require('electron')
          const win = new BrowserWindow({ width: 1000, height: 800, show: false })
          
          try {
            // Load URL but don't await indefinitely, use a timeout promise race
            const loadPromise = win.loadURL(doc.payload.url)
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Load timeout')), 25000))
            
            await Promise.race([loadPromise, timeoutPromise])
            
            // Wait extra 10 seconds to bypass Cloudflare
            await new Promise(r => setTimeout(r, 10000))
            
            const scrapeData = await win.webContents.executeJavaScript(`
              (() => {
                let title = document.querySelector('h1.entry-title')?.innerText || document.querySelector('h1')?.innerText || document.title;
                
                // Get the main content area
                const contentArea = document.querySelector('.entry-content, .post-content, article, main, .page-content') || document.body;
                
                // Extract text for Gemini to analyze (Synopsis + System Requirements)
                // Remove excessive newlines and limit to 3000 characters to save token bandwidth
                let rawText = contentArea.innerText || '';
                rawText = rawText.replace(/\\n+/g, '\\n').substring(0, 3000);
                
                // Specifically avoid related posts (.yarpp) which contain other game thumbnails
                const imgTags = contentArea.querySelectorAll('img');
                const images = [];
                
                for (let img of imgTags) {
                  // Skip if it's inside a related posts section
                  if (img.closest('.yarpp-related, .related-posts, .rpwe-block, #related-posts')) continue;
                  
                  // Get real source (handles lazy loading plugins)
                  let src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.src;
                  
                  if (src && src.startsWith('http')) {
                    const srcLower = src.toLowerCase();
                    // Filter out ads, logos, icons, and UI elements
                    if (!srcLower.includes('logo') && !srcLower.includes('banner') && 
                        !srcLower.includes('avatar') && !srcLower.includes('icon') &&
                        !srcLower.includes('rating') && !srcLower.includes('button')) {
                        
                        // Ensure it's likely a screenshot/cover
                        if (srcLower.includes('.jpg') || srcLower.includes('.jpeg') || srcLower.includes('.png') || srcLower.includes('.webp')) {
                          images.push(src);
                        }
                    }
                  }
                }
                
                // Remove duplicates
                const uniqueImages = [...new Set(images)];
                
                // Extract System Requirements (Robustly)
                let sysReq = '';
                // Strategy 1: Find DOM element (like a tab-pane) containing "Minimum:" and "OS:"
                const allElements = document.querySelectorAll('div, p');
                for (const el of allElements) {
                  const txt = el.innerText || '';
                  if (txt.includes('Minimum:') && txt.includes('OS:') && txt.length < 1500) {
                    sysReq = txt.trim();
                    break;
                  }
                }
                
                // Strategy 2: Fallback to broader Regex on rawText if DOM search fails
                if (!sysReq) {
                  const sysReqMatch = rawText.match(/(?:System Requirements|Minimum:)[\\s\\S]{30,800}?(?=LINK DOWNLOAD|INSTALL NOTE|File Size|Note:|$)/i);
                  sysReq = sysReqMatch ? sysReqMatch[0].trim() : '';
                }
                
                return { 
                  title, 
                  fullText: rawText, 
                  sysReq,
                  // Cover is the first image, screenshots are the next 4 (since Ovagames usually has exactly 4)
                  images: uniqueImages.slice(1, 5), 
                  coverImage: uniqueImages[0] || null 
                };
              })()
            `)
            
            await RemoteCommand.findByIdAndUpdate(doc._id, { 
              status: 'completed',
              result: scrapeData
            })
          } catch(e) {
            console.error('Scrape Error:', e)
            await RemoteCommand.findByIdAndUpdate(doc._id, { 
              status: 'failed',
              error: e.message || 'Unknown scrape error'
            })
          } finally {
            if (!win.isDestroyed()) win.destroy()
            currentCommandId = null
          }
        } else if (doc.type === 'PHOTOSHOP_EXPORT') {
          const fs = require('fs')
          const path = require('path')
          const { exec } = require('child_process')
          const https = require('https')
          const http = require('http')

          try {
            const { title, coverImage, images } = doc.payload
            
            // Remove common repacker/release tags
            let cleanedTitle = title.replace(/(multi\d+)?-?(elamigos|dodi|fitgirl|gog|tenoke|rune|skidrow|codex|emp|plaza|razor1911|reloaded|flt)/gi, '')
            
            // Clean title for folder name (remove illegal characters, remove spaces, lowercase)
            // This matches the user's manual convention (e.g. crimsondesert)
            const safeTitle = cleanedTitle.replace(/[<>:"/\\|?*\s]+/g, '').toLowerCase().trim()
            const targetDir = path.join('D:', 'Shopee', safeTitle)
            
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true })
            }

            const downloadImage = (url, filepath, redirectCount = 0) => {
              return new Promise((resolve, reject) => {
                if (redirectCount > 5) {
                  return reject(new Error('Too many redirects while downloading image'))
                }
                const client = url.startsWith('https') ? https : http
                const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
                  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let redirectUrl = res.headers.location
                    if (redirectUrl.startsWith('/')) {
                      const parsed = new URL(url)
                      redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`
                    }
                    return resolve(downloadImage(redirectUrl, filepath, redirectCount + 1))
                  }
                  if (res.statusCode === 200) {
                    const fileStream = fs.createWriteStream(filepath)
                    res.pipe(fileStream)
                    fileStream.on('finish', () => {
                      fileStream.close()
                      resolve()
                    })
                  } else {
                    reject(new Error(`Failed to download, status: ${res.statusCode}`))
                  }
                })
                req.on('error', reject)
              })
            }

            console.log('Downloading images for', safeTitle)
            
            // Download cover and duplicate as bg
            await downloadImage(coverImage, path.join(targetDir, 'cov.jpg'))
            await downloadImage(coverImage, path.join(targetDir, 'bg.jpg'))
            
            // Download screenshots (both 1.jpg and ss1.jpg for maximum compatibility)
            for (let i = 0; i < Math.min(images.length, 4); i++) {
              const numFile = path.join(targetDir, `${i + 1}.jpg`)
              const ssFile = path.join(targetDir, `ss${i + 1}.jpg`)
              await downloadImage(images[i], numFile)
              try { fs.copyFileSync(numFile, ssFile) } catch (_) {}
            }
            
            console.log('Images downloaded. Preparing Photoshop automation...')

            // Create dynamic runner.jsx
            const jsxScriptPath = path.join('C:', 'Users', 'madli', 'OneDrive', 'Documents', 'New project', 'generate.jsx')
            const runnerPath = path.join('C:', 'Users', 'madli', 'OneDrive', 'Documents', 'New project', 'runner.jsx')
            
            const runnerContent = `
var AUTO_TARGET_GAME = ${JSON.stringify(safeTitle)};
//@include "${jsxScriptPath.replace(/\\/g, '/')}"
`
            fs.writeFileSync(runnerPath, runnerContent, 'utf8')

            console.log('Launching Photoshop via COM Automation...')
            const os = require('os')
            const vbsPath = path.join(os.tmpdir(), `ps_export_${Date.now()}.vbs`)
            const vbsContent = `
On Error Resume Next
Dim app
Set app = CreateObject("Photoshop.Application")
If Err.Number <> 0 Then
  Err.Clear
  Set app = GetObject(, "Photoshop.Application")
End If
If Err.Number = 0 Then
  app.DoJavaScript "$.evalFile('${runnerPath.replace(/\\/g, '/')}')"
End If
`
            fs.writeFileSync(vbsPath, vbsContent, 'utf8')

            // Execute VBScript asynchronously
            exec(`cscript //nologo "${vbsPath}"`, (error) => {
              if (error) console.error('Photoshop COM execution warning:', error.message)
              try { fs.unlinkSync(vbsPath) } catch (_) {}
            })

            // Tunggu render selesai dengan polling output file hingga 45 detik
            const thumbnailOutputDir = path.join('D:', 'Shopee', '1-thumbnail', safeTitle)
            let previewImg = ''
            const possibleFiles = ['cover.jpg', 'cover.png', '1.jpg', 'preview.jpg', 'preview.png']

            for (let attempt = 0; attempt < 15; attempt++) {
              await new Promise((resolve) => setTimeout(resolve, 3000))
              for (const f of possibleFiles) {
                const checkPath1 = path.join(thumbnailOutputDir, f)
                const checkPath2 = path.join(targetDir, f)
                if (fs.existsSync(checkPath1)) {
                  previewImg = checkPath1
                  break
                } else if (fs.existsSync(checkPath2)) {
                  previewImg = checkPath2
                  break
                }
              }
              if (previewImg) break
            }

            // Clean up temporary runner JSX only AFTER render completes or times out
            try {
              if (fs.existsSync(runnerPath)) {
                fs.unlinkSync(runnerPath)
              }
            } catch (_) {}

            await RemoteCommand.findByIdAndUpdate(doc._id, { 
              status: 'completed',
              result: { message: 'Images downloaded and Photoshop finished.', preview: previewImg }
            })

          } catch(e) {
            console.error('Photoshop Export Error:', e)
            await RemoteCommand.findByIdAndUpdate(doc._id, { 
              status: 'failed',
              error: e.message || 'Unknown export error'
            })
          }
        }
      } catch (err) {
        console.error('Outer Catch in processCommand:', err)
        try {
          await RemoteCommand.findByIdAndUpdate(doc._id, { status: 'failed', error: err.message })
          const fs = require('fs')
          const path = require('path')
          fs.writeFileSync(path.join(process.cwd(), 'studio-state.json'), JSON.stringify({
            status: 'error',
            progress: 0,
            text: 'Sistem error: ' + err.message,
            logs: []
          }))
        } catch (e2) {}
      } finally {
        currentCommandId = null
      }
    }

    changeStream.on('error', (error) => {
      console.error('Change Stream Error:', error)
    })

  } catch (err) {
    console.error('Failed to start C2 Client:', err)
  }
}

function stopC2Client() {
  if (heartbeatInterval) clearInterval(heartbeatInterval)
  if (changeStream) changeStream.close()
  mongoose.disconnect()
}

module.exports = { startC2Client, stopC2Client }
