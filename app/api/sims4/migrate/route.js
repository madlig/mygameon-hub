import { NextResponse } from 'next/server';
import { getGoogleClients } from '@/lib/googleClient';
import connectToDatabase from '@/lib/db';
import Sims4License from '@/models/Sims4License';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const { sheets } = await getGoogleClients();
    const sheetId = process.env.GSHEET_SIMS4_ID;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Licenses!A:G',
    });

    const rows = res.data.values || [];
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const invoice = row[0];
      if (!invoice || invoice === 'Invoice') continue;

      const hwid = row[1] || '';
      const cc = row[3] || 'N';
      const status = row[4] || 'Active';
      const email = row[5] || '';
      
      let createdAt = new Date();
      if (row[6]) {
        const parsed = new Date(row[6]);
        if (!isNaN(parsed.getTime())) {
          createdAt = parsed;
        }
      }

      try {
        await Sims4License.updateOne(
          { invoice },
          { $set: { hwid, cc, status, email, createdAt } },
          { upsert: true }
        );
        imported++;
      } catch (err) {
        console.error(`Gagal import invoice ${invoice}:`, err);
        skipped++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Migrasi Selesai!',
      imported,
      skipped 
    });

  } catch (err) {
    console.error('Migrasi error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
