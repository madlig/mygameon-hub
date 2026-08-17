import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import UserPreferences from '@/models/UserPreferences';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    let prefs = await UserPreferences.findOne({ adminEmail: session.user.email });
    
    // If not exists, create default
    if (!prefs) {
      prefs = await UserPreferences.create({ adminEmail: session.user.email });
    }

    return NextResponse.json(prefs);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    await connectToDatabase();
    
    // Valid fields that can be updated
    const updateData = {};
    if (data.recentEmails !== undefined) updateData.recentEmails = data.recentEmails;
    if (data.recentGames !== undefined) updateData.recentGames = data.recentGames;
    if (data.favGames !== undefined) updateData.favGames = data.favGames;
    if (data.bundles !== undefined) updateData.bundles = data.bundles;

    const prefs = await UserPreferences.findOneAndUpdate(
      { adminEmail: session.user.email },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return NextResponse.json(prefs);
  } catch (error) {
    console.error('Error saving preferences:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
