import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Sims4License from '@/models/Sims4License';
import { google } from 'googleapis';

function getAdminSheetsClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return null;
  }
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return google.sheets({ version: 'v4', auth });
}

function textResponse(text, status = 200) {
  return new Response(text.trim(), {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function OPTIONS() {
  return textResponse('OK');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = (searchParams.get('key') || '').trim();
    const uuid = (searchParams.get('uuid') || '').trim();
    const username = (searchParams.get('username') || '').trim();
    const allHwids = (searchParams.get('all_hwids') || searchParams.get('all_ids') || '').trim();

    return await handleValidation(key, uuid, username, allHwids);
  } catch (err) {
    console.error('[API sims4/validate GET Error]:', err);
    return textResponse('SERVER_ERROR: ' + err.message, 500);
  }
}

export async function POST(request) {
  try {
    let key = '';
    let uuid = '';
    let username = '';
    let allHwids = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      key = (body.key || '').trim();
      uuid = (body.uuid || '').trim();
      username = (body.username || '').trim();
      allHwids = (body.all_hwids || body.all_ids || '').trim();
    } else {
      const formData = await request.formData();
      key = (formData.get('key') || '').toString().trim();
      uuid = (formData.get('uuid') || '').toString().trim();
      username = (formData.get('username') || '').toString().trim();
      allHwids = (formData.get('all_hwids') || formData.get('all_ids') || '').toString().trim();
    }

    return await handleValidation(key, uuid, username, allHwids);
  } catch (err) {
    console.error('[API sims4/validate POST Error]:', err);
    return textResponse('SERVER_ERROR: ' + err.message, 500);
  }
}

async function handleValidation(key, uuid, username, allHwids = '') {
  if (!key) {
    return textResponse('INVALID_KEY');
  }

  await connectToDatabase();

  // 1. Cari lisensi di MongoDB (exact case-insensitive match)
  let license = await Sims4License.findOne({
    invoice: { $regex: '^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' },
  });

  // 2. Fallback check ke Google Sheets jika belum tersinkronisasi di MongoDB
  if (!license && process.env.GSHEET_SIMS4_ID) {
    try {
      const sheets = getAdminSheetsClient();
      if (sheets) {
        const sheetId = process.env.GSHEET_SIMS4_ID;
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'Licenses!A:G',
        });

        const rows = res.data.values || [];
        const foundRow = rows.find(
          (r) => r[0] && r[0].toString().trim().toUpperCase() === key.toUpperCase()
        );

        if (foundRow) {
          const rowHwid = (foundRow[1] || '').toString().trim();
          const rowCC = (foundRow[3] || 'N').toString().trim().toUpperCase();
          const rowStatus = (foundRow[4] || 'Active').toString().trim();
          const rowEmail = (foundRow[5] || '').toString().trim();

          // Simpan ke MongoDB untuk request berikutnya dengan upsert aman
          license = await Sims4License.findOneAndUpdate(
            { invoice: foundRow[0].toString().trim() },
            {
              $setOnInsert: {
                invoice: foundRow[0].toString().trim(),
                hwid: rowHwid,
                hwids: rowHwid ? [rowHwid] : [],
                cc: rowCC === 'Y' ? 'Y' : 'N',
                status: rowStatus,
                email: rowEmail,
                createdAt: new Date(),
              }
            },
            { upsert: true, new: true }
          );
        }
      }
    } catch (sheetErr) {
      console.warn('[sims4/validate] Fallback sheet check failed:', sheetErr.message);
    }
  }

  if (!license) {
    return textResponse('INVALID_KEY');
  }

  if (license.status && license.status.toUpperCase() === 'BANNED') {
    return textResponse('BANNED');
  }

  // Siapkan daftar candidate hardware IDs yang dikirim client
  const candidateList = [];
  if (uuid) candidateList.push(uuid);
  if (allHwids) {
    const parts = allHwids.split(',');
    for (const p of parts) {
      const t = p.trim();
      if (t && !candidateList.includes(t)) {
        candidateList.push(t);
      }
    }
  }

  // Kumpulkan semua hardware anchor yang sah dan terdaftar pada lisensi ini
  const registeredAnchors = new Set();
  if (license.hwid && license.hwid.trim()) {
    registeredAnchors.add(license.hwid.trim().toUpperCase());
  }
  if (Array.isArray(license.hwids)) {
    for (const h of license.hwids) {
      if (h && h.trim()) registeredAnchors.add(h.trim().toUpperCase());
    }
  }

  // ── KASUS 1: Lisensi Belum Terikat Perangkat (First-Time Activation) ──
  if (registeredAnchors.size === 0) {
    const primaryId = candidateList[0] || uuid || '';
    const boundArray = candidateList.length > 0 ? candidateList : (primaryId ? [primaryId] : []);

    if (boundArray.length > 0) {
      await Sims4License.updateOne(
        { _id: license._id },
        { 
          $set: { 
            hwid: primaryId,
            hwids: boundArray 
          } 
        }
      );

      // Sinkronkan ke Google Sheets di background (non-blocking fallback)
      if (process.env.GSHEET_SIMS4_ID) {
        updateSheetHwid(license.invoice, primaryId).catch(() => {});
      }
    }

    return textResponse(license.cc === 'Y' ? 'VALID_CC' : 'VALID');
  }

  // ── KASUS 2: Lisensi Sudah Terikat -> Validasi Multi-Anchor Cerdas ──
  let isMatched = false;
  for (const cand of candidateList) {
    if (registeredAnchors.has(cand.toUpperCase())) {
      isMatched = true;
      break;
    }
  }

  if (isMatched) {
    // Self-Healing: Jika ada ID baru yang sah dari perangkat yang sama,
    // tambahkan ke daftar hwids agar login selanjutnya semakin kebal error
    const newAnchors = candidateList.filter(c => !registeredAnchors.has(c.toUpperCase()));
    if (newAnchors.length > 0) {
      Sims4License.updateOne(
        { _id: license._id },
        { $addToSet: { hwids: { $each: newAnchors } } }
      ).catch(() => {});
    }

    return textResponse(license.cc === 'Y' ? 'VALID_CC' : 'VALID');
  }

  // Jika tidak ada satu pun ID hardware yang cocok -> Terkunci di perangkat lain
  return textResponse('INVALID_DEVICE');
}

async function updateSheetHwid(invoice, hwid) {
  const sheets = getAdminSheetsClient();
  if (!sheets) return;
  const sheetId = process.env.GSHEET_SIMS4_ID;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Licenses!A:B',
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(
    (row) => row[0] && row[0].toString().trim().toUpperCase() === invoice.toUpperCase()
  );

  if (rowIndex !== -1) {
    const sheetRow = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Licenses!B' + sheetRow,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[hwid]] },
    });
  }
}
