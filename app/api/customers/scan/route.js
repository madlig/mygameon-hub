import { NextResponse } from 'next/server'
import { getGoogleClients, getClientForEmail } from '@/lib/googleClient'
import connectToDatabase from '@/lib/db'
import WorkspaceAccount from '@/models/WorkspaceAccount'
import AccessLog from '@/models/AccessLog'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    const emailLower = email.toLowerCase().trim()
    const safeEmail = emailLower.replace(/'/g, "\\'")
    
    await connectToDatabase()
    
    const accounts = await WorkspaceAccount.find({ status: 'active' })
    const allFiles = []
    
    const query = `'${safeEmail}' in readers and (mimeType = '${FOLDER_MIME}' or mimeType = 'application/vnd.google-apps.shortcut') and trashed = false`

    const { drive: adminDrive, session } = await getGoogleClients()
    const adminEmail = session?.user?.email || 'admin'

    const scanDrive = async (driveClient, ownerEmail) => {
      let pageToken
      do {
        const res = await driveClient.files.list({
          q: query,
          pageSize: 100,
          pageToken,
          fields: 'nextPageToken, files(id, name, permissions(id, emailAddress))',
        })
        for (const f of res.data.files || []) {
          f._ownerEmail = ownerEmail
          allFiles.push(f)
        }
        pageToken = res.data.nextPageToken
      } while (pageToken)
    }

    const promises = accounts.map(async (acc) => {
      try {
        const drive = await getClientForEmail(acc.email)
        await scanDrive(drive, acc.email)
      } catch (e) {
        console.error(`Scan error for ${acc.email}:`, e.message)
      }
    })

    promises.push(scanDrive(adminDrive, adminEmail).catch(e => console.error('Admin drive scan error:', e.message)))

    await Promise.all(promises)
    
    // Simpan ke AccessLog jika belum ada
    const accessOps = []
    for (const file of allFiles) {
      if (!file.permissions) continue
      const perm = file.permissions.find(p => p.emailAddress?.toLowerCase() === emailLower)
      if (!perm) continue

      accessOps.push({
        updateOne: {
          filter: { email: emailLower, folderId: file.id, permissionId: perm.id },
          update: {
            $setOnInsert: {
              email: emailLower,
              gameName: file.name,
              folderId: file.id,
              permissionId: perm.id,
              ownerEmail: file._ownerEmail,
              status: 'active',
              grantedAt: new Date()
            }
          },
          upsert: true
        }
      })
    }

    if (accessOps.length > 0) {
      await AccessLog.bulkWrite(accessOps)
    }

    return NextResponse.json({ success: true, filesFound: accessOps.length })

  } catch (err) {
    console.error('Scan error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
