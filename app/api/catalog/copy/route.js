import { getClientForEmail } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import GameCatalog from '@/models/GameCatalog'

export async function POST(request) {
  let sourceFolderId, targetEmail, sourceOwnerEmail, gameName

  try {
    const body = await request.json()
    sourceFolderId = body.sourceFolderId
    targetEmail = body.targetEmail
    sourceOwnerEmail = body.sourceOwnerEmail
    gameName = body.gameName
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function sendProgress(msg) {
        controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'))
      }
      
      try {
        const sourceDrive = await getClientForEmail(sourceOwnerEmail)
        const targetDrive = await getClientForEmail(targetEmail)
        
        // 1. Share source folder to targetEmail as reader
        sendProgress({ status: 'info', text: 'Membagikan akses antar workspace...' })
        try {
          await sourceDrive.permissions.create({
            fileId: sourceFolderId,
            sendNotificationEmail: false,
            supportsAllDrives: true,
            requestBody: { role: 'reader', type: 'user', emailAddress: targetEmail }
          })
        } catch (e) {
          // Abaikan jika sudah dibagikan sebelumnya
          console.warn('Share warning:', e.message)
        }

        // 2. Buat folder baru di targetDrive
        sendProgress({ status: 'info', text: 'Membuat folder baru di workspace tujuan...' })
        let targetGameFolderId = 'root';
        // Cari id gameFolder target
        const WorkspaceAccount = (await import('@/models/WorkspaceAccount')).default;
        await connectToDatabase();
        const acc = await WorkspaceAccount.findOne({ email: targetEmail }).lean();
        if (acc && acc.gameFolderId && acc.gameFolderId !== 'root') {
            targetGameFolderId = acc.gameFolderId;
        }

        const folderRes = await targetDrive.files.create({
          requestBody: {
            name: gameName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [targetGameFolderId]
          },
          fields: 'id'
        })
        const newFolderId = folderRes.data.id

        // 3. Ambil daftar file di sourceFolder
        sendProgress({ status: 'info', text: 'Membaca part file dari sumber...' })
        let pageToken
        const files = []
        do {
          const res = await sourceDrive.files.list({
            q: `'${sourceFolderId}' in parents and trashed = false`,
            pageSize: 100,
            pageToken,
            fields: 'nextPageToken, files(id, name, size)'
          })
          files.push(...(res.data.files || []))
          pageToken = res.data.nextPageToken
        } while (pageToken)

        if (files.length === 0) {
            throw new Error('Folder sumber kosong')
        }

        sendProgress({ status: 'info', text: `Menemukan ${files.length} part. Mulai menyalin...` })

        // 4. Salin tiap file ke folder baru
        let copied = 0
        let totalSize = 0
        
        // Paralel dengan concurrency limit = 3 untuk menghindari rate limit Google Drive
        const concurrency = 3
        for (let i = 0; i < files.length; i += concurrency) {
          const batch = files.slice(i, i + concurrency)
          await Promise.all(batch.map(async (file) => {
            await targetDrive.files.copy({
              fileId: file.id,
              requestBody: {
                name: file.name,
                parents: [newFolderId]
              }
            })
            copied++
            totalSize += parseInt(file.size || 0)
          }))
          sendProgress({ status: 'progress', copied, total: files.length, text: `Menyalin part ${copied} dari ${files.length}...` })
        }

        // 5. Simpan ke database
        sendProgress({ status: 'info', text: 'Mendaftarkan hasil backup ke katalog...' })
        
        await GameCatalog.create({
          name: gameName,
          folderId: newFolderId,
          ownerEmail: targetEmail,
          fileCount: files.length,
          totalSize,
          lastSyncedAt: new Date()
        })

        sendProgress({ status: 'success', text: 'Backup Selesai!' })
        controller.close()
      } catch (err) {
        sendProgress({ status: 'error', text: err.message })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain', 'Transfer-Encoding': 'chunked' }
  })
}
