import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

let firestoreInstance = null;

/**
 * Mencari path serviceAccountKey.json dari beberapa kandidat lokasi
 */
function resolveServiceAccountPath() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) {
    return process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  }

  const candidates = [
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(process.cwd(), '..', 'website', 'mygameonapp', 'src', 'scripts', 'serviceAccountKey.json'),
    path.resolve(process.cwd(), '..', '..', 'website', 'mygameonapp', 'src', 'scripts', 'serviceAccountKey.json'),
    'c:\\mad\\website\\mygameonapp\\src\\scripts\\serviceAccountKey.json',
    path.join(process.resourcesPath || '', 'serviceAccountKey.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('serviceAccountKey.json tidak ditemukan untuk sinkronisasi ke Firestore.');
}

/**
 * Inisialisasi Google Firestore Client menggunakan serviceAccountKey.json
 */
export function getFirestoreClient() {
  if (firestoreInstance) return firestoreInstance;

  const keyPath = resolveServiceAccountPath();
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/datastore'],
  });

  firestoreInstance = google.firestore({ version: 'v1', auth });
  return firestoreInstance;
}

/**
 * Mengubah tipe data JavaScript umum menjadi format tipe Firestore REST API
 */
export function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      fields[key] = toFirestoreValue(value);
    }
  }
  return fields;
}

export function slugify(title = '') {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * Push / Upsert 1 game dari MongoDB GameCatalog ke koleksi 'games' di Firestore
 * 
 * ATURAN KETAT:
 * fileSizeBytes WAJIB murni dari game.totalSize (hasil scan Google Drive di MongoDB).
 * partsCount WAJIB murni dari game.fileCount (hasil scan Google Drive di MongoDB).
 */
export async function syncGameToFirestore(game, projectId = 'mygameonwebsite') {
  const firestore = getFirestoreClient();

  const title = (game.cleanTitle || game.name || 'Game PC').trim();
  const docId = game.slug || slugify(title);

  // Payload etalase publik yang bersih & terstandar
  const publicPayload = {
    id: docId,
    title,
    slug: docId,
    // ATURAN MUTLAK: Ukuran file murni dari Google Drive
    fileSizeBytes: Number(game.totalSize) || 0,
    partsCount: Number(game.fileCount) || 1,
    packageType: game.packageType || 'PRE-INSTALLED',
    fileVersion: game.fileVersion || '',
    // Data visual dari Steam / SteamDB
    coverImageUrl: game.coverImageUrl || '',
    headerBannerUrl: game.headerBannerUrl || '',
    screenshots: Array.isArray(game.screenshots) ? game.screenshots : [],
    genres: Array.isArray(game.genres) && game.genres.length > 0 ? game.genres : ['PC Game'],
    tags: Array.isArray(game.tags) ? game.tags : [],
    shortDescription: game.shortDescription || '',
    releaseYear: game.releaseYear || '',
    developer: game.developer || '',
    steamAppId: game.steamAppId || null,
    specs: game.specs || null,
    // Data bisnis MyGameON
    shopee: {
      isAvailable: Boolean(game.shopeeUrl),
      url: game.shopeeUrl || '',
    },
    availabilityStatus: 'available',
    isProblematic: false,
    updatedAt: new Date(),
  };

  const docPath = `projects/${projectId}/databases/(default)/documents/games/${docId}`;

  const res = await firestore.projects.databases.documents.patch({
    name: docPath,
    requestBody: {
      fields: toFirestoreFields(publicPayload),
    },
  });

  return {
    success: true,
    docId,
    name: res.data.name,
    fileSizeBytes: publicPayload.fileSizeBytes,
    title: publicPayload.title,
  };
}
