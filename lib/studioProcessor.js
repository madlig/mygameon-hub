import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { google } from 'googleapis'
import connectToDatabase from './db.js'
import GameCatalog from '../models/GameCatalog.js'
import WorkspaceAccount from '../models/WorkspaceAccount.js'
import UploadHistory from '../models/UploadHistory.js'
import StudioTask from '../models/StudioTask.js'
import { suspendProcess, resumeProcess, killProcessTree } from './processControl.js'
import { sanitizeAndBrandGameFolder, detectPackageType } from './studioSanitizer.js'

async function getDriveClient(email) {
  await connectToDatabase();
  const account = await WorkspaceAccount.findOne({ email });
  if (!account || !account.refreshToken) {
    throw new Error(`Token tidak ditemukan untuk email: ${email}`);
  }
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: account.refreshToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

const STATE_FILE = path.join(process.cwd(), 'studio-state.json')

export function getJobState() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) } catch(e){}
  }
  return { status: 'idle', progress: 0, text: '', logs: [] }
}

export function updateState(newState, logMessage = null) {
  const current = getJobState()
  const updated = { ...current, ...newState, updatedAt: Date.now() }
  if (logMessage) {
    updated.logs = updated.logs || []
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
    updated.logs.push(`[${timestamp}] ${logMessage}`)
    if (updated.logs.length > 120) {
      updated.logs = updated.logs.slice(-120)
    }
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2))
}

// ── Studio Job Controller: Pengendali Pause, Resume, dan Cancel Operasi ──
class StudioJobController {
  constructor() {
    this.activeChild = null
    this.activeStream = null
    this.abortController = null
    this.isPaused = false
    this.isCancelled = false
    this.pausePromise = null
    this.resumeResolver = null
    this.jobType = null
  }

  startJob(jobType = 'process', details = {}) {
    this.reset()
    this.abortController = new AbortController()
    this.jobType = jobType
    this.details = details
  }

  reset() {
    this.activeChild = null
    this.activeStream = null
    this.abortController = null
    this.isPaused = false
    this.isCancelled = false
    this.pausePromise = null
    this.resumeResolver = null
    this.jobType = null
  }

  registerChild(child) {
    this.activeChild = child
  }

  unregisterChild(child) {
    if (this.activeChild === child) {
      this.activeChild = null
    }
  }

  registerStream(stream) {
    this.activeStream = stream
  }

  unregisterStream(stream) {
    if (this.activeStream === stream) {
      this.activeStream = null
    }
  }

  async checkPause() {
    if (this.isCancelled) {
      throw new Error('JOB_CANCELLED_BY_USER')
    }
    if (this.isPaused) {
      if (!this.pausePromise) {
        this.pausePromise = new Promise((resolve) => {
          this.resumeResolver = resolve
        })
      }
      await this.pausePromise
    }
    if (this.isCancelled) {
      throw new Error('JOB_CANCELLED_BY_USER')
    }
  }

  pause() {
    if (this.isCancelled) return { success: false, reason: 'Operasi sudah dibatalkan' }
    this.isPaused = true
    if (!this.pausePromise) {
      this.pausePromise = new Promise((resolve) => {
        this.resumeResolver = resolve
      })
    }

    // Suspend WinRAR child process jika aktif
    if (this.activeChild?.pid) {
      suspendProcess(this.activeChild.pid)
    }

    // Pause upload stream jika aktif
    if (this.activeStream && typeof this.activeStream.pause === 'function') {
      try { this.activeStream.pause() } catch (_) {}
    }

    const currentState = getJobState()
    const baseText = (currentState.text || '').replace(/^\[Dijeda\]\s*/, '')
    updateState({
      status: 'paused',
      text: `[Dijeda] ${baseText || 'Operasi dijeda oleh pengguna.'}`,
    }, 'Operasi dijeda oleh pengguna.')

    return { success: true, status: 'paused' }
  }

  resume() {
    if (!this.isPaused) return { success: false, reason: 'Operasi tidak sedang dijeda' }
    this.isPaused = false

    // Resume WinRAR child process jika aktif
    if (this.activeChild?.pid) {
      resumeProcess(this.activeChild.pid)
    }

    // Resume upload stream jika aktif
    if (this.activeStream && typeof this.activeStream.resume === 'function') {
      try { this.activeStream.resume() } catch (_) {}
    }

    if (this.resumeResolver) {
      this.resumeResolver()
      this.resumeResolver = null
      this.pausePromise = null
    }

    const currentState = getJobState()
    const cleanText = (currentState.text || '').replace(/^\[Dijeda\]\s*/, '')
    updateState({
      status: 'processing',
      text: cleanText || 'Melanjutkan proses...',
    }, 'Operasi dilanjutkan kembali oleh pengguna.')

    return { success: true, status: 'processing' }
  }

  cancel() {
    this.isCancelled = true
    this.isPaused = false

    if (this.resumeResolver) {
      this.resumeResolver()
      this.resumeResolver = null
      this.pausePromise = null
    }

    if (this.abortController) {
      try { this.abortController.abort() } catch (_) {}
    }

    if (this.activeChild?.pid) {
      killProcessTree(this.activeChild.pid)
      this.activeChild = null
    }

    if (this.activeStream && typeof this.activeStream.destroy === 'function') {
      try { this.activeStream.destroy() } catch (_) {}
      this.activeStream = null
    }

    updateState({
      status: 'cancelled',
      progress: 0,
      text: 'Proses dibatalkan oleh pengguna.',
      phase: 'cancelled',
    }, 'Pekerjaan dihentikan dan dibatalkan atas permintaan pengguna.')

    return { success: true, status: 'cancelled' }
  }

  getStatus() {
    return {
      isPaused: this.isPaused,
      isCancelled: this.isCancelled,
      hasActiveChild: !!this.activeChild,
      childPid: this.activeChild?.pid || null,
      hasActiveStream: !!this.activeStream,
    }
  }
}

export const activeJobController = globalThis.__activeJobController || (globalThis.__activeJobController = new StudioJobController())

// ── Mesin Diagnostik Error: Mengubah Error Mentah Menjadi Penyebab & Solusi Konkret ──
export function formatStudioError(err, context = {}) {
  const rawMsg = err?.message || String(err || 'Unknown error');
  const lowerMsg = rawMsg.toLowerCase();
  const email = context.email || 'workspace target';
  const game = context.gameName || context.folderName || 'game';
  const stage = context.stage || 'proses';

  // 1. Token Google Drive Kedaluwarsa / Tidak Ada
  if (
    lowerMsg.includes('invalid_grant') ||
    lowerMsg.includes('token tidak ditemukan') ||
    lowerMsg.includes('credentials missing') ||
    (lowerMsg.includes('unauthorized') && stage === 'upload')
  ) {
    return {
      category: 'AUTH_EXPIRED',
      title: 'Token Akun Google Drive Kedaluwarsa',
      cause: `Kredensial login OAuth untuk akun Google Drive "${email}" telah habis masa berlakunya atau izin akses telah dicabut.`,
      solution: `Buka menu "Akun Workspace" di navigasi samping, cari akun "${email}", lalu klik tombol "Login Ulang Akun" agar Studio dapat mengunggah file kembali.`,
      actionLink: '/accounts',
      actionLabel: 'Buka Menu Akun Workspace',
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 2. Limit Kuota Upload Harian Google Drive (750 GB/Hari) atau Storage Penuh
  if (
    lowerMsg.includes('userratelimitexceeded') ||
    lowerMsg.includes('quotaexceeded') ||
    lowerMsg.includes('storagelimitexceeded') ||
    (lowerMsg.includes('403') && (lowerMsg.includes('quota') || lowerMsg.includes('rate limit')))
  ) {
    return {
      category: 'DRIVE_QUOTA_EXCEEDED',
      title: 'Limit Kuota Google Drive Tercapai (750 GB/Hari)',
      cause: `Akun Google Drive "${email}" telah mencapai batas upload harian Google (~750 GB per 24 jam) atau ruang penyimpanan Drive akun ini sudah penuh.`,
      solution: `Alihkan target upload ke akun workspace cadangan lainnya yang masih memiliki sisa kuota, atau tunggu 12-24 jam hingga kuota di-reset otomatis oleh Google.`,
      actionLink: '/accounts',
      actionLabel: 'Pilih Workspace Lain',
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 3. Folder Target Drive Tidak Ditemukan / Izin Ditolak
  if (lowerMsg.includes('file not found') || (lowerMsg.includes('404') && stage === 'upload')) {
    return {
      category: 'FOLDER_NOT_FOUND',
      title: 'Folder Target Drive Tidak Ditemukan',
      cause: `Folder penyimpanan di Google Drive untuk "${game}" tidak ditemukan atau akun "${email}" tidak memiliki izin tulis ke folder tersebut.`,
      solution: `Periksa konfigurasi gameFolderId pada akun "${email}". Jika folder Drive sebelumnya telah dihapus, ubah ke folder lain atau sistem otomatis membuat folder di Root Drive.`,
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 4. WinRAR Exit Code 2: Fatal Error / Corrupt Archive
  if (lowerMsg.includes('exit code 2')) {
    return {
      category: 'WINRAR_CORRUPT',
      title: 'Arsip Game Rusak atau Ruang Disk Habis',
      cause: `WinRAR mendeteksi kerusakan fatal pada arsip "${game}" atau kapasitas ruang penyimpanan hard disk staging tidak cukup saat memproses data.`,
      solution: `Pastikan hard disk Anda memiliki ruang kosong minimal 2x dari ukuran game. Jika ruang cukup, ada kemungkinan file arsip yang didownload corrupt—silakan uji integritas file menggunakan WinRAR Test.`,
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 5. WinRAR Exit Code 3: CRC Checksum Error
  if (lowerMsg.includes('exit code 3') || lowerMsg.includes('crc error') || lowerMsg.includes('checksum')) {
    return {
      category: 'WINRAR_CRC',
      title: 'Checksum Error (CRC Mismatch)',
      cause: `Salah satu part arsip "${game}" mengalami kerusakan data (corrupt) saat proses download sehingga checksum gagal dicocokkan.`,
      solution: `Buka arsip di aplikasi WinRAR desktop untuk memeriksa part mana yang bertanda CRC Error, lalu download ulang spesifik file part tersebut.`,
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 6. WinRAR Exit Code 5 / Disk Penuh (ENOSPC)
  if (
    lowerMsg.includes('exit code 5') ||
    lowerMsg.includes('enospc') ||
    lowerMsg.includes('disk full') ||
    lowerMsg.includes('there is not enough space')
  ) {
    return {
      category: 'DISK_FULL',
      title: 'Kapasitas Hard Disk PC Penuh',
      cause: `Ruang kosong pada partisi hard disk tempat staging game tidak mencukupi untuk menyimpan hasil ekstraksi atau pembuatan part RAR.`,
      solution: `Hapus file sampah atau pindahkan game lama di drive PC Anda untuk menyediakan ruang kosong tambahan (rekomendasi sisa minimal 30–50 GB), lalu ulangi proses.`,
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 7. File Terkunci / Permission Denied (EPERM / EBUSY / Exit Code 6)
  if (
    lowerMsg.includes('exit code 6') ||
    lowerMsg.includes('eperm') ||
    lowerMsg.includes('ebusy') ||
    lowerMsg.includes('access is denied') ||
    lowerMsg.includes('permission denied')
  ) {
    return {
      category: 'FILE_LOCKED',
      title: 'File Terkunci atau Akses Ditolak',
      cause: `File arsip atau folder "${game}" sedang dibuka atau dikunci oleh proses lain di Windows (misalnya Windows Explorer, Game, atau Antivirus).`,
      solution: `Tutup folder game di File Explorer dan pastikan tidak ada program yang membukanya. Jika masih gagal, cek apakah antivirus Windows Defender sedang memblokir akses ke folder staging.`,
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 8. WinRAR Exit Code 8: Memory RAM Tidak Cukup
  if (lowerMsg.includes('exit code 8') || lowerMsg.includes('not enough memory') || lowerMsg.includes('out of memory')) {
    return {
      category: 'MEMORY_LIMIT',
      title: 'Memori RAM Tidak Cukup',
      cause: `WinRAR kehabisan alokasi RAM saat mencoba mengompresi file game dengan kamus kompresi besar.`,
      solution: `Buka pengaturan WinRAR di Studio, turunkan rasio kompresi (misal dari m5 ke m3 atau nonaktifkan Solid Archive), lalu coba kembali.`,
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 9. Masalah Jaringan / Koneksi Internet Terputus
  if (
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('socket hang up') ||
    lowerMsg.includes('koneksi tersendat')
  ) {
    return {
      category: 'NETWORK_ERROR',
      title: 'Koneksi Internet Terputus Saat Upload',
      cause: `Koneksi internet PC ke server Google Drive terputus atau mengalami timeout saat transfer part berlangsung.`,
      solution: `Pastikan jaringan internet PC Anda stabil. Sistem resume otomatis akan melanjutkan part yang belum terupload jika Anda menekan tombol "Coba Lagi".`,
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 10. File Part RAR Belum Ditemukan
  if (lowerMsg.includes('tidak ditemukan di folder lokal') || lowerMsg.includes('lakukan kompresi terlebih dahulu')) {
    return {
      category: 'ARCHIVE_NOT_FOUND',
      title: 'File Part RAR Belum Ditemukan',
      cause: `Folder game "${game}" masih berupa folder mentah dan belum memiliki arsip part RAR untuk diupload.`,
      solution: `Pilih aksi "Kompresi & Upload" atau lakukan "Mulai Arsip WinRAR Saja" terlebih dahulu untuk memecah game menjadi part 4100 MB.`,
      technical: rawMsg,
      occurredAt: new Date().toISOString(),
    };
  }

  // 11. Generic / Fallback Lainnya
  return {
    category: 'GENERAL_ERROR',
    title: 'Terjadi Kesalahan pada Proses Studio',
    cause: `Sistem mendeteksi error pada tahap ${stage}: ${rawMsg}`,
    solution: `Periksa log detail teknis di bawah. Jika masalah berlanjut, pastikan file lokal dalam kondisi baik dan coba restart proses.`,
    technical: rawMsg,
    occurredAt: new Date().toISOString(),
  };
}

// ── Helper: Resolusi Folder Target Upload (Mendukung ID Jamak/Koma) ──
export function resolveTargetFolderId(rawGameFolderId) {
  if (!rawGameFolderId || rawGameFolderId === 'root') return 'root';
  const ids = rawGameFolderId.split(',').map((id) => id.trim()).filter(Boolean);
  const nonRoot = ids.find((id) => id.toLowerCase() !== 'root');
  return nonRoot || 'root';
}

// ── Helper: Pembersihan Part Lama dengan Pacing (Anti-Limit 429) ──
async function cleanFolderContents(drive, folderId, onProgress) {
  let pageToken;
  const filesToDelete = [];

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'nextPageToken, files(id, name)',
    });
    filesToDelete.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  if (filesToDelete.length === 0) return 0;

  if (onProgress) onProgress(`Menghapus ${filesToDelete.length} part file versi lama di Google Drive...`);

  let deleted = 0;
  for (const file of filesToDelete) {
    try {
      await drive.files.delete({
        fileId: file.id,
        supportsAllDrives: true,
      });
      deleted++;
      // Jeda 50ms per file agar kuota request per detik aman
      await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      if (err.code !== 404) {
        console.warn(`Gagal hapus file lama ${file.name}:`, err.message);
      }
    }
  }
  return deleted;
}

// ── Helper: Salin Part Baru ke Folder Workspace Cadangan ──
async function copyPartsToBackupFolder(sourceDrive, targetDrive, sourceFolderId, targetFolderId, onProgress) {
  // 1. Bersihkan part lama di folder cadangan
  await cleanFolderContents(targetDrive, targetFolderId, onProgress);

  // 2. Baca part baru dari folder sumber
  let pageToken;
  const newFiles = [];
  do {
    const res = await sourceDrive.files.list({
      q: `'${sourceFolderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'nextPageToken, files(id, name, size)',
    });
    newFiles.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  let copied = 0;
  let totalBytes = 0;
  const concurrency = 2; // Pacing aman saat copy

  for (let i = 0; i < newFiles.length; i += concurrency) {
    const batch = newFiles.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (f) => {
        await targetDrive.files.copy({
          fileId: f.id,
          supportsAllDrives: true,
          requestBody: {
            name: f.name,
            parents: [targetFolderId],
          },
        });
        copied++;
        totalBytes += parseInt(f.size || 0, 10);
      })
    );
    if (onProgress) {
      onProgress(`Menyalin part ${copied}/${newFiles.length} ke folder cadangan...`);
    }
    // Jeda 100ms per batch
    await new Promise((r) => setTimeout(r, 100));
  }

  return { copied, totalBytes };
}

// ── Helper: Deteksi Path Executable WinRAR ──
// ── Helper: Deteksi Path Executable WinRAR ──
function getWinRarExecutable() {
  const candidates = [
    'C:\\Program Files\\WinRAR\\Rar.exe',
    'C:\\Program Files (x86)\\WinRAR\\Rar.exe',
    'C:\\Program Files\\WinRAR\\WinRAR.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('WinRAR (Rar.exe / WinRAR.exe) tidak ditemukan di C:\\Program Files\\WinRAR\\. Pastikan WinRAR terinstall.');
}

function getWinRarGuiExecutable() {
  const candidates = [
    'C:\\Program Files\\WinRAR\\WinRAR.exe',
    'C:\\Program Files (x86)\\WinRAR\\WinRAR.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ── Job: Ekstraksi Arsip (Extract / UnRAR) ──
export async function extractJob(archivePath, customOutputDir = null) {
  activeJobController.startJob('extract', { archivePath });

  let targetArchivePath = archivePath;
  let workingDir = path.dirname(archivePath);

  // Jika archivePath adalah folder fisik, temukan file arsip (.rar, .7z, .zip) di dalamnya
  if (fs.existsSync(archivePath) && fs.statSync(archivePath).isDirectory()) {
    workingDir = archivePath;
    const files = fs.readdirSync(archivePath);
    const part1Candidate = files.find((f) => /\.part0*1\.rar$/i.test(f));
    const anyArchiveCandidate = files.find((f) => /\.(rar|7z|zip)$/i.test(f));
    if (part1Candidate) {
      targetArchivePath = path.join(archivePath, part1Candidate);
    } else if (anyArchiveCandidate) {
      targetArchivePath = path.join(archivePath, anyArchiveCandidate);
    } else {
      // Fallback: Cek di folder induk (parent directory) jika part arsip berada di luar folder game
      try {
        const parentDir = path.dirname(archivePath);
        const folderBaseName = path.basename(archivePath);
        if (fs.existsSync(parentDir)) {
          const parentFiles = fs.readdirSync(parentDir);
          const parentPart1 = parentFiles.find(
            (f) => f.toLowerCase().startsWith(folderBaseName.toLowerCase()) && /\.part0*1\.rar$/i.test(f)
          );
          const parentAnyArchive = parentFiles.find(
            (f) => f.toLowerCase().startsWith(folderBaseName.toLowerCase()) && /\.(rar|7z|zip)$/i.test(f)
          );
          if (parentPart1) {
            targetArchivePath = path.join(parentDir, parentPart1);
            workingDir = parentDir;
          } else if (parentAnyArchive) {
            targetArchivePath = path.join(parentDir, parentAnyArchive);
            workingDir = parentDir;
          }
        }
      } catch (_) {}
    }
  }

  const archiveName = path.basename(targetArchivePath);
  let cleanGameName = archiveName
    .replace(/\.part0*1\.rar$/i, '')
    .replace(/\.(rar|7z|zip)$/i, '')
    .replace(/[-_.]?(SteamRIP(\.com)?|FitGirl|DODI|ElAmigos|TENOKE|RUNE|GOG|FLT|SKIDROW|CODEX)/gi, '')
    .replace(/[-_.]+/g, ' ')
    .trim();
  if (!cleanGameName) cleanGameName = path.basename(targetArchivePath).replace(/\.(rar|7z|zip)$/i, '').trim();

  // Multi-part detection: jika user memilih part 2, 3, dst, alihkan ke part 1
  if (/\.part0*[2-9]\.rar$/i.test(targetArchivePath) || /\.part[1-9][0-9]+\.rar$/i.test(targetArchivePath)) {
    const part1Candidate = targetArchivePath.replace(/\.part\d+\.rar$/i, (match) => {
      const numPart = match.match(/\d+/)[0];
      return `.part${'1'.padStart(numPart.length, '0')}.rar`;
    });
    if (fs.existsSync(part1Candidate)) {
      targetArchivePath = part1Candidate;
    }
  }

  const outputDir = customOutputDir || workingDir;

  updateState(
    { status: 'processing', phase: 'extracting', progress: 0, text: `Mempersiapkan Ekstraksi ${cleanGameName}...`, logs: [] },
    `Mempersiapkan ekstraksi arsip: ${path.basename(targetArchivePath)} ke folder: ${outputDir}`
  );

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const isRar = /\.rar$/i.test(targetArchivePath);
    const rarExe = isRar ? getWinRarExecutable() : (getWinRarGuiExecutable() || getWinRarExecutable());
    const isGuiTool = !isRar || rarExe.toLowerCase().endsWith('winrar.exe');

    const args = isGuiTool
      ? ['x', '-ibck', '-inul', '-y', '-o+', '-p-', targetArchivePath, outputDir + path.sep]
      : ['x', '-y', '-o+', '-p-', targetArchivePath, outputDir + path.sep];

    updateState(
      { text: `[WinRAR] Mengekstrak ${cleanGameName}...` },
      `Menjalankan ekstraksi: ${path.basename(rarExe)} x "${path.basename(targetArchivePath)}" ke "${outputDir}"`
    );

    await new Promise((resolve, reject) => {
      const child = spawn(rarExe, args, { cwd: workingDir });
      activeJobController.registerChild(child);

      if (!isGuiTool) {
        child.stdout.on('data', (data) => {
          if (activeJobController.isCancelled) return;
          const str = data.toString();
          const match = str.match(/(\d+)%/g);
          if (match) {
            const last = match[match.length - 1];
            const pct = parseInt(last.replace('%', ''), 10);
            updateState({ progress: pct, text: `[WinRAR] Mengekstrak ${cleanGameName}... ${pct}%` });
            if (pct === 25 || pct === 50 || pct === 75 || pct === 100) {
              const currentLogs = getJobState().logs || [];
              const lastLog = currentLogs[currentLogs.length - 1] || '';
              if (!lastLog.includes(`${pct}%`)) {
                updateState({}, `Ekstraksi ${cleanGameName} mencapai ${pct}%`);
              }
            }
          }
        });
      } else {
        let pulsePct = 10;
        const timer = setInterval(() => {
          if (activeJobController.isCancelled) {
            clearInterval(timer);
            return;
          }
          if (activeJobController.isPaused) return;
          pulsePct = Math.min(pulsePct + 5, 90);
          updateState({ progress: pulsePct, text: `[WinRAR] Mengekstrak ${cleanGameName} (${pulsePct}%)...` });
        }, 3000);
        child.on('close', () => clearInterval(timer));
      }

      child.stderr.on('data', (data) => {
        if (!activeJobController.isCancelled) {
          console.error('WinRAR Extract Err:', data.toString());
        }
      });

      child.on('close', (code) => {
        activeJobController.unregisterChild(child);
        if (activeJobController.isCancelled) {
          resolve({ cancelled: true });
          return;
        }
        if (code === 0 || code === 1) {
          updateState({ progress: 100, text: `[WinRAR] Ekstraksi ${cleanGameName} selesai 100%.` });
          resolve();
        } else {
          reject(new Error(`WinRAR gagal mengekstrak dengan exit code ${code}. Cek integritas file arsip.`));
        }
      });

      child.on('error', (err) => {
        activeJobController.unregisterChild(child);
        if (activeJobController.isCancelled) {
          resolve({ cancelled: true });
        } else {
          reject(err);
        }
      });
    });

    if (activeJobController.isCancelled) {
      return { cancelled: true };
    }

    updateState(
      {
        status: 'success',
        phase: 'done',
        progress: 100,
        text: `Berhasil! Folder ${cleanGameName} siap digunakan.`,
      },
      `Ekstraksi selesai dengan sukses ke: ${outputDir}`
    );

    return { outputDir, cleanGameName };
  } catch (err) {
    if (activeJobController.isCancelled || err.message === 'JOB_CANCELLED_BY_USER') {
      updateState(
        { status: 'cancelled', progress: 0, text: 'Ekstraksi dibatalkan oleh pengguna.', phase: 'cancelled' },
        `Ekstraksi ${cleanGameName} dihentikan dan dibatalkan atas permintaan pengguna.`
      );
      return { cancelled: true };
    }
    console.error('Extract Process Error:', err);
    const errorDetail = formatStudioError(err, { stage: 'extract', gameName: cleanGameName, folderPath: targetArchivePath });
    updateState(
      { status: 'error', progress: 0, text: `Gagal: ${errorDetail.title}`, errorDetail },
      `ERROR EKSTRAKSI: ${errorDetail.title} - ${errorDetail.cause}`
    );
    throw err;
  }
}

// ── Helper: Deteksi File Part Arsip dengan Regex Presisi & Normalisasi ──
function getArchivePartFiles(directory, baseGameName) {
  if (!fs.existsSync(directory)) return [];
  const escaped = baseGameName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}(\\.part\\d+)?\\.(rar|7z|zip|r\\d+)$`, 'i');
  const normBase = String(baseGameName || '').toLowerCase().replace(/[-_.\s+]+/g, '');

  try {
    const allFiles = fs.readdirSync(directory);
    const matchedFiles = allFiles.filter((f) => {
      if (!/\.(rar|7z|zip|r\d+|part\d+\.rar)$/i.test(f)) return false;
      if (regex.test(f)) return true;
      const fBase = f.replace(/\.part\d+\.(rar|7z|zip)$/i, '').replace(/\.(rar|7z|zip|r\d+)$/i, '');
      const normF = String(fBase || '').toLowerCase().replace(/[-_.\s+]+/g, '');
      return normF === normBase || (normBase.length >= 3 && (normF.startsWith(normBase) || normBase.startsWith(normF)));
    });

    matchedFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const hasParts = matchedFiles.some((f) => /\.part\d+\./i.test(f));
    if (hasParts) {
      return matchedFiles.filter((f) => /\.part\d+\./i.test(f));
    }
    return matchedFiles;
  } catch (_) {
    return [];
  }
}

// ── Job: Kompresi & Split Part WinRAR ──
export async function archiveJob(folderPath, config = {}) {
  activeJobController.startJob('archive', { folderPath });
  const cleanFolderPath = folderPath.replace(/[/\\]+$/, '');
  const folderName = path.basename(cleanFolderPath);
  const baseDir = path.dirname(cleanFolderPath);

  updateState(
    { status: 'processing', phase: 'archiving', progress: 0, text: 'Memulai Kompresi WinRAR...', logs: [] },
    `Mempersiapkan kompresi untuk folder: ${folderName}`
  );

  try {
    // 🛡️ Sanitasi File Sampah & Injeksi Branding MyGameON
    let formatInfo = null;
    try {
      const sanitizeResult = sanitizeAndBrandGameFolder(cleanFolderPath);
      formatInfo = sanitizeResult;
      if (sanitizeResult.deletedFiles.length > 0) {
        updateState(
          {},
          `[Sanitizer] Menghapus ${sanitizeResult.deletedFiles.length} berkas pihak ketiga: ${sanitizeResult.deletedFiles.join(', ')}`
        );
      }
      updateState(
        {},
        `[Branding] Aset resmi MyGameON disematkan (${sanitizeResult.displayBadge}).`
      );
    } catch (sanErr) {
      console.warn('[Sanitizer Warning]', sanErr.message);
    }

    const rarExe = getWinRarExecutable();
    const outputRar = path.join(baseDir, `${folderName}.rar`);

    // Flag WinRAR:
    // a: add to archive
    // -y: assume yes on all queries
    // -ep1: exclude base dir from names (file tersusun rapi)
    // -o+: overwrite existing parts
    const splitMb = config.splitSize || 4100;
    const compMode = config.compression || 'm5';

    const args = ['a', '-y', '-ep1', `-o+`];
    args.push(`-${compMode}`);
    args.push(`-v${splitMb}m`);
    if (config.solid !== false) args.push('-s');
    if (config.recoveryRecord !== false) args.push('-rr5p');

    args.push(outputRar);
    args.push(folderName);

    updateState(
      { text: `Menyiapkan kompresi split (${splitMb} MB/part) untuk: ${folderName}` },
      `Menjalankan: Rar.exe ${args.join(' ')}`
    );

    await new Promise((resolve, reject) => {
      const child = spawn(rarExe, args, { cwd: baseDir });
      activeJobController.registerChild(child);

      child.stdout.on('data', (data) => {
        if (activeJobController.isCancelled) return;
        const str = data.toString();
        const match = str.match(/(\d+)%/g);
        if (match) {
          const last = match[match.length - 1];
          const pct = parseInt(last.replace('%', ''), 10);
          updateState({ progress: pct, text: `[WinRAR] Mengompresi ${folderName}... ${pct}%` });
          if (pct === 25 || pct === 50 || pct === 75 || pct === 100) {
            const currentLogs = getJobState().logs || [];
            const lastLog = currentLogs[currentLogs.length - 1] || '';
            if (!lastLog.includes(`${pct}%`)) {
              updateState({}, `Kompresi WinRAR mencapai ${pct}%`);
            }
          }
        }
      });

      child.stderr.on('data', (data) => {
        if (!activeJobController.isCancelled) {
          console.error('WinRAR Err:', data.toString());
        }
      });

      child.on('close', (code) => {
        activeJobController.unregisterChild(child);
        if (activeJobController.isCancelled) {
          resolve({ cancelled: true });
          return;
        }
        if (code === 0 || code === 1) {
          updateState({ progress: 100, text: `[WinRAR] Kompresi ${folderName} 100% selesai.` });
          resolve();
        } else {
          reject(new Error(`WinRAR gagal dengan exit code ${code}. Cek log server.`));
        }
      });

      child.on('error', (err) => {
        activeJobController.unregisterChild(child);
        if (activeJobController.isCancelled) {
          resolve({ cancelled: true });
        } else {
          reject(err);
        }
      });
    });

    if (activeJobController.isCancelled) {
      return { cancelled: true };
    }

    updateState(
      { status: 'success', phase: 'done', progress: 100, text: `Berhasil! Kompresi ${folderName} selesai.` },
      `Kompresi WinRAR selesai dengan sukses.`
    );
  } catch (err) {
    if (activeJobController.isCancelled || err.message === 'JOB_CANCELLED_BY_USER') {
      updateState(
        { status: 'cancelled', progress: 0, text: 'Kompresi dibatalkan oleh pengguna.', phase: 'cancelled' },
        `Kompresi ${folderName} dihentikan dan dibatalkan atas permintaan pengguna.`
      );
      return { cancelled: true };
    }
    console.error('Archive Process Error:', err);
    const errorDetail = formatStudioError(err, { stage: 'archive', folderName: folderName, folderPath: cleanFolderPath });
    updateState(
      { status: 'error', progress: 0, text: `Gagal: ${errorDetail.title}`, errorDetail },
      `ERROR KOMPRESI: ${errorDetail.title} - ${errorDetail.cause}`
    );
    throw err;
  }
}

export async function uploadJob(folderPath, targetEmail, config = {}, options = {}) {
  activeJobController.startJob('upload', { folderPath, targetEmail });
  const isUpdateMode = options.mode === 'update';
  const autoPropagate = !!options.autoPropagate;
  const cleanReplace = options.cleanReplace !== false;
  const cleanFolderPath = folderPath.replace(/[/\\]+$/, '');
  const localBaseName = path.basename(cleanFolderPath).replace(/\.(rar|7z|zip)$/i, '');
  const initialCatalogTitle = options.customTitle || options.gameName || localBaseName;
  let finalCatalogName = (initialCatalogTitle || localBaseName).replace(/[\\/:*?"<>|]/g, '').trim() || localBaseName;

  updateState(
    { status: 'processing', phase: 'uploading', progress: 0, text: 'Mempersiapkan Upload...', logs: [] },
    `Memulai upload (${isUpdateMode ? 'MODE UPDATE VERSI' : 'MODE GAME BARU'}) untuk folder: ${path.basename(folderPath)} ke ${targetEmail}`
  );

  try {
    await connectToDatabase();
    const isDir = fs.existsSync(cleanFolderPath) && fs.statSync(cleanFolderPath).isDirectory();
    const dir = path.dirname(cleanFolderPath);
    let isTemporaryArchive = false;

    // Filter file yang persis diawali nama item lokal dan berformat .rar / part
    let parts = getArchivePartFiles(dir, localBaseName);

    // Cek juga jika part ada di DALAM folder game itu sendiri
    if (parts.length === 0 && isDir) {
      const insideParts = getArchivePartFiles(cleanFolderPath, localBaseName);
      if (insideParts.length > 0) {
        const hasActualParts = insideParts.some((p) => /\.part\d+\./i.test(p));
        if (hasActualParts) {
          parts = insideParts;
        }
      }
    }

    // Jika raw folder dan belum ada part RAR sama sekali (atau forceArchive diminta), jalankan kompresi split otomatis terlebih dahulu
    const shouldArchive = (parts.length === 0 && isDir) || (options.forceArchive && isDir);
    if (shouldArchive) {
      isTemporaryArchive = true;
      updateState({ text: `Mengompresi folder ${localBaseName} sebelum upload...` }, `Otomatis membuat arsip WinRAR untuk ${localBaseName}...`);
      await archiveJob(cleanFolderPath, config);
      parts = getArchivePartFiles(dir, localBaseName);
    }

    if (parts.length === 0) {
      throw new Error(`File RAR untuk '${localBaseName}' tidak ditemukan di folder lokal! Lakukan kompresi terlebih dahulu.`);
    }

    let totalBytesAllParts = 0;
    for (const p of parts) {
      let pPath = path.join(dir, p);
      if (!fs.existsSync(pPath) && isDir) pPath = path.join(cleanFolderPath, p);
      if (fs.existsSync(pPath)) {
        try { totalBytesAllParts += fs.statSync(pPath).size; } catch (_) {}
      }
    }

    updateState({
      status: 'processing',
      phase: 'uploading',
      progress: 0,
      overallProgress: 0,
      currentPart: 1,
      totalParts: parts.length,
      totalBytesUploaded: 0,
      totalBytesNeeded: totalBytesAllParts,
      gameName: finalCatalogName,
      fileVersion: options.fileVersion || '',
      targetEmail,
      updatedAt: Date.now(),
    }, `Ditemukan ${parts.length} file part siap upload.`);

    const drive = await getDriveClient(targetEmail);
    let driveFolderId = null;

    // ── 1. Penentuan Folder Target Google Drive ──
    if (isUpdateMode) {
      // Mode Update: Ambil ID folder lama yang sudah ada di database atau options
      if (options.targetFolderId) {
        driveFolderId = options.targetFolderId;
      } else {
        const existingCat = await GameCatalog.findOne({ name: initialCatalogTitle, ownerEmail: targetEmail }).lean();
        if (existingCat?.folderId) {
          driveFolderId = existingCat.folderId;
        }
      }

      if (!driveFolderId) {
        throw new Error(`Game '${initialCatalogTitle}' tidak ditemukan di katalog ${targetEmail} untuk diupdate. Gunakan Mode Game Baru.`);
      }

      // Ambil nama katalog existing jika tidak ada customTitle eksplisit
      if (!options.customTitle) {
        const catInfo = await GameCatalog.findOne({ folderId: driveFolderId }).lean();
        if (catInfo?.name) {
          finalCatalogName = catInfo.name;
        }
      }

      // Opsi Clean Replace vs Additive
      if (cleanReplace) {
        updateState(
          { text: `[Clean Replace] Membersihkan file lama di folder: ${finalCatalogName}...` },
          `Membersihkan seluruh part versi lama di folder Drive ID: ${driveFolderId}...`
        );
        const deletedCount = await cleanFolderContents(drive, driveFolderId, (msg) => updateState({}, msg));
        updateState({}, `Pembersihan selesai (${deletedCount} file lama dibersihkan). ID Folder tetap sama.`);
      } else {
        updateState(
          { text: `[Additive Upload] Mengunggah ke folder: ${finalCatalogName}...` },
          `Mode Additive aktif: part baru akan diunggah ke Drive ID: ${driveFolderId} tanpa menghapus file lama.`
        );
      }
    } else {
      // Mode Baru: Buat folder baru di dalam gameFolderId workspace (atau sambung ke folder yang sudah ada jika terputus)
      // 1. Cek langsung jika targetFolderId disediakan dari hasil Resume Pre-check
      if (options.targetFolderId) {
        try {
          const directCheck = await drive.files.get({
            fileId: options.targetFolderId,
            fields: 'id, name, trashed',
            supportsAllDrives: true,
          });
          if (directCheck.data?.id && !directCheck.data.trashed) {
            driveFolderId = directCheck.data.id;
            if (options.forceWipeExisting) {
              updateState(
                { text: `[Mulai Ulang] Membersihkan part lama di folder Drive: '${directCheck.data.name}'...` },
                `Membersihkan seluruh file di folder Drive ID: ${driveFolderId} sesuai kebijakan Mulai Ulang...`
              );
              await cleanFolderContents(drive, driveFolderId, (msg) => updateState({}, msg));
            } else {
              updateState({}, `[Resume Upload] Menggunakan folder Google Drive yang sudah ada: '${directCheck.data.name}' (ID: ${driveFolderId}). Melanjutkan upload part...`);
            }
          }
        } catch (_) {}
      }

      if (!driveFolderId) {
        const acc = await WorkspaceAccount.findOne({ email: targetEmail }).lean();
        const targetGameFolderId = resolveTargetFolderId(acc?.gameFolderId);

        // Cek apakah folder dengan nama ini sudah ada di target folder Drive (misal dari sesi sebelum restart PC)
        let existingDriveFolder = null;
        try {
          const searchRes = await drive.files.list({
            q: `'${targetGameFolderId}' in parents and name = '${finalCatalogName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
          existingDriveFolder = searchRes.data.files?.[0];
        } catch (_) {}

      if (!existingDriveFolder && targetGameFolderId !== 'root') {
        try {
          const rootRes = await drive.files.list({
            q: `'root' in parents and name = '${finalCatalogName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
          existingDriveFolder = rootRes.data.files?.[0];
        } catch (_) {}
      }

      if (existingDriveFolder) {
        driveFolderId = existingDriveFolder.id;
        if (options.forceWipeExisting) {
          updateState(
            { text: `[Mulai Ulang] Membersihkan part lama di folder Drive: '${finalCatalogName}'...` },
            `Membersihkan seluruh file di folder Drive ID: ${driveFolderId} sesuai kebijakan Mulai Ulang...`
          );
          await cleanFolderContents(drive, driveFolderId, (msg) => updateState({}, msg));
        } else {
          updateState({}, `Menemukan folder '${finalCatalogName}' yang sudah ada di Drive (ID: ${driveFolderId}). Melanjutkan upload part...`);
        }
      } else {
        updateState({}, `Membuat folder baru '${finalCatalogName}' di workspace ${targetEmail}...`);
        let folderRes;
        try {
          folderRes = await drive.files.create({
            supportsAllDrives: true,
            requestBody: {
              name: finalCatalogName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [targetGameFolderId],
            },
            fields: 'id',
          });
        } catch (createErr) {
          if (createErr.message?.includes('File not found') && targetGameFolderId !== 'root') {
            updateState({}, `Folder target (${targetGameFolderId}) tidak ditemukan di Drive. Mengalihkan ke folder Root...`);
            folderRes = await drive.files.create({
              supportsAllDrives: true,
              requestBody: {
                name: finalCatalogName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: ['root'],
              },
              fields: 'id',
            });
          } else {
            throw createErr;
          }
        }
        driveFolderId = folderRes.data.id;
      }
    }
  }

    // ── Sinkronisasi Status Awal ke MongoDB GameCatalog (pipelineStatus: 'uploading') ──
    try {
      await GameCatalog.findOneAndUpdate(
        { folderId: driveFolderId },
        {
          $set: {
            name: finalCatalogName,
            folderId: driveFolderId,
            ownerEmail: targetEmail,
            driveWorkspaceEmail: targetEmail,
            pipelineStatus: 'uploading',
            uploadMode: options.mode || 'new',
            lastSyncedAt: new Date(),
            ...(options.fileVersion ? { fileVersion: options.fileVersion } : {}),
          },
        },
        { upsert: true }
      );
    } catch (syncErr) {
      console.warn('[GameCatalog Initial Sync Warning]', syncErr.message);
    }

    // ── 2. Direct Resumable Upload dengan Auto-Retry ──
    let currentPart = 1;
    let totalBytesUploaded = 0;

    // Cache daftar file yang sudah ada di folder Drive (1x call untuk performa instan)
    const existingDriveFilesMap = new Map();
    try {
      const existingFilesRes = await drive.files.list({
        q: `'${driveFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, size)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 1000,
      });
      for (const f of existingFilesRes.data.files || []) {
        if (f.name) existingDriveFilesMap.set(f.name.toLowerCase(), f);
      }
    } catch (_) {}

    for (const partName of parts) {
      await activeJobController.checkPause();

      // Tentukan path part: bisa di dir parent atau di dalam folderPath
      let partPath = path.join(dir, partName);
      if (!fs.existsSync(partPath) && isDir) {
        partPath = path.join(folderPath, partName);
      }

      const stat = fs.statSync(partPath);
      const fileSize = stat.size;

      // Filter seleksi part jika operator memilih hanya part tertentu
      if (Array.isArray(options.selectedParts) && options.selectedParts.length > 0 && !options.selectedParts.includes(partName)) {
        updateState(
          { progress: 100, text: `[Dikecualikan] Part ${currentPart}/${parts.length} (${partName}) tidak dipilih.` },
          `Part ${partName} dilewati karena tidak dipilih dalam daftar seleksi part.`
        );
        currentPart++;
        continue;
      }

      const isResume = options.resume !== false;

      // Cek apakah part ini sudah pernah terupload dengan ukuran identik di Google Drive
      const existingPart = existingDriveFilesMap.get(partName.toLowerCase());
      if (isResume && existingPart && parseInt(existingPart.size, 10) === fileSize) {
        totalBytesUploaded += fileSize;
        const overallPct = totalBytesAllParts > 0 ? Math.min(100, Math.round((totalBytesUploaded / totalBytesAllParts) * 100)) : 100;
        updateState(
          {
            progress: 100,
            overallProgress: overallPct,
            currentPart,
            totalParts: parts.length,
            currentPartName: partName,
            currentPartBytes: fileSize,
            currentPartTotalBytes: fileSize,
            totalBytesUploaded,
            totalBytesNeeded: totalBytesAllParts,
            gameName: finalCatalogName,
            targetEmail,
            driveFolderId,
            text: `[Lewati] Part ${currentPart}/${parts.length} (${partName}) sudah ada di Drive.`,
            updatedAt: Date.now(),
          },
          `Part ${partName} (${Math.round(fileSize / 1024 / 1024)} MB) sudah lengkap di Drive (dilewati).`
        );
        currentPart++;
        continue;
      }

      // Jika file part ada di Drive tetapi ukurannya tidak cocok atau resume=false, bersihkan dulu dari Drive
      if (existingPart && (!isResume || parseInt(existingPart.size, 10) !== fileSize)) {
        try {
          await drive.files.delete({ fileId: existingPart.id, supportsAllDrives: true }).catch(() => {});
        } catch (_) {}
      }

      updateState(
        {
          progress: 0,
          currentPart,
          totalParts: parts.length,
          currentPartName: partName,
          currentPartBytes: 0,
          currentPartTotalBytes: fileSize,
          totalBytesUploaded,
          totalBytesNeeded: totalBytesAllParts,
          gameName: finalCatalogName,
          targetEmail,
          driveFolderId,
          text: `[Upload] Part ${currentPart} dari ${parts.length} (${partName})`,
          updatedAt: Date.now(),
        },
        `Mengunggah ${partName} (${Math.round(fileSize / 1024 / 1024)} MB)...`
      );

      // Upload dengan retry hingga 3 kali
      let uploaded = false;
      let attempt = 0;

      while (!uploaded && attempt < 3) {
        await activeJobController.checkPause();
        attempt++;
        let readStream = null;

        try {
          if (attempt > 1) {
            // Bersihkan file parsial sisa percobaan gagal sebelumnya dari Google Drive
            try {
              const prevFiles = await drive.files.list({
                q: `'${driveFolderId}' in parents and name = '${partName}' and trashed = false`,
                fields: 'files(id)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
              });
              for (const pf of prevFiles.data.files || []) {
                await drive.files.delete({ fileId: pf.id, supportsAllDrives: true }).catch(() => {});
              }
            } catch (_) {}
          }

          readStream = fs.createReadStream(partPath);
          activeJobController.registerStream(readStream);

          let lastBytes = 0;
          let lastTime = Date.now();
          let currentSpeedMB = null;

          await drive.files.create(
            {
              supportsAllDrives: true,
              requestBody: {
                name: partName,
                parents: [driveFolderId],
              },
              media: {
                body: readStream,
              },
            },
            {
              signal: activeJobController.abortController?.signal,
              onUploadProgress: (evt) => {
                if (activeJobController.isPaused || activeJobController.isCancelled) return;
                const now = Date.now();
                const deltaMs = now - lastTime;
                if (deltaMs >= 1200) {
                  const bytesDiff = evt.bytesRead - lastBytes;
                  const bytesPerSec = (bytesDiff / deltaMs) * 1000;
                  currentSpeedMB = (bytesPerSec / (1024 * 1024)).toFixed(1);
                  lastBytes = evt.bytesRead;
                  lastTime = now;
                }
                const pct = Math.round((evt.bytesRead / fileSize) * 100);
                const overallTransferred = totalBytesUploaded + evt.bytesRead;
                const overallPct = totalBytesAllParts > 0 ? Math.min(100, Math.round((overallTransferred / totalBytesAllParts) * 100)) : pct;
                const speedVal = currentSpeedMB ? parseFloat(currentSpeedMB) : null;
                const speedBytesPerSec = speedVal ? speedVal * 1024 * 1024 : 0;
                const bytesRemaining = Math.max(0, totalBytesAllParts - overallTransferred);
                const etaSeconds = speedBytesPerSec > 0 ? Math.round(bytesRemaining / speedBytesPerSec) : null;
                const speedStr = currentSpeedMB ? ` • ${currentSpeedMB} MB/s` : '';

                updateState({
                  progress: pct,
                  overallProgress: overallPct,
                  text: `[Upload] Part ${currentPart}/${parts.length} (${partName}): ${pct}%${speedStr}`,
                  speedMBps: speedVal,
                  etaSeconds,
                  currentPart,
                  totalParts: parts.length,
                  currentPartName: partName,
                  currentPartBytes: evt.bytesRead,
                  currentPartTotalBytes: fileSize,
                  totalBytesUploaded: overallTransferred,
                  totalBytesNeeded: totalBytesAllParts,
                  gameName: finalCatalogName,
                  targetEmail,
                  driveFolderId,
                  updatedAt: Date.now(),
                });
              },
            }
          );

          activeJobController.unregisterStream(readStream);
          uploaded = true;
        } catch (uploadErr) {
          if (readStream) {
            activeJobController.unregisterStream(readStream);
          }
          if (activeJobController.isCancelled || uploadErr.name === 'AbortError' || uploadErr.message?.includes('aborted')) {
            throw new Error('JOB_CANCELLED_BY_USER');
          }
          console.warn(`Percobaan upload ${partName} ke-${attempt} gagal:`, uploadErr.message);
          if (attempt >= 3) {
            throw new Error(`Gagal mengunggah ${partName} setelah 3x percobaan: ${uploadErr.message}`);
          }
          updateState({}, `Koneksi tersendat pada ${partName}. Mencoba ulang (${attempt}/3) dalam 3 detik...`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      totalBytesUploaded += fileSize;
      const finishedOverallPct = totalBytesAllParts > 0 ? Math.min(100, Math.round((totalBytesUploaded / totalBytesAllParts) * 100)) : 100;
      updateState(
        {
          progress: 100,
          overallProgress: finishedOverallPct,
          currentPart,
          totalParts: parts.length,
          currentPartName: partName,
          totalBytesUploaded,
          totalBytesNeeded: totalBytesAllParts,
          text: `[Selesai] Part ${currentPart}/${parts.length} (${partName}) berhasil diunggah.`,
          updatedAt: Date.now(),
        },
        `Selesai upload ${partName} (${Math.round(fileSize / 1024 / 1024)} MB).`
      );
      currentPart++;
      await activeJobController.checkPause();
    }

    // ── 3. Update Database GameCatalog Utama ──
    updateState(
      { phase: 'finishing', progress: 100, text: 'Memperbarui database katalog...' },
      `Mencatat data ke Database (Total size: ${Math.round(totalBytesUploaded / 1024 / 1024)} MB)`
    );

    const detectedPackage = isDir ? detectPackageType(cleanFolderPath).packageType : (options.packageType || 'PRE-INSTALLED');

    await GameCatalog.findOneAndUpdate(
      { folderId: driveFolderId },
      {
        $set: {
          name: finalCatalogName,
          folderId: driveFolderId,
          ownerEmail: targetEmail,
          fileCount: parts.length,
          totalSize: totalBytesUploaded,
          packageType: detectedPackage || 'PRE-INSTALLED',
          lastSyncedAt: new Date(),
          pipelineStatus: 'on_drive',
          lastUploadedAt: new Date(),
          uploadMode: options.mode || 'new',
          driveWorkspaceEmail: targetEmail,
          ...(options.fileVersion ? { fileVersion: options.fileVersion } : {}),
        },
      },
      { upsert: true, new: true }
    );

    // Catat ke UploadHistory
    await UploadHistory.create({
      gameName: finalCatalogName,
      workspaceEmail: targetEmail,
      totalSize: totalBytesUploaded,
      fileCount: parts.length,
      fileVersion: options.fileVersion || '',
      uploadedAt: new Date(),
    });

    // Otomatis selesaikan StudioTask yang cocok jika ada
    try {
      await StudioTask.findOneAndUpdate({ title: finalCatalogName }, { $set: { isUploaded: true } });
    } catch (_) {}

    // ── 4. Multi-Workspace Auto-Propagation (Propagasi Antre Berkala) ──
    if (autoPropagate) {
      updateState(
        { text: `[Auto-Sync] Memeriksa folder cadangan di workspace lain...` },
        `Memulai propagasi otomatis untuk game: ${finalCatalogName}...`
      );

      // Cari seluruh entri game dengan judul yang sama di workspace cadangan
      const backupCatalogs = await GameCatalog.find({
        name: finalCatalogName,
        ownerEmail: { $ne: targetEmail },
      }).lean();

      if (backupCatalogs.length > 0) {
        updateState({}, `Ditemukan ${backupCatalogs.length} workspace cadangan. Memulai sinkronisasi berurutan...`);

        for (let i = 0; i < backupCatalogs.length; i++) {
          await activeJobController.checkPause();
          const bCat = backupCatalogs[i];

          // Jeda waterfall 1.5 detik antar-workspace untuk menjaga kuota aman
          await new Promise((r) => setTimeout(r, 1500));
          await activeJobController.checkPause();

          updateState(
            { text: `[Auto-Sync ${i + 1}/${backupCatalogs.length}] Menyinkronkan ke ${bCat.ownerEmail}...` },
            `Memproses workspace cadangan: ${bCat.ownerEmail}...`
          );

          try {
            const backupDrive = await getDriveClient(bCat.ownerEmail);

            // Bagikan akses folder primer ke akun cadangan sebagai reader
            try {
              await drive.permissions.create({
                fileId: driveFolderId,
                supportsAllDrives: true,
                sendNotificationEmail: false,
                requestBody: { role: 'reader', type: 'user', emailAddress: bCat.ownerEmail },
              });
            } catch (shareErr) {
              console.warn('Propagation share warning:', shareErr.message);
            }

            // Bersihkan dan salin part baru ke folder cadangan
            const { copied, totalBytes } = await copyPartsToBackupFolder(
              drive,
              backupDrive,
              driveFolderId,
              bCat.folderId,
              (msg) => updateState({}, `[Sync ${bCat.ownerEmail}] ${msg}`)
            );

            // Update katalog workspace cadangan
            await GameCatalog.findByIdAndUpdate(bCat._id, {
              fileCount: copied,
              totalSize: totalBytes,
              lastSyncedAt: new Date(),
            });

            updateState({}, `✓ Berhasil memperbarui ${bCat.ownerEmail} (${copied} part).`);
          } catch (syncErr) {
            updateState({}, `⚠ Gagal memperbarui cadangan di ${bCat.ownerEmail}: ${syncErr.message}`);
          }
        }
      } else {
        updateState({}, `Tidak ada workspace cadangan lain yang terdaftar untuk game '${finalCatalogName}'.`);
      }
    }

    // ── 5. Bersihkan File RAR Lokal (Hanya jika dibuat sementara untuk upload ini) ──
    if (isTemporaryArchive) {
      updateState({}, `Membersihkan file RAR sementara hasil kompresi di folder lokal...`);
      for (const partName of parts) {
        try {
          const p1 = path.join(dir, partName);
          if (fs.existsSync(p1)) fs.unlinkSync(p1);
          const p2 = path.join(cleanFolderPath, partName);
          if (fs.existsSync(p2)) fs.unlinkSync(p2);
        } catch (_) {}
      }
    }

    // ── 6. Auto-Delete Folder Lokal (Jika Dicentang) ──
    if (config.autoDelete) {
      updateState({}, `Mode Auto-Delete aktif. Menghapus folder lokal: ${localBaseName}...`);
      try {
        fs.rmSync(cleanFolderPath, { recursive: true, force: true });
        updateState({}, `Folder lokal berhasil dibersihkan.`);
      } catch (e) {
        updateState({}, `Gagal menghapus folder lokal: ${e.message}`);
      }
    }

    // ── 7. Selesai Total ──
    updateState(
      {
        status: 'success',
        phase: 'done',
        progress: 100,
        text: `Berhasil! ${parts.length} part selesai diupload${options.fileVersion ? ` (${options.fileVersion})` : ''}${autoPropagate ? ' & disinkronkan ke seluruh workspace' : ''}.`,
        gameName: finalCatalogName,
        fileVersion: options.fileVersion || '',
        driveFolderId,
        targetEmail,
        totalParts: parts.length,
        totalBytesUploaded,
        updatedAt: Date.now(),
      },
      `Semua proses selesai 100%. Game siap didownload oleh pembeli.`
    );
  } catch (err) {
    if (activeJobController.isCancelled || err.message === 'JOB_CANCELLED_BY_USER' || err.name === 'AbortError') {
      updateState(
        { status: 'cancelled', progress: 0, text: 'Upload dibatalkan oleh pengguna.', phase: 'cancelled' },
        `Upload game dihentikan dan dibatalkan atas permintaan pengguna.`
      );
      return { cancelled: true };
    }
    console.error('Studio Process Error:', err);
    const errorDetail = formatStudioError(err, {
      stage: 'upload',
      gameName: finalCatalogName || initialCatalogTitle || localBaseName,
      folderPath: folderPath,
      email: targetEmail,
    });
    updateState(
      { status: 'error', progress: 0, text: `Gagal: ${errorDetail.title}`, errorDetail },
      `ERROR UPLOAD: ${errorDetail.title} - ${errorDetail.cause}`
    );
  }
}
