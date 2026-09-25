/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    serverExternalPackages: ['googleapis', 'mongoose']
}

export default nextConfig