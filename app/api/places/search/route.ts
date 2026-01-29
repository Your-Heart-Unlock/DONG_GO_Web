import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { inferCategoryKey } from '@/lib/utils/categoryIcon';

/**
 * GET /api/places/search?keyword=맥도날드&limit=10
 * DB 등록 장소 키워드 검색 (이름/주소)
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword')?.trim();
    const limitParam = parseInt(searchParams.get('limit') || '10', 10);

    if (!keyword || keyword.length < 1) {
      return NextResponse.json({ places: [], total: 0 });
    }

    const snapshot = await adminDb
      .collection('places')
      .where('status', '==', 'active')
      .get();

    const keywordLower = keyword.toLowerCase();

    const matched = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          placeId: doc.id,
          name: data.name as string,
          address: data.address as string,
          lat: data.lat as number,
          lng: data.lng as number,
          category: data.category as string,
          categoryKey: (data.categoryKey || inferCategoryKey(data.category || '')) as string,
        };
      })
      .filter(
        (p) =>
          p.name.toLowerCase().includes(keywordLower) ||
          p.address.toLowerCase().includes(keywordLower)
      );

    // 이름이 키워드로 시작하는 결과 우선 정렬
    matched.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(keywordLower) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(keywordLower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;

      const aName = a.name.toLowerCase().includes(keywordLower) ? 0 : 1;
      const bName = b.name.toLowerCase().includes(keywordLower) ? 0 : 1;
      return aName - bName;
    });

    return NextResponse.json({
      places: matched.slice(0, limitParam),
      total: matched.length,
    });
  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json(
      { error: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
