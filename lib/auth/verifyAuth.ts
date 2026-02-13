import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import type { firestore } from 'firebase-admin';

type AuthResult =
  | { success: true; uid: string; role: string; db: firestore.Firestore }
  | { success: false; response: NextResponse };

/**
 * Bearer 토큰 추출 및 Firebase Auth 검증
 * 성공 시 { success: true, uid, role, db } 반환
 * 실패 시 { success: false, response } 반환
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  if (!adminAuth || !adminDb) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      ),
    };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await adminAuth.verifyIdToken(token);
  const uid = decodedToken.uid;

  const userDoc = await adminDb.collection('users').doc(uid).get();
  const userData = userDoc.data();
  const role = userData?.role || 'pending';

  return { success: true, uid, role, db: adminDb };
}

/**
 * Owner 권한 필수 인증
 */
export async function requireOwner(request: NextRequest): Promise<AuthResult> {
  const auth = await verifyAuth(request);
  if (!auth.success) return auth;

  if (auth.role !== 'owner') {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Forbidden: Owner role required' },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/**
 * Member 또는 Owner 권한 필수 인증
 */
export async function requireMember(request: NextRequest): Promise<AuthResult> {
  const auth = await verifyAuth(request);
  if (!auth.success) return auth;

  if (!['member', 'owner'].includes(auth.role)) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Forbidden: Member or Owner role required' },
        { status: 403 }
      ),
    };
  }

  return auth;
}
