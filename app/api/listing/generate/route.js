import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const DEFAULT_OUTPUT_BASE = 'D:\\Shopee\\3-listing_output'

async function downloadFile(url, destPath) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  })
  if (!res.ok) {
    throw new Error(`Gagal mendownload gambar dari ${url} (HTTP ${res.status})`)
  }
  const arrayBuffer = await res.arrayBuffer()
  await fs.promises.writeFile(destPath, Buffer.from(arrayBuffer))
}

export async function POST(request) {
  let tempDir = null
  try {
    const body = await request.json()
    const { 
      title, 
      coverUrl, 
      screenshots = [], 
      seoTitle, 
      description,
      customOutputDir 
    } = body

    if (!title) {
      return NextResponse.json({ success: false, error: 'Judul game wajib diisi' }, { status: 400 })
    }
    if (!coverUrl) {
      return NextResponse.json({ success: false, error: 'URL Cover wajib diisi' }, { status: 400 })
    }

    // 1. Setup temporary workspace
    const tempId = `mygameon_listing_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    tempDir = path.join(os.tmpdir(), tempId)
    fs.mkdirSync(tempDir, { recursive: true })

    // 2. Download cover
    const coverPath = path.join(tempDir, 'cover.jpg')
    await downloadFile(coverUrl, coverPath)

    // 3. Download up to 4 screenshots
    const screenshotPaths = []
    for (let i = 0; i < screenshots.length && i < 4; i++) {
      const shotUrl = screenshots[i]
      const shotPath = path.join(tempDir, `shot_${i + 1}.jpg`)
      try {
        await downloadFile(shotUrl, shotPath)
        screenshotPaths.push(shotPath)
      } catch (err) {
        console.warn(`Gagal mendownload screenshot ke-${i + 1}:`, err.message)
      }
    }

    // If no screenshots downloaded, fallback to duplicating cover or using placeholder
    if (screenshotPaths.length === 0) {
      screenshotPaths.push(coverPath)
    }

    // 4. Determine destination directory
    const cleanTitle = title.toUpperCase().trim()
    const safeFolderName = cleanTitle.replace(/[^A-Z0-9 _-]/g, '_').trim()
    
    let baseOutputDir = customOutputDir || 'D:\\Shopee\\3-listing_output'
    if (!fs.existsSync(baseOutputDir)) {
      try {
        fs.mkdirSync(baseOutputDir, { recursive: true })
      } catch (e) {
        // Fallback to local project directory if D: drive is unavailable
        baseOutputDir = path.join(process.cwd(), 'listing_output')
        fs.mkdirSync(baseOutputDir, { recursive: true })
      }
    }

    const targetDir = path.join(baseOutputDir, safeFolderName)
    fs.mkdirSync(targetDir, { recursive: true })

    // 5. Create config file for python renderer
    const configPath = path.join(tempDir, 'render_config.json')
    const configData = {
      cleanTitle,
      posterPath: coverPath,
      screenshotPaths,
      targetDir,
      seoTitle: seoTitle || cleanTitle,
      description: description || ''
    }
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf-8')

    // 6. Execute Python rendering script
    const scriptPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'scripts', 'render_listing.py')
    const { stdout, stderr } = await execFileAsync('python', [scriptPath, configPath])

    let renderResult = null
    try {
      renderResult = JSON.parse(stdout.trim())
    } catch (e) {
      console.error('Python stdout parse error:', stdout, 'stderr:', stderr)
      throw new Error(`Gagal memproses render gambar: ${stderr || stdout}`)
    }

    if (!renderResult.success) {
      throw new Error(renderResult.error || 'Gagal menghasilkan slide listing')
    }

    // 7. Read slides as base64 for instant live preview in frontend
    const slideDefinitions = [
      { id: 1, title: 'Slide 1: Cover Utama', fileName: 'SLIDE_1_THUMBNAIL.jpg' },
      { id: 2, title: 'Slide 2: Kolase Gameplay 4-in-1', fileName: 'SLIDE_2_GAMEPLAY_4IN1.jpg' },
      { id: 3, title: 'Slide 3: Alur Order', fileName: 'SLIDE_3_ALUR_ORDER.jpg' },
      { id: 4, title: 'Slide 4: Panduan Download', fileName: 'SLIDE_4_PANDUAN_DOWNLOAD_EKSTRAK.jpg' },
      { id: 5, title: 'Slide 5: Garansi Toko', fileName: 'SLIDE_5_GARANSI_ADMIN.jpg' },
      { id: 6, title: 'Slide 6: Promo Bundling', fileName: 'SLIDE_6_PROMO_BUNDLING.jpg' }
    ]

    const slides = []
    for (const def of slideDefinitions) {
      const filePath = path.join(targetDir, def.fileName)
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath)
        const base64 = fileBuffer.toString('base64')
        slides.push({
          id: def.id,
          title: def.title,
          fileName: def.fileName,
          filePath,
          dataUrl: `data:image/jpeg;base64,${base64}`
        })
      }
    }

    return NextResponse.json({
      success: true,
      targetDir,
      safeFolderName,
      slides,
      seoTitle: configData.seoTitle,
      description: configData.description
    })
  } catch (error) {
    console.error('API /api/listing/generate Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  } finally {
    // Clean up temporary download dir
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (e) {
        console.warn('Gagal menghapus temp directory:', e.message)
      }
    }
  }
}
