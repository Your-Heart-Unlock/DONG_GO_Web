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
      console.warn('[naver-resolve] NAVER_SEARCH_CLIENT_ID 또는 NAVER_SEARCH_CLIENT_SECRET 미설정');
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

    console.log(`[naver-resolve] 검색: "${name}", 좌표: (${lat}, ${lng}), 결과: ${data.items?.length || 0}개`);

    // 각 결과에서 좌표 근접 매칭
    let bestMatch: string | null = null;
    let bestDistance = Infinity;
    let bestName = '';

    for (const item of data.items) {
      // 네이버 카텍 좌표 → WGS84 근사 변환
      const itemLng = parseInt(item.mapx) / 10000000;
      const itemLat = parseInt(item.mapy) / 10000000;

      // 한국 위도 기준 거리 계산 (미터)
      const dx = (lng - itemLng) * 88000;
      const dy = (lat - itemLat) * 111000;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 링크에서 placeId 추출 (여러 패턴 지원)
      let placeId: string | null = null;
      if (item.link) {
        // 패턴 1: https://map.naver.com/p/entry/place/12345...
        // 패턴 2: https://map.naver.com/place/12345...
        // 패턴 3: https://naver.me/... (단축 URL - 추출 불가)
        const linkMatch = item.link.match(/place\/(\d+)/) || item.link.match(/entry\/place\/(\d+)/);
        if (linkMatch) {
          placeId = linkMatch[1];
        }
      }

      if (distance < bestDistance && placeId) {
        bestDistance = distance;
        bestMatch = placeId;
        bestName = item.title?.replace(/<[^>]*>/g, '') || '';
      }
    }

    // 300m 이내 매칭만 유효 (200m → 300m로 완화)
    if (bestDistance > 300) {
      console.log(`[naver-resolve] 매칭 실패: 최소 거리 ${bestDistance.toFixed(0)}m > 300m`);
      bestMatch = null;
    } else if (bestMatch) {
      console.log(`[naver-resolve] 매칭 성공: "${bestName}" (ID: ${bestMatch}, 거리: ${bestDistance.toFixed(0)}m)`);
    }

    return NextResponse.json({ naverPlaceId: bestMatch });
  } catch (error) {
    console.error('Naver resolve error:', error);
    return NextResponse.json({ naverPlaceId: null });
  }
}
