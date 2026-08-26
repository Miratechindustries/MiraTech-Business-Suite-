import * as admin from 'firebase-admin';
import firebaseConfig from '../firebase-applet-config.json';

if (!admin.apps || admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: (firebaseConfig as any)?.projectId || "ai-studio-70feb629-4714-4b74-93eb-853bab2b9254",
      databaseURL: `https://${(firebaseConfig as any)?.projectId || "ai-studio-70feb629-4714-4b74-93eb-853bab2b9254"}.firebaseio.com`
    });
  } catch (e) {
    console.error('Firebase Admin initialization error:', e);
  }
}

export const adminDb = admin.apps && admin.apps.length > 0 ? admin.firestore() : (null as any);
export const adminAuth = admin.apps && admin.apps.length > 0 ? admin.auth() : (null as any);
export default admin;
