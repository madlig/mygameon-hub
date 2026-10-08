import { NextResponse } from 'next/server'
import os from 'os'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { remoteTunnel } from '@/lib/remoteTunnel'

export async function GET(request) {
  try {
    const session = await auth()
    if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const interfaces = os.networkInterfaces()
    const addresses = []

    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        // Hanya IPv4, bukan internal loopback
        if (net.family === 'IPv4' && !net.internal) {
          // Prioritaskan Wi-Fi / Ethernet standar (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
          addresses.push({
            interface: name,
            ip: net.address,
            isPrivate: /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(net.address)
          })
        }
      }
    }

    // Sort: prioritaskan private LAN (Wi-Fi/Ethernet)
    addresses.sort((a, b) => (b.isPrivate ? 1 : 0) - (a.isPrivate ? 1 : 0))

    const primaryIp = addresses.length > 0 ? addresses[0].ip : 'localhost'
    const port = process.env.PORT || 3000
    const pin = process.env.ADMIN_PIN || 'mygameon'
    const adminEmail = process.env.ADMIN_EMAIL || ''
    const mobileUrl = `http://${primaryIp}:${port}`
    const quickLoginUrl = `${mobileUrl}/login?email=${encodeURIComponent(adminEmail)}&pin=${encodeURIComponent(pin)}`

    const tunnel = remoteTunnel.getStatus()
    const remoteUrl = tunnel.publicUrl || null
    const quickLoginUrlRemote = remoteUrl
      ? `${remoteUrl}/login?email=${encodeURIComponent(adminEmail)}&pin=${encodeURIComponent(pin)}`
      : null

    return NextResponse.json({
      success: true,
      data: {
        hostname: os.hostname(),
        port,
        primaryIp,
        addresses,
        adminEmail,
        pin,
        mobileUrl,
        quickLoginUrl,
        remoteUrl,
        quickLoginUrlRemote,
        tunnelActive: tunnel.active,
        tunnelStatus: tunnel.status,
        isCustomDomain: !!process.env.CLOUDFLARE_TUNNEL_DOMAIN,
      }
    })
  } catch (err) {
    console.error('Network info error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
