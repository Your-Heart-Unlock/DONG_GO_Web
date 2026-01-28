import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Place, PlaceStats, SearchQuery, RatingTier } from '@/types';

/**
 * Firestore에 저장된 장소 필터링 API
 * GET /api/places/filter?categories=한식,일식&tiers=S,A&...
 */
export async function GET(request: NextRequest) {
  try {
    // adminDb 체크
    if (!adminDb) {
      console.error('[Filter API] adminDb is not initialized');
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    // 1. Query 파라미터 파싱
    const sortByParam = searchParams.get('sortBy');
    const query: SearchQuery = {
      keyword: searchParams.get('keyword') || undefined,
      categories: searchParams.get('categories')?.split(',').filter(Boolean),
      tiers: searchParams.get('tiers')?.split(',').filter(Boolean) as RatingTier[] | undefined,
      regions: searchParams.get('regions')?.split(',').filter(Boolean),
      minReviews: searchParams.get('minReviews') ? parseInt(searchParams.get('minReviews')!) : undefined,
      wishOnly: searchParams.get('wishOnly') === 'true',
      unvisitedOnly: searchParams.get('unvisitedOnly') === 'true',
      sortBy: (sortByParam === 'recent' || sortByParam === 'rating' || sortByParam === 'reviews' || sortByParam === 'wishes') ? sortByParam : 'recent',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    const uid = searchParams.get('uid') || undefined;

    console.log('[Filter API] Query params:', query);

    // 2. Firestore 쿼리 구성 (기본: active 상태만)
    let placesQuery = adminDb
      .collection('places')
      .where('status', '==', 'active');

    // 카테고리 필터 (Firestore 'in' 쿼리)
    // 10개 초과 시 클라이언트 필터링으로 처리
    const useCategoryFilter = query.categories && query.categories.length > 0 && query.categories.length <= 10;
    if (useCategoryFilter) {
      placesQuery = placesQuery.where('category', 'in', query.categories);
    }

    // 3. 쿼리 실행
    const snapshot = await placesQuery.get();
    let places: (Place & { placeId: string })[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        placeId: doc.id,
        name: data.name,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        category: data.category,
        categoryCode: data.categoryCode,
        source: data.source,
        status: data.status,
        mapProvider: data.mapProvider,
        cellId: data.cellId,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || undefined,
      };
    });

    console.log('[Filter API] Initial places count:', places.length);

    // 4. 클라이언트 필터링 (Firestore 쿼리로 불가능한 조건들)

    // 카테고리 필터 (10개 초과 시 여기서 처리)
    if (query.categories && query.categories.length > 10) {
      places = places.filter(p => query.categories!.includes(p.category));
      console.log('[Filter API] After category filter:', places.length);
    }

    // 등급 필터 (stats 조인 필요)
    if (query.tiers && query.tiers.length > 0) {
      const placeIds = places.map(p => p.placeId);
      const statsPromises = placeIds.map(id =>
        adminDb!.collection('stats').doc(id).get()
      );
      const statsSnapshot = await Promise.all(statsPromises);

      const placeStatsMap = new Map<string, PlaceStats>();
      statsSnapshot.forEach((doc, idx) => {
        if (doc.exists) {
          const data = doc.data();
          // Defensive: ensure required fields exist with defaults
          placeStatsMap.set(placeIds[idx], {
            reviewCount: data?.reviewCount ?? 0,
            tierCounts: data?.tierCounts ?? { S: 0, A: 0, B: 0, C: 0, F: 0 },
            topTags: data?.topTags ?? [],
          });
        }
      });

      console.log('[Filter API] Stats found for', placeStatsMap.size, 'of', placeIds.length, 'places');

      places = places.filter(place => {
        const stats = placeStatsMap.get(place.placeId);

        // No stats document = no reviews = doesn't match tier filter
        if (!stats) {
          console.log(`[Filter API] No stats for place: ${place.placeId} (${place.name})`);
          return false;
        }

        const reviewCount = stats.reviewCount ?? 0;
        if (reviewCount === 0) {
          console.log(`[Filter API] Zero reviews for place: ${place.placeId} (${place.name})`);
          return false;
        }

        // 평균 등급 계산
        const tierWeights: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, F: 1 };
        const tierCounts = stats.tierCounts ?? { S: 0, A: 0, B: 0, C: 0, F: 0 };

        const totalWeight = Object.entries(tierCounts).reduce(
          (sum, [tier, count]) => {
            const weight = tierWeights[tier] ?? 0;
            const tierCount = (count as number) ?? 0;
            return sum + weight * tierCount;
          },
          0
        );
        const avgWeight = totalWeight / reviewCount;

        // 평균 등급을 tier로 변환
        let avgTier: RatingTier = 'C';
        if (avgWeight >= 4.5) avgTier = 'S';
        else if (avgWeight >= 3.5) avgTier = 'A';
        else if (avgWeight >= 2.5) avgTier = 'B';
        else if (avgWeight >= 1.5) avgTier = 'C';
        else avgTier = 'F';

        const matches = query.tiers!.includes(avgTier);
        console.log(`[Filter API] Place ${place.name}: tierCounts=${JSON.stringify(tierCounts)}, reviewCount=${reviewCount}, avgWeight=${avgWeight.toFixed(2)}, avgTier=${avgTier}, matches=${matches}`);

        return matches;
      });
      console.log('[Filter API] After tier filter:', places.length);
    }

    // 키워드 검색
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      places = places.filter(p =>
        p.name.toLowerCase().includes(keyword) ||
        p.address.toLowerCase().includes(keyword)
      );
      console.log('[Filter API] After keyword filter:', places.length);
    }

    // 지역 필터
    if (query.regions && query.regions.length > 0) {
      places = places.filter(p =>
        query.regions!.some(region => p.address.includes(region))
      );
      console.log('[Filter API] After region filter:', places.length);
    }

    // 리뷰 수 필터
    if (query.minReviews) {
      const placeIds = places.map(p => p.placeId);
      const statsPromises = placeIds.map(id =>
        adminDb!.collection('stats').doc(id).get()
      );
      const statsSnapshot = await Promise.all(statsPromises);

      const reviewCountMap = new Map<string, number>();
      statsSnapshot.forEach((doc, idx) => {
        if (doc.exists) {
          reviewCountMap.set(placeIds[idx], (doc.data() as PlaceStats).reviewCount || 0);
        }
      });

      places = places.filter(p => {
        const count = reviewCountMap.get(p.placeId) || 0;
        return count >= query.minReviews!;
      });
      console.log('[Filter API] After minReviews filter:', places.length);
    }

    // 5. 사용자별 필터
    if (uid) {
      // wishOnly
      if (query.wishOnly) {
        const wishSnapshot = await adminDb!
          .collection('wishes')
          .where('uid', '==', uid)
          .get();
        const wishPlaceIds = new Set(
          wishSnapshot.docs.map(doc => doc.data().placeId)
        );
        places = places.filter(p => wishPlaceIds.has(p.placeId));
        console.log('[Filter API] After wishOnly filter:', places.length);
      }

      // unvisitedOnly
      if (query.unvisitedOnly) {
        const reviewSnapshot = await adminDb!
          .collection('reviews')
          .where('uid', '==', uid)
          .get();
        const visitedPlaceIds = new Set(
          reviewSnapshot.docs.map(doc => doc.data().placeId)
        );
        places = places.filter(p => !visitedPlaceIds.has(p.placeId));
        console.log('[Filter API] After unvisitedOnly filter:', places.length);
      }
    }

    // 6. 정렬
    if (query.sortBy === 'recent') {
      places.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return query.sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      });
    }
    // 다른 정렬 옵션은 추후 구현 (rating, reviews, wishes는 stats 필요)

    // 7. 통계 계산
    const categoryCounts: { [key: string]: number } = {};
    const tierCounts: { [key: string]: number } = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'unknown';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    console.log('[Filter API] Final places count:', places.length);

    return NextResponse.json({
      places,
      stats: {
        totalCount: snapshot.size,
        filteredCount: places.length,
        categoryCounts,
        tierCounts,
      },
    });
  } catch (error) {
    console.error('[Filter API] Error:', error);
    return NextResponse.json(
      { error: '필터링 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
