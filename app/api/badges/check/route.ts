import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { checkAndAwardBadges, getUserBadges, getBadgeInfo } from '@/lib/firebase/badges';

/**
 * POST /api/badges/check
 * 사용자의 뱃지를 체크하고 새로 획득한 뱃지를 반환합니다.
 */
export async function POST(request: NextRequest) {
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

    // 뱃지 체크 및 부여
    const newBadgeIds = await checkAndAwardBadges(uid);

    // 새로 획득한 뱃지 정보 조회
    const newBadges = newBadgeIds
      .map((id) => getBadgeInfo(id))
      .filter((badge) => badge !== undefined);

    // 전체 뱃지 컬렉션 조회
    const userBadges = await getUserBadges(uid);

    return NextResponse.json({
      newBadges,
      totalBadges: userBadges?.badges.length || 0,
      representativeBadgeId: userBadges?.representativeBadgeId || null,
    });
  } catch (error) {
    console.error('Badge check error:', error);
    return NextResponse.json(
      { error: 'Failed to check badges' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/badges/check
 * 사용자의 전체 뱃지 목록을 반환합니다.
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

    // 사용자 뱃지 조회
    const userBadges = await getUserBadges(uid);

    return NextResponse.json({
      badges: userBadges?.badges || [],
      representativeBadgeId: userBadges?.representativeBadgeId || null,
    });
  } catch (error) {
    console.error('Badge fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch badges' },
      { status: 500 }
    );
  }
}
