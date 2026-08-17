import { NextResponse } from 'next/server';
import { syncAllCatalogs } from '@/lib/catalogSync';

export async function GET(request) {
  // Verifikasi request dari Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { results } = await syncAllCatalogs();
    
    const totalAdded = results.reduce((s, r) => s + r.added, 0);
    const totalRemoved = results.reduce((s, r) => s + r.removed, 0);
    const errors = results.filter(r => r.error);

    return NextResponse.json({
      success: true,
      syncedWorkspaces: results.length,
      totalAdded,
      totalRemoved,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Catalog sync cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
