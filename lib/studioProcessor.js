import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { google } from 'googleapis'
import connectToDatabase from './db.js'
import GameCatalog from '../models/GameCatalog.js'
import WorkspaceAccount from '../models/WorkspaceAccount.js'
import UploadHistory from '../models/UploadHistory.js'
import StudioTask from '../models/StudioTask.js'

async function getDriveClient(email) {
  await connectToDatabase();
  const account = await WorkspaceAccount.findOne({ email });
  if (!account || !account.refreshToken) {
    throw new Error(`Token tidak ditemukan untuk email: ${email}`);
  }
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: account.refreshToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

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

export async function archiveJob(folderPath, config) {
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
     
     const args = ['a', '-y', '-ep1']
     args.push(`-${config.compression}`)
     args.push(`-v${config.splitSize}m`)
     if (config.solid) args.push('-s')
     if (config.recoveryRecord) args.push('-rr5p')
     
     args.push(outputRar)
     args.push(folderName)
     
     updateState(
         { text: `Menyiapkan kompresi untuk: ${folderName}` },
         `Menjalankan perintah: Rar.exe ${args.join(' ')}`
     )

     await new Promise((resolve, reject) => {
         const child = spawn(rarExe, args, { cwd: path.dirname(folderPath) })
         
         child.stdout.on('data', (data) => {
             const str = data.toString()
             const match = str.match(/(\d+)%/g)
             if (match) {
                 const last = match[match.length - 1]
                 const pct = parseInt(last.replace('%', ''))
                 updateState({ progress: pct, text: `[WinRAR] Mengompresi ${folderName}... ${pct}%` })
                 if (pct === 25 || pct === 50 || pct === 75 || pct === 100) {
                     const currentLogs = getJobState().logs || []
                     const lastLog = currentLogs[currentLogs.length - 1] || ''
                     if (!lastLog.includes(`${pct}%`)) {
                         updateState({}, `Kompresi WinRAR mencapai ${pct}%`)
                     }
                 }
             }
         })
         
         child.stderr.on('data', (data) => {
             console.error('WinRAR Err:', data.toString())
         })
         
         child.on('close', (code) => {
             if (code === 0 || code === 1) resolve()
             else reject(new Error(`WinRAR gagal dengan exit code ${code}. Cek log server.`))
         })
         child.on('error', reject)
     })
     
     updateState(
         { status: 'success', phase: 'done', progress: 100, text: `Berhasil! Kompresi ${folderName} selesai.` },
         `Kompresi WinRAR selesai dengan sukses.`
     )
  } catch (err) {
      console.error('Archive Process Error:', err)
      updateState(
          { status: 'error', progress: 0, text: `Gagal: ${err.message}` },
          `ERROR: ${err.message}`
      )
  }
}

export async function uploadJob(folderPath, targetEmail, config) {
  updateState(
      { status: 'processing', phase: 'uploading', progress: 0, text: 'Mempersiapkan Upload...', logs: [] },
      `Memulai upload untuk folder: ${path.basename(folderPath)} ke ${targetEmail}`
  )
  
  try {
     const folderName = path.basename(folderPath)
     
     const dir = path.dirname(folderPath)
     const allFiles = fs.readdirSync(dir)
     
     // Karena WinRAR split volume menggunakan format .part1.rar, .part2.rar, dst.
     // Kita filter file yang diawali nama game dan diakhiri .rar
     const parts = allFiles.filter(f => f.startsWith(folderName) && f.endsWith('.rar'))
     // Sort berurutan
     parts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
     
     if (parts.length === 0) throw new Error('File RAR tidak ditemukan setelah kompresi selesai!')
     
     updateState({}, `Ditemukan ${parts.length} file part. Bersiap upload ke ${targetEmail}.`)

     const drive = await getDriveClient(targetEmail)
     
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
     
     // 7. Catat ke UploadHistory
     await UploadHistory.create({
         gameName: folderName,
         workspaceEmail: targetEmail,
         totalSize: totalBytesUploaded,
         fileCount: parts.length,
         uploadedAt: new Date()
     })

     // 8. Otomatis selesaikan StudioTask yang cocok dengan judul game
     try {
         await StudioTask.findOneAndUpdate(
             { title: folderName },
             { $set: { isUploaded: true } }
         )
     } catch (err) {
         console.error('Failed to auto-update StudioTask:', err)
     }
     
     // 9. Bersihkan File RAR hasil kompresi
     updateState({}, `Membersihkan file RAR sementara...`)
     for (const partName of parts) {
         try {
             fs.unlinkSync(path.join(dir, partName))
         } catch(e) {}
     }

     // 10. Auto-Delete Folder Lokal (Jika Diaktifkan)
     if (config.autoDelete) {
         updateState({}, `Mode Auto-Uninstall/Delete aktif. Menghapus folder lokal: ${folderName}...`)
         try {
             // Langsung hapus foldernya untuk membebaskan ruang secepat mungkin (lebih reliable daripada uninstaller yang asinkron/butuh UAC)
             fs.rmSync(folderPath, { recursive: true, force: true })
             updateState({}, `Folder lokal berhasil dihapus paksa.`)
         } catch (e) {
             updateState({}, `Gagal menghapus folder lokal: ${e.message}`)
         }
     }

     // 11. Selesai
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
