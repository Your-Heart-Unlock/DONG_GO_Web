import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { setRepresentativeBadge, clearRepresentativeBadge, getUserBadges } from '@/lib/firebase/badges';

/**
 * PATCH /api/users/me/representative-badge
 * 대표 뱃지를 설정합니다.
 */
export async function PATCH(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const body = await request.json();
    const { badgeId } = body;

    if (!badgeId) {
      return NextResponse.json({ error: 'badgeId is required' }, { status: 400 });
    }

    // 대표 뱃지 설정
    await setRepresentativeBadge(uid, badgeId);

    return NextResponse.json({
      success: true,
      representativeBadgeId: badgeId,
    });
  } catch (error) {
    console.error('Set representative badge error:', error);

    if (error instanceof Error) {
      if (error.message === '보유하지 않은 뱃지입니다.') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message === '뱃지 컬렉션이 없습니다.') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to set representative badge' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/me/representative-badge
 * 대표 뱃지를 해제합니다.
 */
export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 대표 뱃지 해제
    await clearRepresentativeBadge(uid);

    return NextResponse.json({
      success: true,
      representativeBadgeId: null,
    });
  } catch (error) {
    console.error('Clear representative badge error:', error);
    return NextResponse.json(
      { error: 'Failed to clear representative badge' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/me/representative-badge
 * 현재 대표 뱃지를 조회합니다.
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 뱃지 컬렉션 조회
    const userBadges = await getUserBadges(uid);

    return NextResponse.json({
      representativeBadgeId: userBadges?.representativeBadgeId || null,
    });
  } catch (error) {
    console.error('Get representative badge error:', error);
    return NextResponse.json(
      { error: 'Failed to get representative badge' },
      { status: 500 }
    );
  }
}
