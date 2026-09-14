import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import fs from 'fs'

export async function POST(request) {
  try {
    const { folderPath } = await request.json()

    if (!folderPath || !fs.existsSync(folderPath)) {
      return NextResponse.json({ success: false, error: 'Folder tidak ditemukan' }, { status: 404 })
    }

    // Open folder in Windows Explorer
    exec(`explorer.exe "${folderPath}"`, (err) => {
      if (err) {
        console.error('Failed to open Explorer:', err)
      }
    })

    return NextResponse.json({ success: true, message: 'Folder berhasil dibuka' })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
