import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

/**
 * Singleton state untuk Cloudflare Remote Tunnel
 */
class RemoteTunnelManager {
  constructor() {
    this.process = null
    this.status = 'stopped' // 'stopped' | 'starting' | 'connected' | 'error'
    this.publicUrl = null
    this.startedAt = null
    this.error = null
    this.reconnectAttempts = 0

    // Daftarkan listener shutdown otomatis saat aplikasi desktop dimatikan
    if (typeof process !== 'undefined') {
      const cleanup = () => this.stop()
      process.on('exit', cleanup)
      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)
    }
  }

  getBinaryPath() {
    const localBin = path.join(process.cwd(), 'bin', 'cloudflared.exe')
    if (fs.existsSync(localBin)) {
      return localBin
    }
    const systemPaths = [
      'C:\\Program Files\\cloudflared\\cloudflared.exe',
      'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    ]
    for (const p of systemPaths) {
      if (fs.existsSync(p)) return p
    }
    return 'cloudflared'
  }

  getStatus() {
    const customDomain = process.env.CLOUDFLARE_TUNNEL_DOMAIN
    const formattedDomain = customDomain
      ? (customDomain.startsWith('http') ? customDomain : `https://${customDomain}`)
      : null

    const effectiveUrl = formattedDomain || this.publicUrl
    const isActive = (this.status === 'connected' && !!this.publicUrl) || !!formattedDomain

    return {
      active: isActive,
      status: isActive ? 'connected' : this.status,
      publicUrl: effectiveUrl,
      startedAt: this.startedAt,
      error: this.error,
    }
  }

  async start(options = {}) {
    const port = options.port || 3000
    const token = options.token || process.env.CLOUDFLARE_TUNNEL_TOKEN
    const customDomain = options.customDomain || process.env.CLOUDFLARE_TUNNEL_DOMAIN
    const formattedDomain = customDomain
      ? (customDomain.startsWith('http') ? customDomain : `https://${customDomain}`)
      : null

    // Jika sudah berjalan dan URL tersedia, kembalikan status saat ini
    if (this.status === 'connected' && this.publicUrl) {
      return this.getStatus()
    }

    // Jika proses lama menggantung, hentikan terlebih dahulu
    if (this.process) {
      this.stop()
    }

    this.status = 'starting'
    this.error = null
    this.publicUrl = null
    this.startedAt = new Date()

    const binPath = this.getBinaryPath()

    const args = token
      ? ['tunnel', 'run', '--token', token]
      : ['tunnel', '--url', `http://localhost:${port}`]

    return new Promise((resolve) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          if (!this.publicUrl) {
            this.status = 'error'
            this.error = 'Batas waktu pembuatan tunnel Cloudflare habis (30 detik).'
          }
          resolve(this.getStatus())
        }
      }, 30000)

      try {
        this.process = spawn(binPath, args, {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        const handleOutput = (chunk) => {
          const text = chunk.toString()

          // 1. Deteksi Quick Tunnel URL format: https://*.trycloudflare.com
          const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i)
          if (match && !this.publicUrl) {
            this.publicUrl = match[0]
            this.status = 'connected'
            this.error = null
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              resolve(this.getStatus())
            }
          }

          // 2. Deteksi Named Tunnel dengan Token (Cloudflare Zero Trust)
          if (token && (
            text.includes('Registered tunnel connection') ||
            text.includes('connIndex=') ||
            (text.includes('Connection') && text.includes('registered')) ||
            text.includes('Updated to new configuration')
          )) {
            this.publicUrl = formattedDomain || this.publicUrl || 'https://hub.mygameon.store'
            this.status = 'connected'
            this.error = null
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              resolve(this.getStatus())
            }
          }
        }

        if (this.process.stdout) {
          this.process.stdout.on('data', handleOutput)
        }
        if (this.process.stderr) {
          this.process.stderr.on('data', handleOutput)
        }

        this.process.on('error', (err) => {
          this.status = 'error'
          this.error = `Gagal menjalankan cloudflared: ${err.message}`
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            resolve(this.getStatus())
          }
        })

        this.process.on('close', (code) => {
          if (this.status === 'connected' || this.status === 'starting') {
            this.status = 'stopped'
            this.publicUrl = null
          }
          this.process = null
        })
      } catch (err) {
        this.status = 'error'
        this.error = err.message
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve(this.getStatus())
        }
      }
    })
  }

  stop() {
    if (this.process) {
      try {
        this.process.kill('SIGTERM')
        setTimeout(() => {
          if (this.process) {
            try { this.process.kill('SIGKILL') } catch (_) {}
          }
        }, 1000)
      } catch (_) {}
      this.process = null
    }
    this.status = 'stopped'
    this.publicUrl = null
    this.startedAt = null
    return this.getStatus()
  }
}

// Gunakan globalThis agar singleton tetap terjaga di Hot Module Reloading Next.js
if (!globalThis.__mygameonRemoteTunnel) {
  globalThis.__mygameonRemoteTunnel = new RemoteTunnelManager()
}

export const remoteTunnel = globalThis.__mygameonRemoteTunnel
