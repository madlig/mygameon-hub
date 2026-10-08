import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/listing/slide-preview?path=/absolute/path/to/SLIDE_1_THUMBNAIL.jpg
 * Returns the image file directly. Auth required.
 * Security: only allows reads from configured output base directory.
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return new Response('Missing path parameter', { status: 400 })
    }

    // Security: normalize and validate the path stays within allowed dirs
    const normalizedPath = path.normalize(filePath)
    const allowedBases = [
      'D:\\Shopee',
      path.join(process.cwd(), 'listing_output')
    ]
    const isAllowed = allowedBases.some(base => normalizedPath.toLowerCase().startsWith(base.toLowerCase()))

    if (!isAllowed) {
      return new Response('Path not allowed', { status: 403 })
    }

    if (!fs.existsSync(normalizedPath)) {
      return new Response('File not found', { status: 404 })
    }

    const fileBuffer = fs.readFileSync(normalizedPath)
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=3600'
      }
    })
  } catch (err) {
    return new Response('Server error: ' + err.message, { status: 500 })
  }
}
