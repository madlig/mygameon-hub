import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { getClientForEmail } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

const STATE_FILE = path.join(process.cwd(), 'studio-state.json')

export function getJobState() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) } catch(e){}
  }
  return { status: 'idle', progress: 0, text: '', logs: [] }
}

export function updateState(newState, logMessage = null) {
  const current = getJobState()
  const updated = { ...current, ...newState }
  if (logMessage) {
      updated.logs = updated.logs || []
      const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
      updated.logs.push(`[${timestamp}] ${logMessage}`)
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2))
}

export async function startJob(folderPath, targetEmail, config) {
  // 1. Reset state
  updateState(
      { status: 'processing', phase: 'archiving', progress: 0, text: 'Memulai Automasi WinRAR...', logs: [] },
      `Mempersiapkan job untuk folder: ${path.basename(folderPath)}`
  )
  
  try {
     const rarExe = 'C:\\Program Files\\WinRAR\\Rar.exe'
     if (!fs.existsSync(rarExe)) {
         throw new Error('WinRAR (Rar.exe) tidak ditemukan di C:\\Program Files\\WinRAR\\. Pastikan WinRAR terinstall.')
     }
     
     const folderName = path.basename(folderPath)
     const outputRar = path.join(path.dirname(folderPath), `${folderName}.rar`)
     
     // 2. Build WinRAR Args
     const args = ['a', '-y']
     args.push(`-${config.compression}`) // e.g. -m5
     args.push(`-v${config.splitSize}m`)
     if (config.solid) args.push('-s')
     if (config.recoveryRecord) args.push('-rr5p')
     
     args.push(outputRar)
     args.push(folderPath) // Memasukkan folder seutuhnya ke dalam arsip
     
     updateState(
         { text: `Menyiapkan kompresi untuk: ${folderName}` },
         `Menjalankan perintah: Rar.exe ${args.join(' ')}`
     )

     // 3. Eksekusi WinRAR
     await new Promise((resolve, reject) => {
         const child = spawn(rarExe, args, { cwd: path.dirname(folderPath) })
         
         child.stdout.on('data', (data) => {
             const str = data.toString()
             const match = str.match(/(\d+)%/g)
             if (match) {
                 const last = match[match.length - 1]
                 const pct = parseInt(last.replace('%', ''))
                 
                 // Jangan log setiap persen agar log tidak spam, cukup update state text
                 updateState({ progress: pct, text: `[WinRAR] Mengompresi ${folderName}... ${pct}%` })
                 
                 // Log setiap kelipatan 25%
                 if (pct === 25 || pct === 50 || pct === 75 || pct === 100) {
                     const currentLogs = getJobState().logs || []
                     const lastLog = currentLogs[currentLogs.length - 1] || ''
                     if (!lastLog.includes(`${pct}%`)) {
                         updateState({}, `Kompresi WinRAR mencapai ${pct}%`)
                     }
                 }
             }
         })
         
         // Rar.exe sometimes prints to stderr
         child.stderr.on('data', (data) => {
             console.error('WinRAR Err:', data.toString())
         })
         
         child.on('close', (code) => {
             if (code === 0 || code === 1) resolve() // 0 success, 1 warning (e.g. file locked)
             else reject(new Error(`WinRAR gagal dengan exit code ${code}. Cek log server.`))
         })
         child.on('error', reject)
     })
     
     updateState({}, `Kompresi WinRAR selesai dengan sukses.`)
     
     // 4. Persiapan Upload
     updateState(
         { phase: 'uploading', progress: 0, text: 'Mencari file hasil kompresi...' },
         `Mencari file .rar untuk ${folderName}...`
     )
     
     const dir = path.dirname(folderPath)
     const allFiles = fs.readdirSync(dir)
     
     // Karena WinRAR split volume menggunakan format .part1.rar, .part2.rar, dst.
     // Kita filter file yang diawali nama game dan diakhiri .rar
     const parts = allFiles.filter(f => f.startsWith(folderName) && f.endsWith('.rar'))
     // Sort berurutan
     parts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
     
     if (parts.length === 0) throw new Error('File RAR tidak ditemukan setelah kompresi selesai!')
     
     updateState({}, `Ditemukan ${parts.length} file part. Bersiap upload ke ${targetEmail}.`)

     const drive = await getClientForEmail(targetEmail)
     
     // 5. Eksekusi Upload (Resumable)
     let currentPart = 1
     let totalBytesUploaded = 0
     let driveFolderId = null

     for (const partName of parts) {
         const partPath = path.join(dir, partName)
         const stat = fs.statSync(partPath)
         const fileSize = stat.size
         
         updateState(
             { progress: 0, text: `[Upload] Part ${currentPart} dari ${parts.length} (${partName})` },
             `Memulai upload ${partName} (${Math.round(fileSize / 1024 / 1024)} MB)...`
         )

         const res = await drive.files.create({
             requestBody: {
                 name: partName,
             },
             media: {
                 body: fs.createReadStream(partPath),
             },
         }, {
             onUploadProgress: evt => {
                 const pct = Math.round((evt.bytesRead / fileSize) * 100)
                 updateState({ 
                     progress: pct, 
                     text: `[Upload] Part ${currentPart}/${parts.length}: ${pct}% selesai` 
                 })
             }
         })

         if (!driveFolderId) {
             // Buat folder penampung game
             const folderRes = await drive.files.create({
                 requestBody: {
                     name: folderName,
                     mimeType: 'application/vnd.google-apps.folder',
                     parents: ['root']
                 },
                 fields: 'id'
             })
             driveFolderId = folderRes.data.id
         }
         
         // Pindahkan file part ke dalam folder penampung
         await drive.files.update({
             fileId: res.data.id,
             addParents: driveFolderId,
             removeParents: 'root'
         })

         totalBytesUploaded += fileSize
         
         updateState({}, `Selesai upload ${partName}.`)
         currentPart++
     }

     // 6. Update Database (Lazy Cache Invalidation)
     updateState(
         { phase: 'finishing', progress: 100, text: 'Memperbarui database...' },
         `Mencatat data ke Database (Total size: ${Math.round(totalBytesUploaded / 1024 / 1024)} MB)`
     )
     await connectToDatabase()
     
     // Hapus entri lama jika ada, lalu buat/update yang baru
     await GameCatalog.findOneAndUpdate(
         { name: folderName },
         {
             name: folderName,
             folderId: driveFolderId,
             ownerEmail: targetEmail,
             fileCount: parts.length,
             totalSize: totalBytesUploaded,
             lastSyncedAt: new Date()
         },
         { upsert: true, new: true }
     )
     
     // 7. Auto-Delete Folder Lokal (Jika Diaktifkan)
     if (config.autoDelete) {
         updateState({}, `Mode Auto-Delete aktif. Menghapus folder dan file rar lokal...`)
         try {
             // Hapus folder asli
             fs.rmSync(folderPath, { recursive: true, force: true })
             updateState({}, `Folder asli terhapus: ${folderName}`)
             
             // Hapus file rar part
             for (const partName of parts) {
                 fs.unlinkSync(path.join(dir, partName))
             }
             updateState({}, `Semua file part .rar terhapus.`)
         } catch (delErr) {
             console.error('Gagal menghapus file lokal:', delErr)
             updateState({}, `Peringatan: Gagal menghapus beberapa file lokal (${delErr.message})`)
         }
     }

     // 8. Selesai
     updateState(
         { status: 'success', phase: 'done', progress: 100, text: `Berhasil! ${parts.length} part telah diupload ke ${targetEmail}.` },
         `Semua proses selesai 100%. Game siap didownload.`
     )

  } catch (err) {
      console.error('Studio Process Error:', err)
      updateState(
          { status: 'error', progress: 0, text: `Gagal: ${err.message}` },
          `ERROR: ${err.message}`
      )
  }
}
