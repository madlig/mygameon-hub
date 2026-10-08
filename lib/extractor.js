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

// Singleton tracker untuk ekstraksi aktif di memory
if (!globalThis.__mygameonActiveExtractions) {
  globalThis.__mygameonActiveExtractions = new Map() // id -> extraction object
}

const activeExtractions = globalThis.__mygameonActiveExtractions

export function findUnrarExecutable() {
  for (const p of UNRAR_PATHS) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return null
}

export function checkExtractorAvailable() {
  return !!findUnrarExecutable()
}

export function getActiveExtractions() {
  const list = []
  for (const [id, item] of activeExtractions) {
    list.push({ ...item })
  }
  return list
}

/**
 * Mencari file volume pertama dalam folder arsip multi-part
 */
export function findPrimaryArchiveFile(folderPath) {
  if (!fs.existsSync(folderPath)) return null

  try {
    const files = fs.readdirSync(folderPath)

    // 1. Pola part1: .part01.rar, .part001.rar, .part1.rar
    const part1File = files.find((f) => /\.part0*1\.rar$/i.test(f))
    if (part1File) return path.join(folderPath, part1File)

    // 2. Pola 7z split: .7z.001 atau .zip.001
    const split7z = files.find((f) => /\.(7z|zip)\.001$/i.test(f))
    if (split7z) return path.join(folderPath, split7z)

    // 3. Pola single .rar atau legacy .rar (dengan .r00, .r01)
    const singleRar = files.find((f) => /\.rar$/i.test(f) && !/\.part\d+\.rar$/i.test(f))
    if (singleRar) return path.join(folderPath, singleRar)

    // 4. Pola single .zip atau .7z
    const singleArchive = files.find((f) => /\.(zip|7z)$/i.test(f))
    if (singleArchive) return path.join(folderPath, singleArchive)

    return null
  } catch (err) {
    console.error('[Extractor] Gagal membaca folder untuk primary archive:', err.message)
    return null
  }
}

/**
 * Eksekusi ekstraksi arsip multi-part menggunakan WinRAR native UnRAR.exe
 */
export async function extractMultiPartArchive({
  folderPath,
  packageName = '',
  password = 'mygameon',
  autoCleanRar = false,
  onProgress = null
}) {
  const unrarExe = findUnrarExecutable()
  if (!unrarExe) {
    throw new Error('UnRAR.exe tidak ditemukan di PC. Pastikan WinRAR telah terpasang di C:\\Program Files\\WinRAR.')
  }

  const primaryArchive = findPrimaryArchiveFile(folderPath)
  if (!primaryArchive) {
    throw new Error(`Tidak ditemukan berkas volume pertama (.part01.rar / .rar / .7z) di dalam: ${folderPath}`)
  }

  const taskId = `ext-${crypto.createHash('md5').update(folderPath.toLowerCase()).digest('hex').slice(0, 16)}`
  const cleanName = packageName || path.basename(folderPath)

  // 🛡️ Normalisasi destDir ke forward slash dengan trailing slash agar tidak terjadi escaping quote bug (\") di Windows spawn
  const normalizedDest = folderPath.replace(/\\/g, '/').replace(/\/+$/, '') + '/'

  const task = {
    id: taskId,
    packageName: cleanName,
    folderPath,
    primaryArchive: path.basename(primaryArchive),
    progressPercent: 0,
    currentFile: 'Memulai ekstraksi...',
    status: 'extracting', // 'extracting' | 'completed' | 'error' | 'cancelled'
    error: null,
    startTime: Date.now(),
    completedAt: null
  }

  activeExtractions.set(taskId, task)

  // Parameter UnRAR:
  // x: extract with full paths
  // -y: assume yes on all queries
  // -o+: overwrite existing files
  // -p<password>: use password (if unencrypted, UnRAR will ignore -p)
  const args = ['x', '-y', '-o+']
  if (password && password.trim()) {
    args.push(`-p${password.trim()}`)
  } else {
    args.push('-p-')
  }
  args.push(primaryArchive)
  args.push(normalizedDest)

  return new Promise((resolve, reject) => {
    console.log(`[Extractor] Memulai ekstraksi: "${primaryArchive}" ke "${normalizedDest}"`)
    const child = spawn(unrarExe, args, { cwd: folderPath, stdio: ['ignore', 'pipe', 'pipe'] })
    task.process = child

    let outputBuffer = ''

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      outputBuffer += text

      // Parse baris progress persentase UnRAR: misal "Extracting  Setup.exe       45%   OK"
      const match = text.match(/(\d+)%/g)
      if (match && match.length > 0) {
        const lastPercentStr = match[match.length - 1].replace('%', '')
        const percent = parseInt(lastPercentStr, 10)
        if (!isNaN(percent) && percent >= 0 && percent <= 100) {
          task.progressPercent = percent
          if (onProgress) onProgress(task)
        }
      }

      // Parse nama berkas saat ini
      const fileMatch = text.match(/Extracting\s+([^\r\n]+)/)
      if (fileMatch) {
        task.currentFile = path.basename(fileMatch[1].trim())
      }
    })

    child.stderr.on('data', (chunk) => {
      outputBuffer += chunk.toString()
    })

    child.on('error', (err) => {
      task.status = 'error'
      task.error = err.message
      reject(err)
    })

    child.on('close', (code) => {
      if (code === 0) {
        task.status = 'completed'
        task.progressPercent = 100
        task.currentFile = 'Ekstraksi Selesai'
        task.completedAt = new Date().toISOString()
        console.log(`[Extractor] Berhasil mengekstrak paket: "${cleanName}" (100%)`)

        // Opsi: Hapus berkas part mentahan jika diminta agar hemat disk
        if (autoCleanRar) {
          try {
            const files = fs.readdirSync(folderPath)
            for (const f of files) {
              if (/\.(part\d+\.rar|r\d+|rar|7z\.\d+)$/i.test(f)) {
                fs.unlinkSync(path.join(folderPath, f))
              }
            }
            console.log(`[Extractor] Berkas mentahan RAR di "${folderPath}" berhasil dibersihkan.`)
          } catch (cleanErr) {
            console.warn('[Extractor] Gagal membersihkan mentahan part:', cleanErr.message)
          }
        }

        // Hapus dari map ekstraksi aktif setelah 15 detik agar UI sempat melihat status selesai
        setTimeout(() => {
          activeExtractions.delete(taskId)
        }, 15000)

        resolve({ success: true, folderPath, packageName: cleanName })
      } else {
        let friendlyErr = `Ekstraksi gagal (Kode keluar: ${code}).`
        if (outputBuffer.includes('Incorrect password')) {
          friendlyErr = 'Password arsip salah! Pastikan menggunakan password yang tepat (misal: www.ovagames.com).'
        } else if (
          outputBuffer.toLowerCase().includes('write error') ||
          outputBuffer.toLowerCase().includes('not enough space') ||
          outputBuffer.toLowerCase().includes('disk full')
        ) {
          friendlyErr = 'Ruang penyimpanan hard disk penuh saat mengekstrak! Sediakan ruang kosong minimal 2x dari ukuran berkas ISO.'
        } else if (outputBuffer.includes('Cannot find') || outputBuffer.includes('No files to extract')) {
          friendlyErr = 'Berkas volume arsip tidak lengkap atau part lanjutan tidak ditemukan di dalam folder.'
        } else {
          friendlyErr = `Ekstraksi gagal (Kode ${code}): ${outputBuffer.slice(-200).trim()}`
        }

        task.status = 'error'
        task.error = friendlyErr
        console.error(`[Extractor] Gagal mengekstrak "${cleanName}": ${task.error}`)
        reject(new Error(task.error))
      }
    })
  })
}

export function dismissExtraction(taskId) {
  if (activeExtractions.has(taskId)) {
    const task = activeExtractions.get(taskId)
    if (task.process && task.status === 'extracting') {
      try {
        task.process.kill()
      } catch (_) {}
    }
    activeExtractions.delete(taskId)
    return true
  }
  return false
}
