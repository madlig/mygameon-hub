const fs = require('fs')
const path = require('path')

function resolveSymlinks(dir) {
    if (!fs.existsSync(dir)) return
    const files = fs.readdirSync(dir)
    for (const file of files) {
        const fullPath = path.join(dir, file)
        const stats = fs.lstatSync(fullPath)
        if (stats.isSymbolicLink()) {
            const realPath = fs.realpathSync(fullPath)
            fs.unlinkSync(fullPath)
            fs.cpSync(realPath, fullPath, { recursive: true })
            console.log(`Resolved symlink: ${fullPath}`)
        } else if (stats.isDirectory()) {
            resolveSymlinks(fullPath)
        }
    }
}

const standaloneDir = path.join(process.cwd(), '.next', 'standalone')
resolveSymlinks(standaloneDir)
console.log('All symlinks resolved successfully.')

// NEXT.JS STANDALONE FIX: Copy static files and public folder
// Server standalone tidak menyalin file statis secara otomatis
console.log('Copying static assets for standalone server...')

const publicSrc = path.join(process.cwd(), 'public')
const publicDest = path.join(standaloneDir, 'public')
if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true })
    console.log('Copied public/ to standalone/public/')
}

const staticSrc = path.join(process.cwd(), '.next', 'static')
const staticDest = path.join(standaloneDir, '.next', 'static')
if (fs.existsSync(staticSrc)) {
    // Pastikan folder .next ada di dalam standalone
    const standaloneNext = path.join(standaloneDir, '.next')
    if (!fs.existsSync(standaloneNext)) fs.mkdirSync(standaloneNext)
    
    fs.cpSync(staticSrc, staticDest, { recursive: true })
    console.log('Copied .next/static/ to standalone/.next/static/')
}

console.log('Build preparation complete.')
