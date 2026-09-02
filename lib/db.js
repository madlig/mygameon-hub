import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

if (!global.mongooseListenersSet) {
  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] Connection established successfully.');
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Connection disconnected.');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err);
  });
  global.mongooseListenersSet = true;
}

function resolveMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  // Self-healing fallback: read directly from persistent userData or local env
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
  const possiblePaths = [
    path.join(appData, 'MyGameON Studio', '.env.local'),
    path.join(process.resourcesPath || '', '.env.local'),
    path.join(process.cwd(), '.env.local'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf-8');
        for (const line of content.split(/\r?\n/)) {
          const match = line.trim().match(/^MONGODB_URI\s*=\s*(.*)$/);
          if (match) {
            let val = match[1].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (val) {
              process.env.MONGODB_URI = val;
              return val;
            }
          }
        }
      } catch (_) {}
    }
  }
  return null;
}

async function connectToDatabase() {
  const MONGODB_URI = resolveMongoUri();

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 120000,
      family: 4,
      autoIndex: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
