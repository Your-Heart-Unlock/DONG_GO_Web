import { NextRequest, NextResponse } from 'next/server';

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  telephone?: string;
  link?: string;
  source?: 'kakao' | 'naver';
}

/**
 * 카카오 장소 검색 (내부 함수)
 */
async function searchKakao(query: string, page: number, size: number): Promise<{
  places: PlaceResult[];
  total: number;
  isEnd: boolean;
} | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    console.warn('[searchKakao] KAKAO_REST_API_KEY 미설정');
    return null;
  }

  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&page=${page}&size=${size}`,
      {
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error('[searchKakao] API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();

    const places: PlaceResult[] = data.documents.map((doc: {
      id: string;
      place_name: string;
      category_name: string;
      phone: string;
      address_name: string;
      road_address_name: string;
      x: string;
      y: string;
      place_url: string;
    }) => ({
      placeId: doc.id,
      name: doc.place_name,
      address: doc.road_address_name || doc.address_name,
      category: doc.category_name.split('>').pop()?.trim() || doc.category_name,
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
      telephone: doc.phone || undefined,
      link: doc.place_url,
      source: 'kakao' as const,
    }));

    return {
      places,
      total: data.meta.pageable_count,
      isEnd: data.meta.is_end,
    };
  } catch (error) {
    console.error('[searchKakao] Exception:', error);
    return null;
  }
}

/**
 * 네이버 장소 검색 (폴백용)
 */
async function searchNaver(query: string, page: number, size: number): Promise<{
  places: PlaceResult[];
  total: number;
  isEnd: boolean;
} | null> {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[searchNaver] NAVER_SEARCH_CLIENT_ID 또는 NAVER_SEARCH_CLIENT_SECRET 미설정');
    return null;
  }

  try {
    const start = (page - 1) * size + 1;
    const response = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${size}&start=${start}&sort=comment`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    if (!response.ok) {
      console.error('[searchNaver] API error:', response.status);
      return null;
    }

    const data = await response.json();

    const places: PlaceResult[] = data.items.map((item: {
      title: string;
      link: string;
      category: string;
      description: string;
      telephone: string;
      address: string;
      roadAddress: string;
      mapx: string;
      mapy: string;
    }) => {
      // 링크에서 placeId 추출
      let placeId = '';
      if (item.link) {
        const linkMatch = item.link.match(/place\/(\d+)/) || item.link.match(/entry\/place\/(\d+)/);
        if (linkMatch) {
          placeId = `naver_${linkMatch[1]}`;
        } else {
          // placeId 추출 실패 시 임시 ID 생성
          placeId = `naver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
      }

      // 네이버 카텍 좌표 → WGS84 근사 변환
      const lng = parseInt(item.mapx) / 10000000;
      const lat = parseInt(item.mapy) / 10000000;

      return {
        placeId,
        name: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
        address: item.roadAddress || item.address,
        category: item.category.split('>').pop()?.trim() || item.category,
        lat,
        lng,
        telephone: item.telephone || undefined,
        link: item.link,
        source: 'naver' as const,
      };
    });

    return {
      places,
      total: data.total,
      isEnd: start + data.items.length >= data.total,
    };
  } catch (error) {
    console.error('[searchNaver] Exception:', error);
    return null;
  }
}

/**
 * 장소 검색 API
 * GET /api/search/places?query=검색어&page=1&provider=kakao
 *
 * provider 파라미터:
 * - 'kakao' (기본값): 카카오만 검색
 * - 'naver': 네이버만 검색
 *
 * 필요한 환경변수:
 * - KAKAO_REST_API_KEY (카카오)
 * - NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET (네이버)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const page = parseInt(searchParams.get('page') || '1');
    const provider = (searchParams.get('provider') || 'kakao') as 'kakao' | 'naver';
    const size = provider === 'naver' ? 5 : 10;

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: '검색어는 2글자 이상 입력해주세요.' },
        { status: 400 }
      );
    }

    let result;
    let searchSource: 'kakao' | 'naver';

    if (provider === 'naver') {
      // 네이버 직접 검색
      result = await searchNaver(query, page, size);
      searchSource = 'naver';
    } else {
      // 카카오 검색 (폴백 없음)
      result = await searchKakao(query, page, size);
      searchSource = 'kakao';
    }

    if (!result) {
      return NextResponse.json(
        { error: '검색에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    console.log(`[search/places] "${query}" 검색 완료 (${searchSource}): ${result.places.length}개`);

    return NextResponse.json({
      places: result.places,
      pagination: {
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / size),
        hasMore: !result.isEnd,
      },
      source: searchSource,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
