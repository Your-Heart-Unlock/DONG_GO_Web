import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/lib/firebase/admin';
import { UserRole } from '@/types';

/**
 * Admin User API
 * PATCH /api/admin/users/[uid] - 사용자 역할 변경
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const { uid } = await params;

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

    // Request body 파싱
    const body = await request.json();
    const { role } = body as { role: UserRole };

    if (!role || !['pending', 'member', 'owner'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // 대상 사용자 확인
    const targetDoc = await adminDb.collection('users').doc(uid).get();
    if (!targetDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const previousRole = targetDoc.data()?.role;

    // 역할 변경
    await adminDb.collection('users').doc(uid).update({
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Admin log 기록
    await adminDb.collection('admin_logs').add({
      action: 'UPDATE_USER_ROLE',
      performedBy: decodedToken.uid,
      targetUid: uid,
      metadata: {
        previousRole,
        newRole: role,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      uid,
      role,
    });
  } catch (error) {
    console.error('Admin User PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
