'use client';

import { useEffect, useState } from 'react';

const SCRIPT_ID = 'naver-maps-sdk';
const CLUSTER_SCRIPT_ID = 'naver-maps-clustering';

/**
 * 네이버 지도 SDK 로드 훅 (MarkerClustering 포함)
 */
export function useNaverMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // 이미 완전히 로드되었으면 skip
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (window.naver && window.naver.maps && (window.naver.maps as any).MarkerClustering) {
      setIsLoaded(true);
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

    if (!clientId || clientId === 'placeholder') {
      setError(new Error('Naver Maps Client ID is not configured'));
      return;
    }

    // 클러스터링 스크립트 로드 함수
    const loadClusteringScript = () => {
      const existingClusterScript = document.getElementById(CLUSTER_SCRIPT_ID);
      if (existingClusterScript) {
        if ((existingClusterScript as HTMLScriptElement).dataset.loaded === 'true') {
          setIsLoaded(true);
        } else {
          existingClusterScript.addEventListener('load', () => setIsLoaded(true));
        }
        return;
      }

      const clusterScript = document.createElement('script');
      clusterScript.id = CLUSTER_SCRIPT_ID;
      clusterScript.src = 'https://navermaps.github.io/maps.js.ncp/docs/js/MarkerClustering.js';
      clusterScript.async = true;

      clusterScript.onload = () => {
        clusterScript.dataset.loaded = 'true';
        console.log('[useNaverMaps] MarkerClustering 라이브러리 로드 완료');
        setIsLoaded(true);
      };

      clusterScript.onerror = () => {
        console.warn('[useNaverMaps] MarkerClustering 로드 실패, 기본 마커 사용');
        // 클러스터링 없이도 지도는 사용 가능
        setIsLoaded(true);
      };

      document.head.appendChild(clusterScript);
    };

    // 이미 네이버 지도 스크립트가 로드되어 있으면 클러스터링만 로드
    if (window.naver && window.naver.maps) {
      loadClusteringScript();
      return;
    }

    // 이미 스크립트가 추가되어 있으면 로드 완료 대기
    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) {
      if ((existingScript as HTMLScriptElement).dataset.loaded === 'true') {
        loadClusteringScript();
      } else {
        existingScript.addEventListener('load', () => loadClusteringScript());
      }
      return;
    }

    // 네이버 지도 스크립트 동적 로드
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    script.async = true;

    script.onload = () => {
      script.dataset.loaded = 'true';
      console.log('[useNaverMaps] 네이버 지도 SDK 로드 완료');
      // 지도 로드 후 클러스터링 스크립트 로드
      loadClusteringScript();
    };

    script.onerror = () => {
      setError(new Error('Failed to load Naver Maps SDK'));
    };

    document.head.appendChild(script);

    // cleanup에서 스크립트를 제거하지 않음 (Strict Mode 대응)
  }, []);

  return { isLoaded, error };
}
