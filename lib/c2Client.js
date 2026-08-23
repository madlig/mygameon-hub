const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

// Read the env file since this runs in Electron main process
let envPath = path.join(__dirname, '..', '.env.local')
if (!fs.existsSync(envPath)) {
  envPath = path.join(process.cwd(), '.env.local') 
}

let MONGODB_URI = ''
let STUDIO_UPLOAD_DIR = ''

if (fs.existsSync(envPath)) {
  const envData = fs.readFileSync(envPath, 'utf8')
  const lines = envData.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2] ? match[2].trim() : ''
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
      
      if (key === 'MONGODB_URI') MONGODB_URI = value
      if (key === 'STUDIO_UPLOAD_DIR') STUDIO_UPLOAD_DIR = value
    }
  }
}

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

async function scanLocalFolders() {
  const folders = []
  // In a real scenario, this reads from settings.json (rarConfig.folderPath)
  // We'll mock the default D:\Shopee or similar for now
  const configPath = path.join(process.cwd(), 'studio-settings.json')
  let targetPath = STUDIO_UPLOAD_DIR || process.env.STUDIO_UPLOAD_DIR || 'D:\\Game\\Shopee\\GameUpload'
  
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      if (cfg.folderPath) targetPath = cfg.folderPath
    } catch(e){}
  }

  if (fs.existsSync(targetPath)) {
    const items = fs.readdirSync(targetPath)
    for (const item of items) {
      const fullPath = path.join(targetPath, item)
      if (fs.statSync(fullPath).isDirectory()) {
        // Check if there are .rar parts for this folder
        const allFiles = fs.readdirSync(targetPath)
        const parts = allFiles.filter(f => f.startsWith(item) && f.endsWith('.rar'))
        const hasArchive = parts.length > 0
        folders.push({ name: item, path: fullPath, hasArchive, archiveParts: parts.length })
      }
    }
  }
  return { folders, targetPath }
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
                doc.payload.rarConfig
              )
            }
            
            await RemoteCommand.findByIdAndUpdate(doc._id, { status: 'success', result: { message: 'Done' } })
          } catch (err) {
            console.error('RemoteCommand Execution Error:', err)
            await RemoteCommand.findByIdAndUpdate(doc._id, { status: 'error', error: err.message })
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

            const downloadImage = (url, filepath) => {
              return new Promise((resolve, reject) => {
                const client = url.startsWith('https') ? https : http
                const req = client.get(url, (res) => {
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
            
            // Download screenshots (max 4 as expected by generate.jsx)
            for (let i = 0; i < Math.min(images.length, 4); i++) {
              await downloadImage(images[i], path.join(targetDir, `${i + 1}.jpg`))
            }
            
            console.log('Images downloaded. Preparing Photoshop automation...')

            // Create dynamic runner.jsx
            const jsxScriptPath = path.join('C:', 'Users', 'madli', 'OneDrive', 'Documents', 'New project', 'generate.jsx')
            const runnerPath = path.join('C:', 'Users', 'madli', 'OneDrive', 'Documents', 'New project', 'runner.jsx')
            
            const runnerContent = `
var AUTO_TARGET_GAME = "${safeTitle}";
//@include "${jsxScriptPath.replace(/\\/g, '/')}"
`
            fs.writeFileSync(runnerPath, runnerContent, 'utf8')

            // Execute Photoshop
            const psPath = '"C:\\\\Program Files\\\\Adobe\\\\Adobe Photoshop 2021\\\\Photoshop.exe"'
            console.log('Starting Photoshop...')
            
            await new Promise((resolve, reject) => {
              exec(`${psPath} "${runnerPath}"`, (error, stdout, stderr) => {
                // Photoshop usually doesn't return cleanly in the terminal or might just detach.
                // We resolve anyway, but log errors.
                if (error && !error.message.includes('Command failed')) {
                   // Ignore general detached errors
                   console.log('Photoshop launched.')
                }
                resolve()
              })
            })

            await RemoteCommand.findByIdAndUpdate(doc._id, { 
              status: 'completed',
              result: { message: 'Images downloaded and Photoshop started.' }
            })

          } catch(e) {
            console.error('Photoshop Export Error:', e)
            await RemoteCommand.findByIdAndUpdate(doc._id, { 
              status: 'failed',
              error: e.message || 'Unknown export error'
            })
          } finally {
            currentCommandId = null
          }
        }
      } catch (err) {
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
