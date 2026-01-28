'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useNaverMaps } from '@/lib/naver/useNaverMaps';
import { Place, RatingTier } from '@/types';
import { getCellIdsForBounds } from '@/lib/utils/cellId';

// 등급별 마커 색상
const TIER_COLORS: Record<RatingTier | 'none', string> = {
  S: '#8B5CF6', // Purple
  A: '#3B82F6', // Blue
  B: '#22C55E', // Green
  C: '#F97316', // Orange
  F: '#EF4444', // Red
  none: '#9CA3AF', // Gray (등급 없음)
};

// SVG 마커 아이콘 생성
function createMarkerIcon(tier: RatingTier | null | undefined): string {
  const color = tier ? TIER_COLORS[tier] : TIER_COLORS.none;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path fill="${color}" stroke="#fff" stroke-width="1.5" d="M14 1C7.4 1 2 6.4 2 13c0 8.5 12 21 12 21s12-12.5 12-21c0-6.6-5.4-12-12-12z"/><circle fill="#fff" cx="14" cy="13" r="5"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export interface MapBounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

interface NaverMapViewProps {
  places: Place[];
  onMarkerClick?: (place: Place) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

/** 지도 인스턴스에서 현재 bounds 추출 */
function getMapBounds(map: naver.maps.Map): MapBounds {
  const bounds = map.getBounds() as naver.maps.LatLngBounds;
  return {
    sw: { lat: bounds.getSW().lat(), lng: bounds.getSW().lng() },
    ne: { lat: bounds.getNE().lat(), lng: bounds.getNE().lng() },
  };
}

export default function NaverMapView({
  places,
  onMarkerClick,
  onBoundsChange,
  center = { lat: 37.5665, lng: 126.978 }, // 서울 시청 기본값
  zoom = 12,
}: NaverMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<naver.maps.Map | null>(null);
  // placeId → marker 매핑 (캐싱 유지)
  const markerMapRef = useRef<Map<string, naver.maps.Marker>>(new Map());
  // 콜백 ref (이벤트 리스너에서 최신 참조 사용)
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onMarkerClickRef = useRef(onMarkerClick);

  onBoundsChangeRef.current = onBoundsChange;
  onMarkerClickRef.current = onMarkerClick;

  const { isLoaded, error } = useNaverMaps();

  // 마커 가시성 업데이트: 줌 아웃 시 숨김 + 뷰포트 밖 마커 숨김
  const updateMarkerVisibility = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const mapBounds = getMapBounds(map);
    // 셀 수가 30개 초과 (줌 아웃 과다) → 모든 마커 숨김
    const cellIds = getCellIdsForBounds(mapBounds);
    const tooZoomedOut = cellIds === null;

    markerMapRef.current.forEach((marker) => {
      if (tooZoomedOut) {
        marker.setVisible(false);
        return;
      }

      // 뷰포트 안에 있는 마커만 표시
      const pos = marker.getPosition() as naver.maps.LatLng;
      const lat = pos.lat();
      const lng = pos.lng();
      const inBounds =
        lat >= mapBounds.sw.lat &&
        lat <= mapBounds.ne.lat &&
        lng >= mapBounds.sw.lng &&
        lng <= mapBounds.ne.lng;
      marker.setVisible(inBounds);
    });
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    const mapOptions: naver.maps.MapOptions = {
      center: new naver.maps.LatLng(center.lat, center.lng),
      zoom,
      zoomControl: true,
      zoomControlOptions: {
        position: naver.maps.Position.TOP_RIGHT,
      },
      mapTypeControl: false,
      scaleControl: true,
      logoControl: true,
      mapDataControl: false,
    };

    const map = new naver.maps.Map(mapRef.current, mapOptions);
    mapInstanceRef.current = map;

    // idle 이벤트: zoom/pan 완료 후 발생
    naver.maps.Event.addListener(map, 'idle', () => {
      const bounds = getMapBounds(map);
      onBoundsChangeRef.current?.(bounds);
      updateMarkerVisibility();
    });
  }, [isLoaded, center.lat, center.lng, zoom, updateMarkerVisibility]);

  // 마커 렌더링 (증분 추가 + 불필요한 마커 제거)
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;
    const currentPlaceIds = new Set(places.map(p => p.placeId));

    // 1. places에 없는 마커 제거 (필터링 또는 장소 삭제 시)
    const markersToRemove: string[] = [];
    markerMapRef.current.forEach((marker, placeId) => {
      if (!currentPlaceIds.has(placeId)) {
        marker.setMap(null);
        markersToRemove.push(placeId);
      }
    });
    markersToRemove.forEach(id => markerMapRef.current.delete(id));

    // 2. 새로운 장소의 마커 추가
    places.forEach((place) => {
      // 이미 생성된 마커는 스킵
      if (markerMapRef.current.has(place.placeId)) return;

      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(place.lat, place.lng),
        map,
        title: place.name,
        clickable: true,
        icon: {
          url: createMarkerIcon(place.avgTier),
          size: new naver.maps.Size(28, 36),
          anchor: new naver.maps.Point(14, 36),
        },
      });

      naver.maps.Event.addListener(marker, 'click', () => {
        onMarkerClickRef.current?.(place);
      });

      markerMapRef.current.set(place.placeId, marker);
    });

    // 3. 마커 가시성 갱신
    updateMarkerVisibility();
  }, [places, isLoaded, updateMarkerVisibility]);

  // Cleanup
  useEffect(() => {
    return () => {
      markerMapRef.current.forEach((marker) => marker.setMap(null));
      markerMapRef.current.clear();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-100">
        <div className="text-center p-4">
          <p className="text-red-600 font-semibold mb-2">지도 로드 실패</p>
          <p className="text-sm text-gray-600">{error.message}</p>
          <p className="text-xs text-gray-500 mt-2">
            Naver Maps Client ID를 확인해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-100">
        <p className="text-gray-500">지도 로딩 중...</p>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full" />;
}
