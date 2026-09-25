import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { getStudioQueue, saveStudioQueue } from '@/lib/studioConfig'

// ── GET: Ambil daftar antrean tersimpan ──
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const queue = getStudioQueue()
    return NextResponse.json({ success: true, queue })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST: Manipulasi antrean (Add, Remove, Reorder, Retry, Clear, Set) ──
export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Jika langsung passing array queue lengkap
    if (body.queue && Array.isArray(body.queue)) {
      const saved = saveStudioQueue(body.queue)
      return NextResponse.json({ success: true, queue: saved })
    }

    let queue = getStudioQueue()
    const { action } = body

    if (action === 'add') {
      if (!body.item || !body.item.id) {
        return NextResponse.json({ error: 'Item antrean tidak valid' }, { status: 400 })
      }
      // Cek apakah item dengan ID ini sudah ada di antrean
      const existingIdx = queue.findIndex((q) => q.id === body.item.id)
      if (existingIdx >= 0) {
        queue[existingIdx] = { ...queue[existingIdx], ...body.item }
      } else {
        queue.push(body.item)
      }
      const saved = saveStudioQueue(queue)
      return NextResponse.json({ success: true, queue: saved })
    }

    if (action === 'remove') {
      if (!body.id) {
        return NextResponse.json({ error: 'ID item diperlukan' }, { status: 400 })
      }
      queue = queue.filter((q) => q.id !== body.id)
      const saved = saveStudioQueue(queue)
      return NextResponse.json({ success: true, queue: saved })
    }

    if (action === 'reorder') {
      const { fromIndex, toIndex } = body
      if (
        typeof fromIndex !== 'number' ||
        typeof toIndex !== 'number' ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= queue.length ||
        toIndex >= queue.length
      ) {
        return NextResponse.json({ error: 'Index reorder tidak valid' }, { status: 400 })
      }
      const [movedItem] = queue.splice(fromIndex, 1)
      queue.splice(toIndex, 0, movedItem)
      const saved = saveStudioQueue(queue)
      return NextResponse.json({ success: true, queue: saved })
    }

    if (action === 'retry') {
      if (!body.id) {
        return NextResponse.json({ error: 'ID item diperlukan' }, { status: 400 })
      }
      queue = queue.map((q) =>
        q.id === body.id
          ? {
              ...q,
              status: 'waiting',
              progress: 0,
              text: 'Menunggu antrean...',
              errorDetail: null,
            }
          : q
      )
      const saved = saveStudioQueue(queue)
      return NextResponse.json({ success: true, queue: saved })
    }

    if (action === 'retry_all') {
      queue = queue.map((q) =>
        q.status === 'error'
          ? {
              ...q,
              status: 'waiting',
              progress: 0,
              text: 'Menunggu antrean...',
              errorDetail: null,
            }
          : q
      )
      const saved = saveStudioQueue(queue)
      return NextResponse.json({ success: true, queue: saved })
    }

    if (action === 'clear_completed') {
      queue = queue.filter((q) => q.status !== 'success')
      const saved = saveStudioQueue(queue)
      return NextResponse.json({ success: true, queue: saved })
    }

    if (action === 'clear_all') {
      // Pertahankan item yang sedang processing jika ada
      queue = queue.filter((q) => q.status === 'processing')
      const saved = saveStudioQueue(queue)
      return NextResponse.json({ success: true, queue: saved })
    }

    if (action === 'update_item') {
      if (!body.id || !body.updates) {
        return NextResponse.json({ error: 'ID dan updates diperlukan' }, { status: 400 })
      }
      queue = queue.map((q) => (q.id === body.id ? { ...q, ...body.updates } : q))
      const saved = saveStudioQueue(queue)
      return NextResponse.json({ success: true, queue: saved })
    }

    return NextResponse.json({ error: 'Aksi antrean tidak dikenali' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
