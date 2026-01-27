import * as admin from 'firebase-admin';

// Firebase Admin SDK 초기화 (서버 사이드 전용)
// API Routes에서만 사용
let adminDb: admin.firestore.Firestore | undefined;
let adminAuth: admin.auth.Auth | undefined;
let adminStorage: admin.storage.Storage | undefined;

try {
  if (!admin.apps.length) {
    // Vercel 환경변수 또는 로컬 service account key 사용
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    if (privateKey && projectId && clientEmail) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        } as admin.ServiceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });

      adminDb = admin.firestore();
      adminAuth = admin.auth();
      adminStorage = admin.storage();
    } else {
      console.warn('Firebase Admin SDK: Service account credentials not found');
    }
  } else {
    adminDb = admin.firestore();
    adminAuth = admin.auth();
    adminStorage = admin.storage();
  }
} catch (error) {
  console.error('Firebase Admin SDK initialization error:', error);
}

export { adminDb, adminAuth, adminStorage, admin };
