/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    serverExternalPackages: ['googleapis', 'mongoose'],
    allowedDevOrigins: [
      '*.trycloudflare.com',
      'localhost:3000',
      '127.0.0.1:3000',
      '192.168.*.*',
      '*.mygameon.store',
      'mygameon.store'
    ]
}

export default nextConfig