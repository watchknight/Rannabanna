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
  if (fs.existsSync(keyPath)) {
    const rawKey = fs.readFileSync(keyPath, 'utf8');
    const serviceAccount = JSON.parse(rawKey);

    if (
      serviceAccount.private_key && 
      !serviceAccount.private_key.includes('PLACEHOLDER_YOUR_PRIVATE_KEY')
    ) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = admin.firestore();
      isFirebaseInitialized = true;
      console.log('🔥 Firebase Admin SDK initialized successfully with service account.');
    } else {
      console.log('ℹ️ Firebase service account using placeholders. Running in local SQLite offline mode.');
    }
  } else {
    console.log('ℹ️ Running in local SQLite offline mode (Firebase service account not present).');
  }
} catch (error) {
  console.error('\n❌ FIREBASE INITIALIZATION ERROR:', error.message, '\n');
}

export { db, isFirebaseInitialized };
