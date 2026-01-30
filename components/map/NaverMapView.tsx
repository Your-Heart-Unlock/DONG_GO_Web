'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useNaverMaps } from '@/lib/naver/useNaverMaps';
import { Place } from '@/types';
import { getCellIdsForBounds } from '@/lib/utils/cellId';
import { getCategoryIconPath, tierToIconGrade } from '@/lib/utils/categoryIcon';

export interface MapBounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

interface NaverMapViewProps {
  places: Place[];
  onMarkerClick?: (place: Place) => void;
  onBoundsChange?: (bounds: MapBounds, zoom: number) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  isFilterActive?: boolean; // 필터 활성화 여부
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
  isFilterActive = false,
}: NaverMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<naver.maps.Map | null>(null);
  // placeId → marker 매핑 (캐싱 유지)
  const markerMapRef = useRef<Map<string, naver.maps.Marker>>(new Map());
  // 마커 클러스터링 인스턴스
  const markerClusterRef = useRef<any>(null);
  // 콜백 ref (이벤트 리스너에서 최신 참조 사용)
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onMarkerClickRef = useRef(onMarkerClick);
  const isFilterActiveRef = useRef(isFilterActive);

  onBoundsChangeRef.current = onBoundsChange;
  onMarkerClickRef.current = onMarkerClick;
  isFilterActiveRef.current = isFilterActive;

  const { isLoaded, error } = useNaverMaps();

  // 마커 가시성 업데이트: 줌 레벨이 너무 낮을 때만 숨김 (클러스터 미사용 시만)
  const updateMarkerVisibility = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 클러스터가 있으면 클러스터가 마커 가시성을 관리하므로 스킵
    if (markerClusterRef.current) {
      console.log('[NaverMapView] 클러스터 모드: 마커 가시성은 클러스터가 관리');
      return;
    }

    // 필터 모드에서는 모든 마커를 항상 표시
    if (isFilterActiveRef.current) {
      markerMapRef.current.forEach((marker) => {
        marker.setVisible(true);
      });
      console.log('[NaverMapView] 필터 모드: 모든 마커 표시');
      return;
    }

    // 일반 모드: 줌 레벨이 너무 낮을 때만 마커 숨김
    const mapBounds = getMapBounds(map);
    const cellIds = getCellIdsForBounds(mapBounds);
    const tooZoomedOut = cellIds === null;

    markerMapRef.current.forEach((marker) => {
      // 줌 아웃 과다 시에만 숨김
      marker.setVisible(!tooZoomedOut);
    });

    console.log('[NaverMapView] 마커 가시성 업데이트:', {
      markerCount: markerMapRef.current.size,
      tooZoomedOut,
      visible: !tooZoomedOut
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

    // MarkerClustering 초기화
    if (naver.maps.MarkerClustering) {
      console.log('[NaverMapView] MarkerClustering 사용 가능, 초기화 중...');
      const htmlMarker = {
        content: '<div style="cursor:pointer;width:40px;height:40px;line-height:42px;font-size:12px;color:white;text-align:center;font-weight:bold;background:url(https://navermaps.github.io/maps.js.ncp/docs/img/cluster-marker-1.png);background-size:contain;"></div>',
        size: new naver.maps.Size(40, 40),
        anchor: new naver.maps.Point(20, 20)
      };

      markerClusterRef.current = new naver.maps.MarkerClustering({
        minClusterSize: 2,
        maxZoom: 14,
        map: map,
        markers: [],
        disableClickZoom: false,
        gridSize: 120,
        icons: [htmlMarker],
        indexGenerator: [10, 100, 200, 500, 1000],
        stylingFunction: (clusterMarker: any, count: number) => {
          const element = clusterMarker.getElement();
          element.querySelector('div').textContent = count;
        }
      });
      console.log('[NaverMapView] MarkerClustering 초기화 완료');
    } else {
      console.log('[NaverMapView] MarkerClustering 사용 불가, 일반 마커 사용');
    }

    // idle 이벤트: zoom/pan 완료 후 발생
    naver.maps.Event.addListener(map, 'idle', () => {
      const bounds = getMapBounds(map);
      const currentZoom = map.getZoom();
      onBoundsChangeRef.current?.(bounds, currentZoom);
      updateMarkerVisibility();
    });

    // 지도 초기화 직후 bounds 로딩 강제 트리거 (페이지 복귀 시 마커 복원)
    console.log('[NaverMapView] 지도 생성 완료, 초기 데이터 로딩 시작', {
      center: { lat: center.lat, lng: center.lng },
      zoom,
      placesCount: places.length
    });
    setTimeout(() => {
      const bounds = getMapBounds(map);
      const currentZoom = map.getZoom();
      console.log('[NaverMapView] 초기 bounds 로딩 트리거:', {
        bounds,
        zoom: currentZoom,
        onBoundsChangeExists: !!onBoundsChangeRef.current
      });
      onBoundsChangeRef.current?.(bounds, currentZoom);
    }, 100);
  }, [isLoaded, center.lat, center.lng, zoom, updateMarkerVisibility]);

  // 지도 중심/줌 업데이트 (sessionStorage 복원 등 props 변경 시)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentCenter = map.getCenter() as naver.maps.LatLng;
    const currentZoom = map.getZoom();

    const centerChanged =
      Math.abs(currentCenter.lat() - center.lat) > 0.0001 ||
      Math.abs(currentCenter.lng() - center.lng) > 0.0001;
    const zoomChanged = currentZoom !== zoom;

    if (centerChanged || zoomChanged) {
      map.setCenter(new naver.maps.LatLng(center.lat, center.lng));
      map.setZoom(zoom);
    }
  }, [center.lat, center.lng, zoom]);

  // 마커 렌더링 (증분 추가 + 불필요한 마커 제거)
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;
    const currentPlaceIds = new Set(places.map(p => p.placeId));

    console.log('[NaverMapView] 마커 렌더링 시작:', {
      placesCount: places.length,
      existingMarkersCount: markerMapRef.current.size
    });

    // 1. places에 없는 마커 제거 (필터링 또는 장소 삭제 시)
    const markersToRemove: string[] = [];
    markerMapRef.current.forEach((marker, placeId) => {
      if (!currentPlaceIds.has(placeId)) {
        marker.setMap(null);
        markersToRemove.push(placeId);
      }
    });
    markersToRemove.forEach(id => markerMapRef.current.delete(id));
    if (markersToRemove.length > 0) {
      console.log('[NaverMapView] 마커 제거됨:', markersToRemove.length);
    }

    // 2. 새로운 장소의 마커 추가
    let addedCount = 0;
    const useCluster = !!markerClusterRef.current;

    places.forEach((place) => {
      // 이미 생성된 마커는 스킵
      if (markerMapRef.current.has(place.placeId)) return;

      const iconGrade = tierToIconGrade(place.avgTier);
      const iconPath = getCategoryIconPath(place.categoryKey ?? 'Idle', iconGrade);

      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(place.lat, place.lng),
        map: useCluster ? null : map, // 클러스터가 있으면 null, 없으면 map에 직접 추가
        title: place.name,
        clickable: true,
        icon: {
          url: iconPath,
          size: new naver.maps.Size(29, 38),
          scaledSize: new naver.maps.Size(29, 38),
          anchor: new naver.maps.Point(14, 38),
        },
      });

      naver.maps.Event.addListener(marker, 'click', () => {
        onMarkerClickRef.current?.(place);
      });

      markerMapRef.current.set(place.placeId, marker);
      addedCount++;
    });

    if (addedCount > 0) {
      console.log('[NaverMapView] 마커 추가됨:', addedCount, useCluster ? '(클러스터 사용)' : '(직접 표시)');
    }

    // 3. 클러스터 업데이트 또는 마커 가시성 갱신
    if (markerClusterRef.current) {
      const allMarkers = Array.from(markerMapRef.current.values());
      markerClusterRef.current.setMarkers(allMarkers);
      console.log('[NaverMapView] 클러스터 업데이트:', allMarkers.length, '개 마커');
    } else {
      // 클러스터링이 없으면 기존 방식대로 마커 가시성 갱신
      updateMarkerVisibility();
    }

    console.log('[NaverMapView] 마커 렌더링 완료, 총 마커 수:', markerMapRef.current.size);
  }, [places, isLoaded, updateMarkerVisibility]);

  // Cleanup
  useEffect(() => {
    return () => {
      // 클러스터 정리
      if (markerClusterRef.current) {
        markerClusterRef.current.setMap(null);
        markerClusterRef.current = null;
      }
      // 마커 정리
      markerMapRef.current.forEach((marker) => marker.setMap(null));
      markerMapRef.current.clear();
      // 지도 정리
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
