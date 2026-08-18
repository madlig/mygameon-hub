const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Baca .env.local secara manual untuk mengambil GH_TOKEN
const envPath = path.join(__dirname, '..', '.env.local');
let ghToken = null;

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().startsWith('GH_TOKEN=')) {
      ghToken = line.split('=')[1].trim();
      // Bersihkan tanda kutip jika ada
      if ((ghToken.startsWith('"') && ghToken.endsWith('"')) || (ghToken.startsWith("'") && ghToken.endsWith("'"))) {
        ghToken = ghToken.slice(1, -1);
      }
      break;
    }
  }
}

// Menyiapkan environment variable untuk electron-builder
const env = { ...process.env };
let commandArgs = [];

if (ghToken) {
  console.log('\x1b[32m%s\x1b[0m', '✅ GH_TOKEN ditemukan di .env.local. Auto Publish diaktifkan!');
  env.GH_TOKEN = ghToken;
  commandArgs = ['--publish', 'always'];
} else {
  console.log('\x1b[33m%s\x1b[0m', '⚠️ GH_TOKEN tidak ditemukan di .env.local. Build akan berjalan tanpa Auto Publish.');
}

// Menjalankan electron-builder
const builderPath = path.join(__dirname, '..', 'node_modules', '.bin', 'electron-builder' + (process.platform === 'win32' ? '.cmd' : ''));

console.log(`Menjalankan: electron-builder ${commandArgs.join(' ')}`);

const result = spawnSync(builderPath, commandArgs, {
  stdio: 'inherit',
  env: env,
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error('Gagal menjalankan electron-builder:', result.error);
  process.exit(1);
}

process.exit(result.status || 0);
