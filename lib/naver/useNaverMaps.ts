'use client';

import { useEffect, useState } from 'react';

const SCRIPT_ID = 'naver-maps-sdk';

/**
 * 네이버 지도 SDK 로드 훅
 */
export function useNaverMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // 이미 로드되었으면 skip
    if (window.naver && window.naver.maps) {
      setIsLoaded(true);
      return;
    }

    // 이미 스크립트가 추가되어 있으면 로드 완료 대기
    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsLoaded(true));
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

    if (!clientId || clientId === 'placeholder') {
      setError(new Error('Naver Maps Client ID is not configured'));
      return;
    }

    // 스크립트 동적 로드
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsLoaded(true);
    };

    script.onerror = () => {
      setError(new Error('Failed to load Naver Maps SDK'));
    };

    document.head.appendChild(script);

    // cleanup에서 스크립트를 제거하지 않음 (Strict Mode 대응)
  }, []);

  return { isLoaded, error };
}
