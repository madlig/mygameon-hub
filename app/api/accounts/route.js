import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import WorkspaceAccount from '@/models/WorkspaceAccount';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const accounts = await WorkspaceAccount.find().select('-refreshToken');
    
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 });
    }

    await connectToDatabase();
    
    // Hapus akun dari WorkspaceAccount
    await WorkspaceAccount.deleteOne({ email });
    
    // Hapus juga semua game miliknya dari katalog
    const GameCatalog = (await import('@/models/GameCatalog')).default;
    await GameCatalog.deleteMany({ ownerEmail: email });

    return NextResponse.json({ success: true, message: `Akun ${email} berhasil dihapus` });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Gagal menghapus akun' }, { status: 500 });
  }
}

