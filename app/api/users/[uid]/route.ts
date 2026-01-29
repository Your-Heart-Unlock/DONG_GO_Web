import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

interface RouteParams {
  params: Promise<{ uid: string }>;
}

/**
 * GET /api/users/[uid]
 * 사용자 정보 조회 (nickname)
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { uid } = await params;

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const userDoc = await adminDb.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    return NextResponse.json({
      uid: userDoc.id,
      nickname: userData?.nickname || '알 수 없음',
    });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
