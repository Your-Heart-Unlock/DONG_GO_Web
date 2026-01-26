import { NextRequest, NextResponse } from 'next/server';

/**
 * 네이버 지역 검색 API
 * GET /api/search/places?query=검색어
 *
 * 네이버 오픈 API (developers.naver.com) 사용
 * 필요한 환경변수:
 * - NAVER_SEARCH_CLIENT_ID
 * - NAVER_SEARCH_CLIENT_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const page = parseInt(searchParams.get('page') || '1');
    const display = 10; // 한 페이지당 결과 수
    const start = (page - 1) * display + 1; // 시작 인덱스 (1부터 시작)

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: '검색어는 2글자 이상 입력해주세요.' },
        { status: 400 }
      );
    }

    const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: '네이버 검색 API가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 네이버 지역 검색 API 호출
    const response = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&start=${start}&sort=comment`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    if (!response.ok) {
      console.error('Naver API error:', response.status, await response.text());
      return NextResponse.json(
        { error: '검색에 실패했습니다.' },
        { status: 500 }
      );
    }

    const data = await response.json();

    // 응답 데이터 변환
    const places = data.items.map((item: {
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
      // 네이버 지도 링크에서 placeId 추출 시도
      // link 형식: https://map.naver.com/p/entry/place/1234567890
      let placeId = '';
      const linkMatch = item.link.match(/place\/(\d+)/);
      if (linkMatch) {
        placeId = linkMatch[1];
      } else {
        // placeId를 추출할 수 없으면 좌표 기반으로 생성
        placeId = `${item.mapx}_${item.mapy}`;
      }

      // 좌표 변환 (카텍 좌표 -> WGS84)
      // 네이버 지역 검색 API는 카텍 좌표를 반환
      const lng = parseInt(item.mapx) / 10000000;
      const lat = parseInt(item.mapy) / 10000000;

      return {
        placeId,
        name: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
        address: item.roadAddress || item.address,
        category: item.category.split('>').pop()?.trim() || item.category,
        lat,
        lng,
        telephone: item.telephone,
        link: item.link,
      };
    });

    return NextResponse.json({
      places,
      pagination: {
        total: data.total,
        start: data.start,
        display: data.display,
        page,
        totalPages: Math.ceil(data.total / display),
        hasMore: start + display <= data.total,
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
