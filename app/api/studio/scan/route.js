import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { auth } from '@/app/api/auth/[...nextauth]/route'

// Konfigurasi Lokasi Folder Kerja
const UPLOAD_DIR = process.env.STUDIO_UPLOAD_DIR || 'D:\\Game\\Shopee\\GameUpload'

export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ 
        success: false, 
        error: `Folder tidak ditemukan: ${UPLOAD_DIR}`, 
        path: UPLOAD_DIR,
        items: [] 
      })
    }

    // Membaca isi direktori
    const items = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })
    
    // Memfilter HANYA yang berbentuk Folder/Direktori
    // (Karena game biasanya berada di dalam foldernya sendiri sebelum di archive)
    const folders = items
      .filter(item => item.isDirectory())
      .map(dir => {
        const fullPath = path.join(UPLOAD_DIR, dir.name)
        // Hitung total size dan jumlah file di dalamnya secara kasar (opsional, bisa lambat jika filenya jutaan)
        // Untuk kecepatan scan, kita hanya kembalikan nama foldernya saja
        return {
          name: dir.name,
          path: fullPath
        }
      })

    // Cari juga file .rar atau .zip yang mungkin berserakan di root UPLOAD_DIR
    // Untuk berjaga-jaga jika ada sisa arsip sebelumnya
    const archives = items
      .filter(item => !item.isDirectory() && (item.name.endsWith('.rar') || item.name.endsWith('.zip')))
      .map(file => ({ name: file.name, path: path.join(UPLOAD_DIR, file.name) }))

    return NextResponse.json({
      success: true,
      path: UPLOAD_DIR,
      folders,
      archives
    })

  } catch (err) {
    console.error('Studio Scan Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
