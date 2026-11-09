import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local or .env
function loadEnv() {
  const envFiles = [
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../.env'),
  ];

  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const equalIdx = trimmed.indexOf('=');
        if (equalIdx > 0) {
          const key = trimmed.slice(0, equalIdx).trim();
          let value = trimmed.slice(equalIdx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

loadEnv();

const uri = process.env.MONGODB_URI;

console.log('========================================================');
console.log('       FormGuard Pro — Database Connection Test         ');
console.log('========================================================\n');

if (!uri) {
  console.error('❌ Error: MONGODB_URI is not defined in your .env.local file.');
  process.exit(1);
}

// Obfuscate password in log
const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:******@');
console.log(`Connecting to: ${maskedUri}`);

const startTime = Date.now();

try {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  const duration = Date.now() - startTime;
  console.log(`\n✅ SUCCESS: Connected to MongoDB in ${duration}ms!`);
  console.log(`Database Name : ${mongoose.connection.name}`);
  console.log(`Host          : ${mongoose.connection.host}`);
  console.log(`Port          : ${mongoose.connection.port || 'Default Atlas SRV'}`);
  console.log(`State         : Ready (Connected)\n`);
  console.log('========================================================');

  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  const duration = Date.now() - startTime;
  console.error(`\n❌ FAILED TO CONNECT (after ${duration}ms)\n`);
  console.error('Error Details:');
  console.error(err.message || String(err));
  console.log('\nCommon Fixes:');
  console.log('1. MongoDB Atlas IP Access: Go to Network Access in Atlas and ensure "0.0.0.0/0" (Allow from Anywhere) is added.');
  console.log('2. Check Username & Password: Make sure you replaced <password> with your actual database user password (and url-encoded any special characters).');
  console.log('3. Local MongoDB: If running locally, ensure mongod service is started (e.g. net start MongoDB).');
  console.log('========================================================');
  process.exit(1);
}

