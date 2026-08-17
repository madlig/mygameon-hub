import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { syncWorkspaceCatalog, syncAllCatalogs } from '@/lib/catalogSync';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const email = url.searchParams.get('email');

    if (email) {
      // Sync 1 workspace saja
      const result = await syncWorkspaceCatalog(email);
      return NextResponse.json({ results: [{ email, ...result }] });
    } else {
      // Sync semua workspace
      const { results } = await syncAllCatalogs();
      return NextResponse.json({ results });
    }
  } catch (error) {
    console.error('Catalog sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
