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

    return await handleValidation(key, uuid, username);
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

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      key = (body.key || '').trim();
      uuid = (body.uuid || '').trim();
      username = (body.username || '').trim();
    } else {
      const formData = await request.formData();
      key = (formData.get('key') || '').toString().trim();
      uuid = (formData.get('uuid') || '').toString().trim();
      username = (formData.get('username') || '').toString().trim();
    }

    return await handleValidation(key, uuid, username);
  } catch (err) {
    console.error('[API sims4/validate POST Error]:', err);
    return textResponse('SERVER_ERROR: ' + err.message, 500);
  }
}

async function handleValidation(key, uuid, username) {
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

  const existingHwid = (license.hwid || '').trim();

  // Kasus 1: HWID belum terikat -> Bind perangkat untuk pertama kali secara atomic
  if (!existingHwid) {
    if (uuid) {
      const updatedLicense = await Sims4License.findOneAndUpdate(
        { _id: license._id, hwid: { $in: ['', null] } },
        { $set: { hwid: uuid } },
        { new: true }
      );
      if (updatedLicense) {
        license = updatedLicense;
      }

      // Sinkronkan ke Google Sheets di background (non-blocking)
      if (process.env.GSHEET_SIMS4_ID) {
        updateSheetHwid(license.invoice, uuid).catch((e) =>
          console.error('[sims4/validate] Background sheet update failed:', e.message)
        );
      }
    }
    return textResponse(license.cc === 'Y' ? 'VALID_CC' : 'VALID');
  }

  // Kasus 2: HWID sudah terikat -> Verifikasi kecocokan ID perangkat
  if (!uuid || existingHwid.toUpperCase() !== uuid.toUpperCase()) {
    return textResponse('INVALID_DEVICE');
  }

  return textResponse(license.cc === 'Y' ? 'VALID_CC' : 'VALID');
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
