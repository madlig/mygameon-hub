// scripts/syncAllFirestoreSteam.mjs
//
// Script untuk mencocokkan seluruh judul game di Firestore dengan Steam AppID yang presisi
// dan meng-update coverImageUrl dengan poster resmi Steam (library_600x900.jpg atau header.jpg).

import { google } from 'googleapis';
import path from 'path';

const fetch = globalThis.fetch;
const serviceAccountPath = 'c:/mad/website/mygameonapp/src/scripts/serviceAccountKey.json';

const auth = new google.auth.GoogleAuth({
  keyFile: serviceAccountPath,
  scopes: ['https://www.googleapis.com/auth/datastore'],
});

// Peta AppID presisi untuk memastikan 100% akurasi judul populer & berseri
const MANUAL_OVERRIDES = {
  'subnautica': 264710,
  'subnautica below zero': 848450,
  'autobahn police simulator 3': 1065520,
  'grand theft auto v': 271590,
  'gta v': 271590,
  'god of war': 1593500,
  'god of war ragnarok': 2322010,
  'grand theft auto iii': 1546970,
  'grand theft auto san andreas': 1547000,
  'grand theft auto san andreas definitive edition': 1547000,
  'grand theft auto the trilogy definitive edition': 1546970,
  'grand theft auto iv complete edition': 12210,
  'grand theft auto iv': 12210,
  'passpartout 2 the lost artist': 1571100,
  'naruto ultimate ninja storm 1': 495140,
  'naruto ultimate ninja storm 4': 349040,
  'naruto x boruto ultimate ninja storm connections': 1020790,
  'naruto shippuden ultimate ninja storm 3 full burst hd': 234670,
  'naruto shippuden ultimate ninja storm 2': 543870,
  'the sims 4': 1222670,
  'the sims 3': 47890,
  'the sims 2 legacy collection': 1222670,
  'the sims legacy collection': 1222670,
  'age of empire 3': 933110,
  'resident evil 4 remake': 2050650,
  'resident evil 4': 2050650,
  'internet cafe and supermarket simulator 2024': 2563770,
  'tekken 8': 1778820,
  'farming simulator 25': 2300320,
  'contraband police simulator': 756800,
  'car dealer simulator': 2404880,
  'brothers a tale of two sons': 225080,
  'chef rpg': 1796790,
  'architect life': 1296400,
  'snow runner': 1465360,
  'stardew valley': 413150,
  'a space for the unbound': 1201270,
  'settlement survival': 1509510,
  'under the waves': 1975440,
  'youtubers life 2': 1493760,
  'i am part time worker': 2985930,
  'little nightmare 2': 860510,
  'bravely default ii': 1446650,
  'stranded deep': 313120,
  'dragons dogma dark arisen': 367500,
  'need for speed most wanted black edition': 1262560,
  'police shootout': 1279240,
  'remnant 2': 1282100,
  'hades': 1145360,
  'final fantasy xiii-2': 292140,
  'motogp 23': 2101300
};

function normalize(s = '') {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function verifySteamCover(appId) {
  // Coba cover vertikal 600x900 dulu
  const verticalUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
  try {
    const res = await fetch(verticalUrl, { method: 'HEAD' });
    if (res.status === 200) {
      return verticalUrl;
    }
  } catch (e) {}

  // Fallback ke header.jpg (100% ada untuk setiap game Steam)
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}

async function searchSteamStore(rawTitle) {
  const clean = rawTitle
    .replace(/(multi\d+)?-?(elamigos|dodi|fitgirl|gog|tenoke|rune|skidrow|codex|emp|plaza|flt)/gi, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/definitive edition/gi, '')
    .replace(/the complete edition/gi, '')
    .replace(/complete edition/gi, '')
    .replace(/remake/gi, '')
    .trim();

  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(clean)}&l=english&cc=US`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

    const cleanNorm = normalize(clean);
    let best = data.items[0];
    for (const item of data.items) {
      if (normalize(item.name) === cleanNorm) {
        best = item;
        break;
      }
    }
    return best.id;
  } catch (e) {
    return null;
  }
}

import fs from 'fs';

async function main() {
  console.log('🚀 Memulai sinkronisasi akurasi Steam AppID & Cover ke Firestore...');
  const firestore = google.firestore({ version: 'v1', auth });
  const key = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  const projectId = key.project_id;

  let pageToken = null;
  const allDocs = [];
  do {
    const res = await firestore.projects.databases.documents.list({
      parent: `projects/${projectId}/databases/(default)/documents`,
      collectionId: 'games',
      pageSize: 300,
      pageToken,
    });
    const docs = res.data.documents || [];
    allDocs.push(...docs);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Total dokumen game di Firestore: ${allDocs.length}`);

  const round2Map = fs.existsSync('round2_map.json') ? JSON.parse(fs.readFileSync('round2_map.json', 'utf8')) : {};
  console.log(`Loaded round2_map with ${Object.keys(round2Map).length} deterministic game mappings.`);

  let updatedCount = 0;
  let skippedCount = 0;
  let alreadySyncedCount = 0;

  // Urutkan pola manual dari yang paling panjang/spesifik ke yang umum
  const sortedManualPatterns = Object.entries(MANUAL_OVERRIDES).sort((a, b) => b[0].length - a[0].length);

  for (const doc of allDocs) {
    const docPath = doc.name;
    const docId = docPath.split('/').pop();
    const title = doc.fields.title?.stringValue || doc.fields.name?.stringValue || docId;
    const normTitle = title.toLowerCase().trim();

    // 0. Jika sudah memiliki cover Steam valid dan tidak ada override di round2Map, lewati
    const existingCover = doc.fields.coverImageUrl?.stringValue || '';
    const existingAppId = doc.fields.steamAppId?.integerValue || doc.fields.steamAppId?.stringValue;
    if (existingAppId && (existingCover.includes('steamstatic.com') || existingCover.includes('steampowered.com')) && !round2Map[docId]) {
      alreadySyncedCount++;
      continue;
    }

    // 1. Tentukan Steam AppID dengan prioritas: round2Map -> MANUAL_OVERRIDES -> Steam Store API
    let appId = round2Map[docId] || null;
    if (!appId && MANUAL_OVERRIDES[normTitle]) {
      appId = MANUAL_OVERRIDES[normTitle];
    } else if (!appId) {
      for (const [keyPattern, id] of sortedManualPatterns) {
        if (normTitle === keyPattern || normTitle.includes(keyPattern)) {
          appId = id;
          break;
        }
      }
    }

    if (!appId) {
      appId = await searchSteamStore(title);
    }

    if (!appId) {
      console.log(`⚠️ Tidak dapat menemukan Steam AppID untuk: "${title}"`);
      skippedCount++;
      continue;
    }

    // 2. Verifikasi URL cover Steam
    const coverUrl = await verifySteamCover(appId);

    // 3. Patch Firestore Document
    try {
      await firestore.projects.databases.documents.patch({
        name: docPath,
        'updateMask.fieldPaths': ['steamAppId', 'coverImageUrl'],
        requestBody: {
          fields: {
            steamAppId: { integerValue: String(appId) },
            coverImageUrl: { stringValue: coverUrl },
          },
        },
      });

      console.log(`✅ [${docId}] "${title}" ➔ AppID: ${appId} | Cover: ${coverUrl.split('/').pop()}`);
      updatedCount++;
    } catch (err) {
      console.error(`❌ Gagal update [${docId}]:`, err.message);
    }
  }

  console.log('\n=============================================');
  console.log(`🎉 Selesai! Berhasil mengupdate ${updatedCount} game dengan cover Steam resmi.`);
  console.log(`⚠️ Dilewati: ${skippedCount} game.`);
  console.log('=============================================\n');
}

main().catch(console.error);
