import { getClientForEmail } from './lib/googleClient.js';
import connectToDatabase from './lib/db.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  try {
    await connectToDatabase();
    const drive = await getClientForEmail('mygameon3@wgaming.my.id');
    
    console.time('Fetch Storage');
    let totalBytes = 0;
    let pageToken = null;
    let apiCalls = 0;
    
    do {
      apiCalls++;
      const res = await drive.files.list({
        q: "trashed=false and 'me' in owners",
        fields: "nextPageToken, files(quotaBytesUsed)",
        pageSize: 1000,
        spaces: 'drive',
      });
      
      for (const f of res.data.files || []) {
        if (f.quotaBytesUsed) {
          totalBytes += parseInt(f.quotaBytesUsed, 10);
        }
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
    
    console.timeEnd('Fetch Storage');
    console.log(`Total API Calls: ${apiCalls}`);
    console.log(`Total Bytes: ${totalBytes}`);
    console.log(`Total GB: ${(totalBytes / (1024 ** 3)).toFixed(2)} GB`);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
