import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawn } from 'child_process'

const UNRAR_PATHS = [
  'C:\\Program Files\\WinRAR\\UnRAR.exe',
  'C:\\Program Files (x86)\\WinRAR\\UnRAR.exe',
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WinRAR', 'UnRAR.exe'),
  'UnRAR.exe'
]

const WINRAR_PATHS = [
  'C:\\Program Files\\WinRAR\\WinRAR.exe',
  'C:\\Program Files (x86)\\WinRAR\\WinRAR.exe',
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WinRAR', 'WinRAR.exe'),
  'WinRAR.exe'
]

const SEVEN_ZIP_PATHS = [
  path.join(process.cwd(), 'bin', '7z.exe'),
  path.join(process.cwd(), 'bin', '7z-x64.exe'),
  path.join(process.cwd(), 'node_modules', 'electron-winstaller', 'vendor', '7z.exe'),
  'C:\\Program Files\\7-Zip\\7z.exe',
  'C:\\Program Files (x86)\\7-Zip\\7z.exe',
  '7z.exe'
]

// Singleton tracker untuk ekstraksi aktif di memory
if (!globalThis.__mygameonActiveExtractions) {
  globalThis.__mygameonActiveExtractions = new Map() // id -> extraction object
}

const activeExtractions = globalThis.__mygameonActiveExtractions

export function find7zExecutable() {
  for (const p of SEVEN_ZIP_PATHS) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return null
}

export function findUnrarExecutable() {
  for (const p of UNRAR_PATHS) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return null
}

export function findWinRarExecutable() {
  for (const p of WINRAR_PATHS) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return null
}

export function checkExtractorAvailable() {
  return !!(find7zExecutable() || findUnrarExecutable())
}

/**
 * Memilih extractor terbaik berdasarkan format file arsip:
 * - .7z / .zip / .iso / .tar: Wajib 7z.exe (UnRAR tidak mendukung format ini)
 * - .rar / multi-part .rar: Utamakan 7z.exe (bundled di bin/, headless tanpa popup) atau UnRAR.exe
 */
export function findBestExtractorExecutable(archivePath = '') {
  const z7 = find7zExecutable()
  const unrar = findUnrarExecutable()
  const lower = (archivePath || '').toLowerCase()

  if (/\.(7z|zip|iso|tar|gz|001)$/i.test(lower)) {
    if (z7) return { type: '7z', executable: z7 }
    throw new Error('Arsip .7z / .zip membutuhkan 7-Zip (bin/7z.exe), namun belum tersedia.')
  }

  // Untuk RAR: 7z.exe mendukung RAR4 & RAR5, atau UnRAR.exe
  if (z7) return { type: '7z', executable: z7 }
  if (unrar) return { type: 'unrar', executable: unrar }

  return null
}

export function getActiveExtractions() {
  const list = []
  for (const [, item] of activeExtractions) {
    const { process: _proc, ...safeItem } = item
    list.push(safeItem)
  }
  return list
}

function formatBytesLocal(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatEtaLocal(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return null
  if (seconds < 60) return `~${Math.round(seconds)} dtk`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return `~${m}m ${s}d`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `~${h}j ${rm}m`
}

function isArchiveFileName(name) {
  return /\.(part\d+\.rar|r\d+|rar|7z|zip|\d{3})$/i.test(name)
}

/**
 * Hitung ukuran total arsip dan ukuran berkas hasil ekstrak di folder tujuan
 * Mendukung input folder part RAR maupun berkas tunggal (.7z / .rar langsung)
 */
function measureExtractionDiskProgress(sourcePath, destDir) {
  let archiveBytes = 0
  let extractedBytes = 0
  let latestExtractedFile = null
  let latestMtime = 0

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { archiveBytes: 0, extractedBytes: 0, latestExtractedFile: null }
  }

  try {
    const srcStat = fs.statSync(sourcePath)
    if (srcStat.isFile()) {
      archiveBytes = srcStat.size
    } else {
      const entries = fs.readdirSync(sourcePath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && isArchiveFileName(entry.name)) {
          try {
            archiveBytes += fs.statSync(path.join(sourcePath, entry.name)).size
          } catch (_) {}
        }
      }
    }
  } catch (_) {}

  // Hitung berkas yang sudah berhasil ditulis ke destDir
  if (destDir && fs.existsSync(destDir)) {
    function scanDest(dirPath, depth = 0) {
      if (depth > 3) return
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        for (const entry of entries) {
          const full = path.join(dirPath, entry.name)
          try {
            if (entry.isDirectory()) {
              scanDest(full, depth + 1)
            } else if (entry.isFile()) {
              // Jika destDir sama dengan sourcePath, jangan hitung berkas arsip mentah sebagai hasil ekstrak
              if (sourcePath === destDir && isArchiveFileName(entry.name)) {
                continue
              }
              const st = fs.statSync(full)
              extractedBytes += st.size
              if (st.mtimeMs >= latestMtime) {
                latestMtime = st.mtimeMs
                latestExtractedFile = entry.name
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    scanDest(destDir, 0)
  }

  return { archiveBytes, extractedBytes, latestExtractedFile }
}

/**
 * Bersihkan subfolder kosong (0 berkas) yang mungkin terbuat saat percobaan password gagal
 */
function removeEmptySubfolders(folderPath) {
  if (!fs.existsSync(folderPath)) return
  try {
    const stat = fs.statSync(folderPath)
    if (!stat.isDirectory()) return

    const entries = fs.readdirSync(folderPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subFull = path.join(folderPath, entry.name)
        try {
          const subItems = fs.readdirSync(subFull)
          if (subItems.length === 0) {
            fs.rmdirSync(subFull)
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
}

/**
 * Mencari file volume pertama dalam folder atau berkas arsip langsung
 */
export function findPrimaryArchiveFile(folderOrFilePath) {
  if (!fs.existsSync(folderOrFilePath)) return null

  try {
    const stat = fs.statSync(folderOrFilePath)
    if (stat.isFile()) {
      const lower = folderOrFilePath.toLowerCase()
      if (/\.(rar|zip|7z|iso|exe)$/i.test(lower)) {
        return folderOrFilePath
      }
      return null
    }

    const files = fs.readdirSync(folderOrFilePath)

    // 1. Pola part1: .part01.rar, .part001.rar, .part1.rar
    const part1File = files.find((f) => /\.part0*1\.rar$/i.test(f))
    if (part1File) return path.join(folderOrFilePath, part1File)

    // 2. Pola 7z split: .7z.001 atau .zip.001
    const split7z = files.find((f) => /\.(7z|zip)\.001$/i.test(f))
    if (split7z) return path.join(folderOrFilePath, split7z)

    // 3. Pola single .rar atau legacy .rar (dengan .r00, .r01)
    const singleRar = files.find((f) => /\.rar$/i.test(f) && !/\.part\d+\.rar$/i.test(f))
    if (singleRar) return path.join(folderOrFilePath, singleRar)

    // 4. Pola single .zip atau .7z
    const singleArchive = files.find((f) => /\.(7z|zip)$/i.test(f))
    if (singleArchive) return path.join(folderOrFilePath, singleArchive)

    return null
  } catch (err) {
    console.error('[Extractor] Gagal membaca arsip:', err.message)
    return null
  }
}

/**
 * Diagnosa detail alasan kegagalan ekstraksi dari output stdout/stderr dan exit code
 */
export function parseExtractionError(outputBuffer = '', code = -1) {
  const outLower = (outputBuffer || '').toLowerCase()

  const isPassword =
    outLower.includes('wrong password') ||
    outLower.includes('incorrect password') ||
    outLower.includes('encrypted file') ||
    outLower.includes('can not open encrypted archive') ||
    outLower.includes('headers error') ||
    code === 11 ||
    (code === 2 && (outLower.includes('encrypted') || outLower.includes('password') || outLower.includes('headers error')))

  if (isPassword) {
    return {
      type: 'password',
      message: 'Password arsip salah atau arsip terenkripsi. Silakan klik "Ubah Password & Coba Lagi" untuk memasukkan password yang benar (misal: cs.rin.ru, steamrip.com, atau www.ovagames.com).'
    }
  }

  const isDiskFull =
    outLower.includes('not enough space') ||
    outLower.includes('disk full') ||
    outLower.includes('no space left') ||
    outLower.includes('write error')

  if (isDiskFull) {
    return {
      type: 'disk_full',
      message: 'Ruang penyimpanan harddisk tidak mencukupi untuk mengekstrak game ini. Harap sediakan ruang disk kosong yang lebih besar.'
    }
  }

  const isMissingPartOrCorrupt =
    outLower.includes('cannot find volume') ||
    outLower.includes('can not find split archive') ||
    outLower.includes('missing volume') ||
    outLower.includes('unexpected end of archive') ||
    outLower.includes('file is corrupt') ||
    outLower.includes('no files to extract')

  if (isMissingPartOrCorrupt) {
    return {
      type: 'corrupted_or_missing',
      message: 'Part arsip tidak lengkap atau berkas rusak. Pastikan semua file part (part1, part2, dst.) telah selesai diunduh dalam folder yang sama.'
    }
  }

  const isAccessDenied =
    outLower.includes('access is denied') ||
    outLower.includes('permission denied')

  if (isAccessDenied) {
    return {
      type: 'access_denied',
      message: 'Akses berkas ditolak atau sedang digunakan oleh proses lain di Windows. Tutup aplikasi yang memakai berkas ini lalu coba lagi.'
    }
  }

  const snippet = (outputBuffer || '').slice(-250).trim()
  return {
    type: 'unknown',
    message: snippet ? `Ekstraksi gagal (Kode ${code}): ${snippet}` : `Ekstraksi gagal dengan kode status ${code}.`
  }
}

/**
 * Meluncurkan WinRAR secara langsung (Foreground GUI Window) jika diminta eksplisit.
 */
export function launchWinRarGui({ targetPath, password = '' }) {
  const winrarExe = findWinRarExecutable()
  if (!winrarExe) {
    throw new Error('WinRAR.exe tidak ditemukan di PC. Pastikan WinRAR terpasang di C:\\Program Files\\WinRAR.')
  }

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Berkas atau folder arsip tidak ditemukan: ${targetPath}`)
  }

  const stat = fs.statSync(targetPath)
  let primaryArchive = null
  let destDir = null

  if (stat.isFile()) {
    primaryArchive = targetPath
    const cleanFolderName = path.basename(targetPath)
      .replace(/^[a-z0-9]+-/i, '')
      .replace(/\.(rar|zip|7z|iso|exe)$/i, '')
      .replace(/[-_.]+/g, ' ')
      .trim() || 'ExtractedGame'
    destDir = path.join(path.dirname(targetPath), cleanFolderName)
  } else {
    primaryArchive = findPrimaryArchiveFile(targetPath)
    if (!primaryArchive) {
      throw new Error(`Tidak ditemukan berkas arsip di dalam folder: ${targetPath}`)
    }
    destDir = targetPath
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  const args = ['x', '-o+']
  if (password && password.trim() && password.trim().toLowerCase() !== 'filecrypt.cc') {
    args.push(`-p${password.trim()}`)
  }

  args.push(primaryArchive)
  const formattedDest = destDir.endsWith('\\') ? destDir : `${destDir}\\`
  args.push(formattedDest)

  const child = spawn(winrarExe, args, {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()

  return {
    success: true,
    primaryArchive,
    destDir,
    pid: child.pid
  }
}

/**
 * Eksekusi satu kali percobaan ekstraksi (7z atau UnRAR) dengan password tertentu
 */
function runSingleExtractionAttempt({
  extractorInfo,
  primaryArchive,
  destDir,
  workingDir,
  candidatePassword,
  task,
  totalArchiveBytes,
  baselineExtractedBytes,
  sourcePath,
  onProgress
}) {
  const { type, executable } = extractorInfo
  const args = []

  if (type === '7z') {
    args.push('x', '-y', '-bsp1')
    if (candidatePassword && candidatePassword.trim()) {
      args.push(`-p${candidatePassword.trim()}`)
    } else {
      args.push('-p-')
    }
    // Switch -o pada 7-Zip TIDAK boleh memiliki spasi antara -o dan direktori tujuan
    args.push(`-o${path.resolve(destDir)}`)
    args.push(path.resolve(primaryArchive))
  } else {
    // UnRAR.exe native
    args.push('x', '-y', '-o+')
    if (candidatePassword && candidatePassword.trim()) {
      args.push(`-p${candidatePassword.trim()}`)
    } else {
      args.push('-p-')
    }
    args.push(primaryArchive)
    const norm = destDir.replace(/\\/g, '/').replace(/\/+$/, '') + '/'
    args.push(norm)
  }

  return new Promise((resolve) => {
    const child = spawn(executable, args, { cwd: workingDir, stdio: ['ignore', 'pipe', 'pipe'] })
    task.process = child

    let outputBuffer = ''
    let lastBytes = 0
    let lastTime = Date.now()
    let smoothedSpeed = 0

    // Disk-based real-time progress monitor (mengatasi pipe buffering saat ekstrak berkas besar)
    const monitorTimer = setInterval(() => {
      if (task.status !== 'extracting') return
      try {
        const now = Date.now()
        const { extractedBytes: rawExtracted, latestExtractedFile } = measureExtractionDiskProgress(sourcePath, destDir)
        const currentExtracted = Math.max(0, rawExtracted - baselineExtractedBytes)
        const dt = Math.max(0.5, (now - lastTime) / 1000)
        const dBytes = Math.max(0, currentExtracted - lastBytes)
        const instantSpeed = dBytes / dt

        smoothedSpeed = smoothedSpeed > 0 ? (smoothedSpeed * 0.65) + (instantSpeed * 0.35) : instantSpeed
        lastBytes = currentExtracted
        lastTime = now

        if (latestExtractedFile && (!task.currentFile || task.currentFile === 'Memulai ekstraksi...')) {
          task.currentFile = latestExtractedFile
        }

        if (totalArchiveBytes > 0 && currentExtracted > 0) {
          const diskPct = Math.min(99, Math.max(1, Math.round((currentExtracted / totalArchiveBytes) * 100)))
          if (diskPct > (task.progressPercent || 0)) {
            task.progressPercent = diskPct
          }
          const remaining = Math.max(0, totalArchiveBytes - currentExtracted)
          const etaSec = smoothedSpeed > 256 * 1024 ? Math.round(remaining / smoothedSpeed) : null

          task.extractedBytes = currentExtracted
          task.extractedBytesFormatted = formatBytesLocal(currentExtracted)
          task.totalBytes = totalArchiveBytes
          task.totalBytesFormatted = formatBytesLocal(totalArchiveBytes)
          task.speedBytesPerSec = Math.round(smoothedSpeed)
          task.speedFormatted = smoothedSpeed > 0 ? `${formatBytesLocal(smoothedSpeed)}/s` : null
          task.etaSeconds = etaSec
          task.etaFormatted = formatEtaLocal(etaSec)

          if (onProgress) onProgress(task)
        }
      } catch (_) {}
    }, 800)

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      outputBuffer += text

      const match = text.match(/(\d+)%/g)
      if (match && match.length > 0) {
        const lastPercentStr = match[match.length - 1].replace('%', '')
        const percent = parseInt(lastPercentStr, 10)
        if (!isNaN(percent) && percent >= 0 && percent <= 100 && percent >= (task.progressPercent || 0)) {
          task.progressPercent = percent
          if (onProgress) onProgress(task)
        }
      }

      const fileMatch = text.match(/(?:Extracting|Testing)\s+([^\r\n]+)/) || text.match(/\d+%\s+\d+\s+-\s+([^\r\n]+)/)
      if (fileMatch) {
        const cleanFile = fileMatch[1].replace(/\s+\d+%\s*$/, '').replace(/\s+OK\s*$/, '').trim()
        if (cleanFile) {
          task.currentFile = path.basename(cleanFile)
        }
      }
    })

    child.stderr.on('data', (chunk) => {
      outputBuffer += chunk.toString()
    })

    child.on('error', (err) => {
      clearInterval(monitorTimer)
      delete task.process
      resolve({ code: -1, outputBuffer: `${outputBuffer}\n${err.message}` })
    })

    child.on('close', (code) => {
      clearInterval(monitorTimer)
      delete task.process
      resolve({ code, outputBuffer })
    })
  })
}

/**
 * Eksekusi ekstraksi arsip (RAR, 7Z, ZIP, ISO) secara in-app di background
 * Mendukung auto-fallback multi-password cerdas (CS.RIN.RU, SteamRIP, OvaGames, MyGameON, dsb.)
 */
export async function extractMultiPartArchive({
  folderPath,
  packageName = '',
  password = 'mygameon',
  autoCleanRar = false,
  onProgress = null
}) {
  const primaryArchive = findPrimaryArchiveFile(folderPath)
  if (!primaryArchive) {
    throw new Error(`Tidak ditemukan berkas volume arsip (.part01.rar / .rar / .7z / .zip) di dalam: ${folderPath}`)
  }

  const extractorInfo = findBestExtractorExecutable(primaryArchive)
  if (!extractorInfo) {
    throw new Error('Tidak ditemukan program pengekstraksi (7z.exe / UnRAR.exe). Pastikan bin/7z.exe telah tersedia.')
  }

  const taskId = `ext-${crypto.createHash('md5').update(folderPath.toLowerCase()).digest('hex').slice(0, 16)}`
  const cleanName = packageName || path.basename(folderPath)
  const archiveBaseName = path.basename(primaryArchive)

  let destDir
  let workingDir
  const stat = fs.statSync(folderPath)
  if (stat.isFile()) {
    const cleanFolderName = path.basename(folderPath)
      .replace(/^[a-z0-9]+-/i, '')
      .replace(/\.(rar|zip|7z|iso|exe)$/i, '')
      .replace(/[-_.]+/g, ' ')
      .trim() || 'ExtractedGame'
    destDir = path.join(path.dirname(folderPath), cleanFolderName)
    workingDir = path.dirname(folderPath)
  } else {
    destDir = folderPath
    workingDir = folderPath
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  const initialMeasure = measureExtractionDiskProgress(folderPath, destDir)
  const totalArchiveBytes = initialMeasure.archiveBytes || 0
  const baselineExtractedBytes = initialMeasure.extractedBytes || 0

  const task = {
    id: taskId,
    packageName: cleanName,
    folderPath,
    primaryArchive: archiveBaseName,
    extractorType: extractorInfo.type,
    progressPercent: 0,
    extractedBytes: 0,
    extractedBytesFormatted: '0 B',
    totalBytes: totalArchiveBytes,
    totalBytesFormatted: totalArchiveBytes > 0 ? formatBytesLocal(totalArchiveBytes) : null,
    speedBytesPerSec: 0,
    speedFormatted: null,
    etaSeconds: null,
    etaFormatted: null,
    currentFile: 'Memulai ekstraksi...',
    status: 'extracting', // 'extracting' | 'completed' | 'error' | 'cancelled'
    error: null,
    errorType: null,
    startTime: Date.now(),
    completedAt: null
  }

  activeExtractions.set(taskId, task)

  // Susun daftar kandidat password cerdas
  const isOvaArchive = /^OG\d+-/i.test(archiveBaseName) || /ova/i.test(archiveBaseName) || /ova/i.test(folderPath)
  const isRinArchive = /rin|cs\.rin/i.test(archiveBaseName) || /rin|cs\.rin/i.test(folderPath)
  const isSteamRip = /steamrip/i.test(archiveBaseName) || /steamrip/i.test(folderPath)

  const cleanInputPwd = (password && password.trim() && password.trim().toLowerCase() !== 'filecrypt.cc')
    ? password.trim()
    : null

  const candidatePasswords = Array.from(
    new Set(
      [
        ...(cleanInputPwd ? [cleanInputPwd] : []),
        ...(isOvaArchive ? ['www.ovagames.com'] : []),
        ...(isRinArchive ? ['cs.rin.ru'] : []),
        ...(isSteamRip ? ['steamrip.com'] : []),
        'cs.rin.ru',
        'steamrip.com',
        'www.ovagames.com',
        'mygameon',
        'online-fix.me',
        'dodi-repacks.site',
        'fitgirl-repacks.site',
        ''
      ].filter((p) => typeof p === 'string')
    )
  )

  console.log(`[Extractor] Memulai ekstraksi "${primaryArchive}" [${extractorInfo.type}] ke "${destDir}" (Kandidat password: ${candidatePasswords.join(', ')})`)

  let lastResult = null
  let lastErrorParsed = null

  for (let i = 0; i < candidatePasswords.length; i++) {
    if (task.status === 'cancelled') {
      throw new Error('Ekstraksi dibatalkan oleh pengguna.')
    }

    const pwd = candidatePasswords[i]
    lastResult = await runSingleExtractionAttempt({
      extractorInfo,
      primaryArchive,
      destDir,
      workingDir,
      candidatePassword: pwd,
      task,
      totalArchiveBytes,
      baselineExtractedBytes,
      sourcePath: folderPath,
      onProgress
    })

    if (lastResult.code === 0) {
      break
    }

    lastErrorParsed = parseExtractionError(lastResult.outputBuffer, lastResult.code)

    // Jika gagal karena password salah dan masih ada kandidat berikutnya, bersihkan folder kosong dan coba lagi
    if (lastErrorParsed.type === 'password' && i < candidatePasswords.length - 1) {
      console.log(`[Extractor] Password "${pwd}" tidak cocok untuk "${cleanName}", mencoba kandidat berikutnya...`)
      removeEmptySubfolders(destDir)
      task.progressPercent = 0
      continue
    } else {
      break
    }
  }

  if (lastResult && lastResult.code === 0) {
    task.status = 'completed'
    task.progressPercent = 100
    task.currentFile = 'Ekstraksi Selesai'
    task.completedAt = new Date().toISOString()
    console.log(`[Extractor] Berhasil mengekstrak paket: "${cleanName}" (100%)`)

    // Opsi: Hapus berkas part mentahan jika diminta
    if (autoCleanRar) {
      try {
        const cleanTargetDir = stat.isFile() ? path.dirname(folderPath) : folderPath
        const files = fs.readdirSync(cleanTargetDir)
        for (const f of files) {
          if (/\.(part\d+\.rar|r\d+|rar|7z\.\d+|7z|zip)$/i.test(f)) {
            fs.unlinkSync(path.join(cleanTargetDir, f))
          }
        }
        console.log(`[Extractor] Berkas mentahan part di "${cleanTargetDir}" berhasil dibersihkan.`)
      } catch (cleanErr) {
        console.warn('[Extractor] Gagal membersihkan mentahan part:', cleanErr.message)
      }
    }

    // Simpan di memory selama 15 detik agar UI sempat menangkap status selesai
    setTimeout(() => {
      activeExtractions.delete(taskId)
    }, 15000)

    return { success: true, folderPath, packageName: cleanName, destDir }
  }

  // Bersihkan subfolder kosong jika ekstraksi gagal
  removeEmptySubfolders(destDir)

  const finalDiag = lastErrorParsed || parseExtractionError(lastResult?.outputBuffer, lastResult?.code || -1)
  task.status = 'error'
  task.error = finalDiag.message
  task.errorType = finalDiag.type
  console.error(`[Extractor] Gagal mengekstrak "${cleanName}": ${task.error}`)
  throw new Error(task.error)
}

export function dismissExtraction(taskId) {
  if (activeExtractions.has(taskId)) {
    const task = activeExtractions.get(taskId)
    task.status = 'cancelled'
    if (task.process) {
      try {
        task.process.kill()
      } catch (_) {}
    }
    activeExtractions.delete(taskId)
    return true
  }
  return false
}
