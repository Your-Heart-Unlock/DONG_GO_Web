import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { requireOwner } from '@/lib/auth/verifyAuth';
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
    const auth = await requireOwner(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

    const { uid } = await params;

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
    const targetDoc = await db.collection('users').doc(uid).get();
    if (!targetDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const previousRole = targetDoc.data()?.role;

    // 역할 변경
    await db.collection('users').doc(uid).update({
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Admin log 기록
    await db.collection('admin_logs').add({
      action: 'UPDATE_USER_ROLE',
      performedBy: auth.uid,
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
