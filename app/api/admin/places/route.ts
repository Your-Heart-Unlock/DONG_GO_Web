import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

/**
 * Admin Places API
 * GET /api/admin/places?limit=20&cursor=lastPlaceId&filter=uncategorized
 *
 * Query params:
 * - limit: 한 번에 가져올 개수 (기본 20, 최대 100)
 * - cursor: 페이지네이션용 마지막 placeId
 * - filter: 필터 옵션 ('all' | 'uncategorized' | 'idle')
 */
export async function GET(request: NextRequest) {
  try {
    // Firebase Admin 초기화 확인
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
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Owner role required' },
        { status: 403 }
      );
    }

    // Query params 파싱
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const cursor = searchParams.get('cursor');
    const filter = searchParams.get('filter') || 'all';

    // Firestore 쿼리 구성
    let query = adminDb
      .collection('places')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(limit + 1); // 다음 페이지 존재 여부 확인용 +1

    // 필터 적용
    if (filter === 'uncategorized') {
      // categoryKey가 없거나 'Idle'인 장소
      query = adminDb
        .collection('places')
        .where('status', '==', 'active')
        .where('categoryKey', '==', 'Idle')
        .orderBy('createdAt', 'desc')
        .limit(limit + 1);
    } else if (filter === 'idle') {
      // categoryKey가 'Idle'인 장소만
      query = adminDb
        .collection('places')
        .where('status', '==', 'active')
        .where('categoryKey', '==', 'Idle')
        .orderBy('createdAt', 'desc')
        .limit(limit + 1);
    }

    // 커서 기반 페이지네이션
    if (cursor) {
      const cursorDoc = await adminDb.collection('places').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const places = snapshot.docs.slice(0, limit).map(doc => {
      const data = doc.data();
      return {
        placeId: doc.id,
        name: data.name,
        address: data.address,
        category: data.category,
        categoryKey: data.categoryKey || 'Idle',
        source: data.source,
        mapProvider: data.mapProvider,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    const hasMore = snapshot.docs.length > limit;
    const nextCursor = hasMore ? places[places.length - 1]?.placeId : null;

    // 전체 개수 조회 (필터별)
    let totalQuery = adminDb.collection('places').where('status', '==', 'active');
    if (filter === 'uncategorized' || filter === 'idle') {
      totalQuery = totalQuery.where('categoryKey', '==', 'Idle');
    }
    const totalSnapshot = await totalQuery.count().get();
    const total = totalSnapshot.data().count;

    return NextResponse.json({
      places,
      pagination: {
        total,
        limit,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error('Admin places API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
