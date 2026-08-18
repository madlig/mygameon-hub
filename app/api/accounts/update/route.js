import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import WorkspaceAccount from '@/models/WorkspaceAccount';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, gameFolderId } = await req.json();

    if (!email || !gameFolderId) {
      return NextResponse.json({ error: 'Email dan Folder ID wajib diisi' }, { status: 400 });
    }

    await connectToDatabase();
    
    const account = await WorkspaceAccount.findOneAndUpdate(
      { email },
      { $set: { gameFolderId } },
      { new: true }
    );

    if (!account) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Berhasil memperbarui Folder ID untuk ${email}` });
  } catch (error) {
    console.error('Error updating account folder ID:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
