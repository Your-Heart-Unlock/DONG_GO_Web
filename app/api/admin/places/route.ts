import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/verifyAuth';

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
    const auth = await requireOwner(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

    // Query params 파싱
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const cursor = searchParams.get('cursor');
    const filter = searchParams.get('filter') || 'all';

    // Firestore 쿼리 구성
    let query = db
      .collection('places')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(limit + 1); // 다음 페이지 존재 여부 확인용 +1

    // 필터 적용: 미분류 = Idle 또는 Other (제대로 분류되지 않은 장소)
    if (filter === 'uncategorized' || filter === 'idle') {
      query = db
        .collection('places')
        .where('status', '==', 'active')
        .where('categoryCode', 'in', ['DINING', 'CAFE', 'BAR'])
        .orderBy('createdAt', 'desc')
        .limit(limit + 1);
    }

    // 커서 기반 페이지네이션
    if (cursor) {
      const cursorDoc = await db.collection('places').doc(cursor).get();
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
    let totalQuery = db.collection('places').where('status', '==', 'active');
    if (filter === 'uncategorized' || filter === 'idle') {
      totalQuery = totalQuery.where('categoryKey', 'in', ['Idle', 'Other']);
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
