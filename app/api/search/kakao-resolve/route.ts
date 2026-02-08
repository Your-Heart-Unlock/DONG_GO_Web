import { NextRequest, NextResponse } from 'next/server';

/**
 * 카카오 장소 ID 매칭 API
 * GET /api/search/kakao-resolve?name=장소명&lat=37.xxx&lng=127.xxx
 *
 * 네이버에서 검색한 장소를 카카오 키워드 검색으로 조회하여
 * 좌표 근접 매칭으로 카카오 placeId를 반환.
 *
 * 필요한 환경변수:
 * - KAKAO_REST_API_KEY
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

    const apiKey = process.env.KAKAO_REST_API_KEY;

    if (!apiKey) {
      console.warn('[kakao-resolve] KAKAO_REST_API_KEY 미설정');
      return NextResponse.json({ kakaoPlaceId: null });
    }

    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(name)}&x=${lng}&y=${lat}&radius=500&size=5&sort=distance`,
      {
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error('[kakao-resolve] API error:', response.status);
      return NextResponse.json({ kakaoPlaceId: null });
    }

    const data = await response.json();

    console.log(`[kakao-resolve] 검색: "${name}", 좌표: (${lat}, ${lng}), 결과: ${data.documents?.length || 0}개`);

    // 각 결과에서 좌표 근접 매칭
    let bestMatch: string | null = null;
    let bestDistance = Infinity;
    let bestName = '';

    for (const doc of data.documents) {
      const docLng = parseFloat(doc.x);
      const docLat = parseFloat(doc.y);

      // 한국 위도 기준 거리 계산 (미터)
      const dx = (lng - docLng) * 88000;
      const dy = (lat - docLat) * 111000;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < bestDistance && doc.id) {
        bestDistance = distance;
        bestMatch = doc.id;
        bestName = doc.place_name || '';
      }
    }

    // 300m 이내 매칭만 유효
    if (bestDistance > 300) {
      console.log(`[kakao-resolve] 매칭 실패: 최소 거리 ${bestDistance.toFixed(0)}m > 300m`);
      bestMatch = null;
    } else if (bestMatch) {
      console.log(`[kakao-resolve] 매칭 성공: "${bestName}" (ID: ${bestMatch}, 거리: ${bestDistance.toFixed(0)}m)`);
    }

    return NextResponse.json({ kakaoPlaceId: bestMatch });
  } catch (error) {
    console.error('Kakao resolve error:', error);
    return NextResponse.json({ kakaoPlaceId: null });
  }
}
