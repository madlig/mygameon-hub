import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawTitle = searchParams.get('title')
    
    if (!rawTitle) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    }

    // Clean up the title from repacker names, edition tags, etc for better search accuracy
    let searchTitle = rawTitle
      .replace(/(multi\d+)?-?(elamigos|dodi|fitgirl|gog|tenoke|rune|skidrow|codex|emp|plaza|razor1911|reloaded|flt)/gi, '')
      .replace(/deluxe edition|ultimate edition|premium edition|devout edition|gold edition|complete edition/gi, '')
      .trim()

    // Steam API search
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(searchTitle)}&l=english&cc=US`
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })
    const data = await response.json()

    if (data && data.items && data.items.length > 0) {
      // Find the first game (not DLC/Bundle if possible, though Steam search usually puts base games first)
      const appId = data.items[0].id
      
      // Construct the 600x900 vertical capsule URL using the new Steam CDN domain
      const coverUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`
      
      return NextResponse.json({ 
        success: true, 
        coverUrl,
        matchedName: data.items[0].name 
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Tidak ditemukan di Steam' 
      }, { status: 404 })
    }
  } catch (error) {
    console.error('Steam API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
