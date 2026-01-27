import { NextRequest, NextResponse } from 'next/server';

/**
 * 네이버 장소 ID 매칭 API
 * GET /api/search/naver-resolve?name=장소명&lat=37.xxx&lng=127.xxx
 *
 * 카카오에서 검색한 장소를 네이버 지역 검색으로 조회하여
 * 좌표 근접 매칭으로 네이버 placeId(sid)를 반환.
 *
 * 필요한 환경변수:
 * - NAVER_SEARCH_CLIENT_ID
 * - NAVER_SEARCH_CLIENT_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');

    if (!name || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'name, lat, lng 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ naverPlaceId: null });
    }

    const response = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(name)}&display=5&start=1&sort=comment`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    if (!response.ok) {
      console.error('Naver API error:', response.status);
      return NextResponse.json({ naverPlaceId: null });
    }

    const data = await response.json();

    // 각 결과에서 좌표 근접 매칭
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const item of data.items) {
      // 네이버 카텍 좌표 → WGS84 근사 변환
      const itemLng = parseInt(item.mapx) / 10000000;
      const itemLat = parseInt(item.mapy) / 10000000;

      // 한국 위도 기준 거리 계산 (미터)
      const dx = (lng - itemLng) * 88000;
      const dy = (lat - itemLat) * 111000;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < bestDistance) {
        bestDistance = distance;

        // 링크에서 placeId 추출
        const linkMatch = item.link?.match(/place\/(\d+)/);
        if (linkMatch) {
          bestMatch = linkMatch[1];
        }
      }
    }

    // 200m 이내 매칭만 유효
    if (bestDistance > 200) {
      bestMatch = null;
    }

    return NextResponse.json({ naverPlaceId: bestMatch });
  } catch (error) {
    console.error('Naver resolve error:', error);
    return NextResponse.json({ naverPlaceId: null });
  }
}
