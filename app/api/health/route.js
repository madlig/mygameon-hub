import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || null;

  const envStatus = {
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
    GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL),
    MONGODB_URI: Boolean(process.env.MONGODB_URI),
  };

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV || 'unknown',
      host,
      keys: envStatus,
    },
    mongoState: mongoose.connection.readyState,
  });
}
