import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/db'
import StudioTask from '@/models/StudioTask'

export async function GET() {
  try {
    await connectToDatabase()
    // Tampilkan yang belum selesai di atas, lalu diurutkan berdasarkan tanggal buat terbaru
    const tasks = await StudioTask.find().sort({ isUploaded: 1, shopeeListed: 1, createdAt: -1 }).lean()
    return NextResponse.json({ tasks })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { title } = await request.json()
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Judul tugas wajib diisi' }, { status: 400 })
    }
    
    await connectToDatabase()
    const task = await StudioTask.create({ title: title.trim() })
    
    return NextResponse.json({ success: true, task })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const { id, isUploaded, shopeeListed, notes } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

    await connectToDatabase()
    
    const updateData = {}
    if (typeof isUploaded !== 'undefined') updateData.isUploaded = isUploaded
    if (typeof shopeeListed !== 'undefined') updateData.shopeeListed = shopeeListed
    if (typeof notes !== 'undefined') updateData.notes = notes

    const task = await StudioTask.findByIdAndUpdate(id, { $set: updateData }, { new: true })
    
    return NextResponse.json({ success: true, task })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

    await connectToDatabase()
    await StudioTask.findByIdAndDelete(id)
    
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
