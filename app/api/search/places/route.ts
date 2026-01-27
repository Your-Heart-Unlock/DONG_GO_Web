import { NextRequest, NextResponse } from 'next/server';

/**
 * 카카오 장소 검색 API
 * GET /api/search/places?query=검색어&page=1
 *
 * 카카오 REST API (developers.kakao.com) 사용
 * 필요한 환경변수:
 * - KAKAO_REST_API_KEY
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const page = parseInt(searchParams.get('page') || '1');
    const size = 10; // 한 페이지당 결과 수 (카카오 최대 15)

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: '검색어는 2글자 이상 입력해주세요.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.KAKAO_REST_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: '카카오 검색 API가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 카카오 키워드 장소 검색 API 호출
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&page=${page}&size=${size}`,
      {
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Kakao API error:', response.status, await response.text());
      return NextResponse.json(
        { error: '검색에 실패했습니다.' },
        { status: 500 }
      );
    }

    const data = await response.json();

    // 응답 데이터 변환
    const places = data.documents.map((doc: {
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
    }));

    const meta = data.meta;

    return NextResponse.json({
      places,
      pagination: {
        total: meta.pageable_count,
        page,
        totalPages: Math.ceil(meta.pageable_count / size),
        hasMore: !meta.is_end,
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
