import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/verifyAuth';

/**
 * Admin Users API
 * GET /api/admin/users - 사용자 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

    // 사용자 목록 조회
    const usersSnapshot = await db
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
