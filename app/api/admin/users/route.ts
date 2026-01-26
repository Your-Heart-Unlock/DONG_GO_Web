import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

/**
 * Admin Users API
 * GET /api/admin/users - 사용자 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Owner 권한 확인
    const callerDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const callerData = callerDoc.data();

    if (!callerData || callerData.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Owner role required' },
        { status: 403 }
      );
    }

    // 사용자 목록 조회
    const usersSnapshot = await adminDb
      .collection('users')
      .orderBy('createdAt', 'desc')
      .get();

    const users = usersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email || '',
        nickname: data.nickname || '',
        role: data.role || 'pending',
        createdAt: data.createdAt?.toDate()?.toISOString() || null,
        lastLoginAt: data.lastLoginAt?.toDate()?.toISOString() || null,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin Users GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
