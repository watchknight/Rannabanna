import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keyPath = path.resolve(__dirname, '../config/service-account.json');

let db = null;
let isFirebaseInitialized = false;

try {
  let serviceAccount = null;

  // 1. Try resolving service account from environment variable (ideal for Render / Cloud hosting)
  const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (envServiceAccount) {
    try {
      const trimmed = envServiceAccount.trim();
      const jsonStr = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      serviceAccount = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.warn('⚠️ Could not parse FIREBASE_SERVICE_ACCOUNT environment variable:', parseErr.message);
    }
  }

  // 2. Fall back to local file if not set in environment
  if (!serviceAccount && fs.existsSync(keyPath)) {
    try {
      const rawKey = fs.readFileSync(keyPath, 'utf8');
      serviceAccount = JSON.parse(rawKey);
    } catch (fileErr) {
      console.warn('⚠️ Could not read service-account.json file:', fileErr.message);
    }
  }

  if (
    serviceAccount &&
    serviceAccount.private_key &&
    !serviceAccount.private_key.includes('PLACEHOLDER_YOUR_PRIVATE_KEY')
  ) {
    const app = admin.apps.length === 0
      ? admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
      : admin.app();

    db = admin.firestore();
    isFirebaseInitialized = true;
    console.log('🔥 Firebase Admin SDK initialized successfully.');
  } else {
    console.log('ℹ️ Running in local SQLite offline mode (Firebase service account not present).');
  }
} catch (error) {
  console.error('\n❌ FIREBASE INITIALIZATION ERROR:', error.message, '\n');
}

export { db, isFirebaseInitialized };
