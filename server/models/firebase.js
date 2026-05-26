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
      console.error('\n❌ FIREBASE CONFIG WARNING:\n   Your "server/config/service-account.json" is still using placeholders!\n   Please download a real private key JSON from the Firebase Console:\n   https://console.firebase.google.com/project/rannabanna-chef/settings/serviceaccounts/adminsdk\n');
    }
  } else {
    console.error('\n❌ FIREBASE CONFIG ERROR:\n   "server/config/service-account.json" was not found!\n   Please save your Firebase private key JSON file to that path.\n');
  }
} catch (error) {
  console.error('\n❌ FIREBASE INITIALIZATION ERROR:', error.message, '\n');
}

export { db, isFirebaseInitialized };
