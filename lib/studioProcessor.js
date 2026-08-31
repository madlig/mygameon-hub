import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { google } from 'googleapis'
import connectToDatabase from './db.js'
import GameCatalog from '../models/GameCatalog.js'
import WorkspaceAccount from '../models/WorkspaceAccount.js'
import UploadHistory from '../models/UploadHistory.js'
import StudioTask from '../models/StudioTask.js'

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
  const updated = { ...current, ...newState }
  if (logMessage) {
    updated.logs = updated.logs || []
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
    updated.logs.push(`[${timestamp}] ${logMessage}`)
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2))
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

export async function archiveJob(folderPath, config) {
  updateState(
    { status: 'processing', phase: 'archiving', progress: 0, text: 'Memulai Automasi WinRAR...', logs: [] },
    `Mempersiapkan job untuk folder: ${path.basename(folderPath)}`
  );

  try {
    const rarExe = 'C:\\Program Files\\WinRAR\\Rar.exe';
    if (!fs.existsSync(rarExe)) {
      throw new Error('WinRAR (Rar.exe) tidak ditemukan di C:\\Program Files\\WinRAR\\. Pastikan WinRAR terinstall.');
    }

    const folderName = path.basename(folderPath);
    const outputRar = path.join(path.dirname(folderPath), `${folderName}.rar`);

    const args = ['a', '-y', '-ep1'];
    args.push(`-${config.compression}`);
    args.push(`-v${config.splitSize}m`);
    if (config.solid) args.push('-s');
    if (config.recoveryRecord) args.push('-rr5p');

    args.push(outputRar);
    args.push(folderName);

    updateState(
      { text: `Menyiapkan kompresi untuk: ${folderName}` },
      `Menjalankan perintah: Rar.exe ${args.join(' ')}`
    );

    await new Promise((resolve, reject) => {
      const child = spawn(rarExe, args, { cwd: path.dirname(folderPath) });

      child.stdout.on('data', (data) => {
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
        console.error('WinRAR Err:', data.toString());
      });

      child.on('close', (code) => {
        if (code === 0 || code === 1) resolve();
        else reject(new Error(`WinRAR gagal dengan exit code ${code}. Cek log server.`));
      });
      child.on('error', reject);
    });

    updateState(
      { status: 'success', phase: 'done', progress: 100, text: `Berhasil! Kompresi ${folderName} selesai.` },
      `Kompresi WinRAR selesai dengan sukses.`
    );
  } catch (err) {
    console.error('Archive Process Error:', err);
    updateState(
      { status: 'error', progress: 0, text: `Gagal: ${err.message}` },
      `ERROR: ${err.message}`
    );
  }
}

export async function uploadJob(folderPath, targetEmail, config = {}, options = {}) {
  const isUpdateMode = options.mode === 'update';
  const autoPropagate = !!options.autoPropagate;

  updateState(
    { status: 'processing', phase: 'uploading', progress: 0, text: 'Mempersiapkan Upload...', logs: [] },
    `Memulai upload (${isUpdateMode ? 'MODE UPDATE VERSI' : 'MODE GAME BARU'}) untuk folder: ${path.basename(folderPath)} ke ${targetEmail}`
  );

  try {
    await connectToDatabase();
    const folderName = options.gameName || path.basename(folderPath);
    const dir = path.dirname(folderPath);
    const allFiles = fs.readdirSync(dir);

    // Filter file yang diawali nama game dan berformat .rar / part
    const parts = allFiles.filter((f) => f.startsWith(folderName) && f.endsWith('.rar'));
    parts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (parts.length === 0) {
      throw new Error(`File RAR untuk '${folderName}' tidak ditemukan di folder lokal! Lakukan kompresi terlebih dahulu.`);
    }

    updateState({}, `Ditemukan ${parts.length} file part siap upload.`);

    const drive = await getDriveClient(targetEmail);
    let driveFolderId = null;

    // ── 1. Penentuan Folder Target Google Drive ──
    if (isUpdateMode) {
      // Mode Update: Ambil ID folder lama yang sudah ada di database atau options
      if (options.targetFolderId) {
        driveFolderId = options.targetFolderId;
      } else {
        const existingCat = await GameCatalog.findOne({ name: folderName, ownerEmail: targetEmail }).lean();
        if (existingCat?.folderId) {
          driveFolderId = existingCat.folderId;
        }
      }

      if (!driveFolderId) {
        throw new Error(`Game '${folderName}' tidak ditemukan di katalog ${targetEmail} untuk diupdate. Gunakan Mode Game Baru.`);
      }

      updateState(
        { text: `[Clean Replace] Membersihkan file lama di folder: ${folderName}...` },
        `Membersihkan seluruh part versi lama di folder Drive ID: ${driveFolderId}...`
      );

      // Bersihkan seluruh file lama di dalam folder tersebut
      const deletedCount = await cleanFolderContents(drive, driveFolderId, (msg) => updateState({}, msg));
      updateState({}, `Pembersihan selesai (${deletedCount} file lama dibersihkan). ID Folder tetap sama.`);
    } else {
      // Mode Baru: Buat folder baru di dalam gameFolderId workspace
      const acc = await WorkspaceAccount.findOne({ email: targetEmail }).lean();
      const targetGameFolderId = acc?.gameFolderId && acc.gameFolderId !== 'root' ? acc.gameFolderId : 'root';

      updateState({}, `Membuat folder baru '${folderName}' di workspace ${targetEmail}...`);
      const folderRes = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [targetGameFolderId],
        },
        fields: 'id',
      });
      driveFolderId = folderRes.data.id;
    }

    // ── 2. Direct Upload (Langsung ke dalam Folder Tujuan) ──
    let currentPart = 1;
    let totalBytesUploaded = 0;

    for (const partName of parts) {
      const partPath = path.join(dir, partName);
      const stat = fs.statSync(partPath);
      const fileSize = stat.size;

      updateState(
        { progress: 0, text: `[Upload] Part ${currentPart} dari ${parts.length} (${partName})` },
        `Mengunggah ${partName} (${Math.round(fileSize / 1024 / 1024)} MB)...`
      );

      // Direct upload ke parents: [driveFolderId] — tanpa perlu files.update tambahan (hemat 50% API calls)
      await drive.files.create(
        {
          supportsAllDrives: true,
          requestBody: {
            name: partName,
            parents: [driveFolderId],
          },
          media: {
            body: fs.createReadStream(partPath),
          },
        },
        {
          onUploadProgress: (evt) => {
            const pct = Math.round((evt.bytesRead / fileSize) * 100);
            updateState({
              progress: pct,
              text: `[Upload] Part ${currentPart}/${parts.length}: ${pct}% selesai`,
            });
          },
        }
      );

      totalBytesUploaded += fileSize;
      updateState({}, `Selesai upload ${partName}.`);
      currentPart++;
    }

    // ── 3. Update Database GameCatalog Utama ──
    updateState(
      { phase: 'finishing', progress: 100, text: 'Memperbarui database katalog...' },
      `Mencatat data ke Database (Total size: ${Math.round(totalBytesUploaded / 1024 / 1024)} MB)`
    );

    await GameCatalog.findOneAndUpdate(
      { folderId: driveFolderId },
      {
        name: folderName,
        folderId: driveFolderId,
        ownerEmail: targetEmail,
        fileCount: parts.length,
        totalSize: totalBytesUploaded,
        lastSyncedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Catat ke UploadHistory
    await UploadHistory.create({
      gameName: folderName,
      workspaceEmail: targetEmail,
      totalSize: totalBytesUploaded,
      fileCount: parts.length,
      uploadedAt: new Date(),
    });

    // Otomatis selesaikan StudioTask yang cocok jika ada
    try {
      await StudioTask.findOneAndUpdate({ title: folderName }, { $set: { isUploaded: true } });
    } catch (_) {}

    // ── 4. Multi-Workspace Auto-Propagation (Propagasi Antre Berkala) ──
    if (autoPropagate) {
      updateState(
        { text: `[Auto-Sync] Memeriksa folder cadangan di workspace lain...` },
        `Memulai propagasi otomatis untuk game: ${folderName}...`
      );

      // Cari seluruh entri game dengan judul yang sama di workspace cadangan
      const backupCatalogs = await GameCatalog.find({
        name: folderName,
        ownerEmail: { $ne: targetEmail },
      }).lean();

      if (backupCatalogs.length > 0) {
        updateState({}, `Ditemukan ${backupCatalogs.length} workspace cadangan. Memulai sinkronisasi berurutan...`);

        for (let i = 0; i < backupCatalogs.length; i++) {
          const bCat = backupCatalogs[i];

          // Jeda waterfall 1.5 detik antar-workspace untuk menjaga kuota aman
          await new Promise((r) => setTimeout(r, 1500));

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
        updateState({}, `Tidak ada workspace cadangan lain yang terdaftar untuk game '${folderName}'.`);
      }
    }

    // ── 5. Bersihkan File RAR Lokal ──
    updateState({}, `Membersihkan file RAR sementara di folder lokal...`);
    for (const partName of parts) {
      try {
        fs.unlinkSync(path.join(dir, partName));
      } catch (_) {}
    }

    // ── 6. Auto-Delete Folder Lokal (Jika Dicentang) ──
    if (config.autoDelete) {
      updateState({}, `Mode Auto-Delete aktif. Menghapus folder lokal: ${folderName}...`);
      try {
        fs.rmSync(folderPath, { recursive: true, force: true });
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
        text: `Berhasil! ${parts.length} part selesai diupload${autoPropagate ? ' & disinkronkan ke seluruh workspace' : ''}.`,
      },
      `Semua proses selesai 100%. Game siap didownload oleh pembeli.`
    );
  } catch (err) {
    console.error('Studio Process Error:', err);
    updateState(
      { status: 'error', progress: 0, text: `Gagal: ${err.message}` },
      `ERROR: ${err.message}`
    );
  }
}
