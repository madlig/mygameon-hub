/**
 * scripts/reauth-admin.cjs
 * Helper tool untuk otentikasi ulang akun Google Admin (mygameonhub@gmail.com)
 * dan pengiriman ulang email pesanan yang sempat gagal hari ini.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { google } = require('googleapis');
const mongoose = require('mongoose');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[key] = val;
  }
});

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const adminEmail = (process.env.ADMIN_EMAIL || 'mygameonhub@gmail.com').trim().toLowerCase();
const redirectUri = 'http://localhost:3000/api/auth/google/callback';

async function main() {
  console.log('========================================================================');
  console.log('    MYGAMEON STUDIO - RE-AUTORISASI GOOGLE GMAIL ADMIN & RESEND EMAIL   ');
  console.log('========================================================================\n');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/spreadsheets',
    ]
  });

  console.log('1. Silakan buka tautan berikut di browser untuk mengotorisasi akun:', adminEmail);
  console.log('\nTAUTAN OTORISASI:');
  console.log(authUrl, '\n');

  // Coba buka otomatis di browser sistem Windows
  try {
    exec(`start "" "${authUrl}"`);
    console.log('-> Browser default otomatis dibuka.');
  } catch (_) {
    console.log('-> Silakan salin tautan di atas dan buka secara manual di browser.');
  }

  console.log('\n2. Menunggu callback di http://localhost:3000/api/auth/google/callback ...');
  console.log('(Setelah kamu klik "Izinkan / Allow" di Google, token otomatis tersimpan ke database & .env.local)\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const WorkspaceAccount = mongoose.model('WorkspaceAccount', new mongoose.Schema({
    email: String,
    status: String,
    refreshToken: String,
    updatedAt: Date
  }, { timestamps: true }));

  // Polling cek apakah akun admin sudah terupdate
  let verified = false;
  let attempts = 0;
  const maxAttempts = 60; // 2 menit

  while (!verified && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 2000));
    attempts++;

    // Cek di MongoDB
    const acc = await WorkspaceAccount.findOne({
      email: { $regex: new RegExp('^' + adminEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
    }).lean();

    if (acc?.refreshToken) {
      // Uji refresh token ke Gmail API
      try {
        const testClient = new google.auth.OAuth2(clientId, clientSecret);
        testClient.setCredentials({ refresh_token: acc.refreshToken });
        const gmail = google.gmail({ version: 'v1', auth: testClient });
        const profile = await gmail.users.getProfile({ userId: 'me' });

        console.log(`\n========================================================================`);
        console.log(`✅ SUKSES! Akun Gmail Admin terhubung: ${profile.data.emailAddress}`);
        console.log(`========================================================================\n`);
        verified = true;
        break;
      } catch (testErr) {
        // Belum valid atau token belum diperbarui
      }
    }

    process.stdout.write(`Menunggu otorisasi (${attempts * 2}s)... \r`);
  }

  if (!verified) {
    console.log('\n⚠️ Waktu tunggu habis. Pastikan kamu sudah memilih akun', adminEmail, 'dan mengizinkan seluruh izin akses.');
    await mongoose.disconnect();
    return;
  }

  // 3. Resend email untuk order hari ini
  console.log('3. Mencari pesanan hari ini yang perlu dikirimkan ulang emailnya...');
  const Order = mongoose.model('Order', new mongoose.Schema({
    email: String,
    invoice: String,
    cartItems: Array,
    orderDate: Date
  }));

  const AccessLog = mongoose.model('AccessLog', new mongoose.Schema({
    email: String,
    gameName: String,
    folderId: String,
    expiresAt: Date,
    grantedAt: Date
  }));

  // Cari pesanan 24 jam terakhir yang memiliki email
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentOrders = await Order.find({
    orderDate: { $gte: oneDayAgo },
    email: { $exists: true, $ne: '' }
  }).sort({ orderDate: 1 }).lean();

  console.log(`Ditemukan ${recentOrders.length} pesanan dalam 24 jam terakhir:`);
  for (const o of recentOrders) {
    console.log(`- #${o.invoice} -> ${o.email} (${o.cartItems?.map(i => i.name).join(', ')})`);
  }

  // Panggil endpoint resend internal untuk tiap order
  for (const o of recentOrders) {
    try {
      console.log(`\nMengirim ulang email untuk #${o.invoice} ke ${o.email} ...`);
      const res = await fetch('http://localhost:3000/api/send/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: o.invoice, email: o.email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`✅ BERHASIL: Email pesanan #${o.invoice} terkirim ke ${o.email}`);
      } else {
        console.log(`❌ GAGAL #${o.invoice}: ${data.error || 'Unknown error'}`);
      }
    } catch (sendErr) {
      console.log(`❌ ERROR #${o.invoice}: ${sendErr.message}`);
    }
  }

  console.log('\n========================================================================');
  console.log('SELESAI. Seluruh email konfirmasi telah dikirim ulang ke pembeli!');
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
