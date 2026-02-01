'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useNaverMaps } from '@/lib/naver/useNaverMaps';
import { Place } from '@/types';
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
  isFilterActive?: boolean;
}

interface ClusterGroup {
  lat: number;
  lng: number;
  count: number;
  places: Place[];
}

const CLUSTER_MAX_ZOOM = 14;

/** 줌 레벨에 따른 그리드 크기 반환 (줌아웃할수록 더 넓은 영역 클러스터링) */
function getGridSizeForZoom(zoom: number): number {
  // 줌 레벨이 낮을수록 (줌아웃) 그리드 크기 증가
  if (zoom <= 7) return 0.5;    // 약 50km
  if (zoom <= 8) return 0.3;    // 약 30km
  if (zoom <= 9) return 0.15;   // 약 15km
  if (zoom <= 10) return 0.08;  // 약 8km
  if (zoom <= 11) return 0.05;  // 약 5km
  if (zoom <= 12) return 0.03;  // 약 3km
  if (zoom <= 13) return 0.02;  // 약 2km
  return 0.015;                  // 약 1.5km (줌 14)
}

/** 지도 인스턴스에서 현재 bounds 추출 */
function getMapBounds(map: naver.maps.Map): MapBounds {
  const bounds = map.getBounds() as naver.maps.LatLngBounds;
  return {
    sw: { lat: bounds.getSW().lat(), lng: bounds.getSW().lng() },
    ne: { lat: bounds.getNE().lat(), lng: bounds.getNE().lng() },
  };
}

/** 장소들을 그리드 기반으로 클러스터링 (줌 레벨에 따라 동적 그리드) */
function clusterPlaces(places: Place[], zoom: number): ClusterGroup[] {
  const gridSize = getGridSizeForZoom(zoom);
  const grid = new Map<string, Place[]>();

  // O(n) 연산: places 배열을 한 번만 순회
  places.forEach((place) => {
    const gridX = Math.floor(place.lat / gridSize);
    const gridY = Math.floor(place.lng / gridSize);
    const key = `${gridX}_${gridY}`;

    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key)!.push(place);
  });

  const clusters: ClusterGroup[] = [];
  grid.forEach((groupPlaces) => {
    const avgLat = groupPlaces.reduce((sum, p) => sum + p.lat, 0) / groupPlaces.length;
    const avgLng = groupPlaces.reduce((sum, p) => sum + p.lng, 0) / groupPlaces.length;

    clusters.push({
      lat: avgLat,
      lng: avgLng,
      count: groupPlaces.length,
      places: groupPlaces,
    });
  });

  return clusters;
}

export default function NaverMapView({
  places,
  onMarkerClick,
  onBoundsChange,
  center = { lat: 37.5665, lng: 126.978 },
  zoom = 12,
  isFilterActive = false,
}: NaverMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<naver.maps.Map | null>(null);
  const markerMapRef = useRef<Map<string, naver.maps.Marker>>(new Map());
  const clusterMarkersRef = useRef<naver.maps.Marker[]>([]);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onMarkerClickRef = useRef(onMarkerClick);
  const isFilterActiveRef = useRef(isFilterActive);
  const placesRef = useRef<Place[]>(places);

  onBoundsChangeRef.current = onBoundsChange;
  onMarkerClickRef.current = onMarkerClick;
  isFilterActiveRef.current = isFilterActive;
  placesRef.current = places;

  const { isLoaded, error } = useNaverMaps();

  // 클러스터 마커 생성
  const createClusterMarker = useCallback((cluster: ClusterGroup, map: naver.maps.Map) => {
    const clusterIcon = {
      content: `<div style="
        cursor: pointer;
        width: 40px;
        height: 40px;
        line-height: 40px;
        font-size: 14px;
        color: #333;
        text-align: center;
        font-weight: bold;
        background: #E5E7EB;
        border-radius: 50%;
        border: 2px solid #9CA3AF;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">${cluster.count}</div>`,
      size: new naver.maps.Size(40, 40),
      anchor: new naver.maps.Point(20, 20),
    };

    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(cluster.lat, cluster.lng),
      map: map,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      icon: clusterIcon as any,
    });

    // 클러스터 클릭 시 줌인
    naver.maps.Event.addListener(marker, 'click', () => {
      map.setCenter(new naver.maps.LatLng(cluster.lat, cluster.lng));
      map.setZoom(map.getZoom() + 2);
    });

    return marker;
  }, []);

  // 클러스터 및 마커 업데이트
  const updateMarkersAndClusters = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentZoom = map.getZoom();
    const showClusters = currentZoom <= CLUSTER_MAX_ZOOM && !isFilterActiveRef.current;

    console.log('[NaverMapView] 마커/클러스터 업데이트:', { zoom: currentZoom, showClusters });

    // 기존 클러스터 마커 제거
    clusterMarkersRef.current.forEach((marker) => marker.setMap(null));
    clusterMarkersRef.current = [];

    if (showClusters) {
      // 클러스터 모드: 개별 마커 숨기고 클러스터 표시
      markerMapRef.current.forEach((marker) => marker.setVisible(false));

      const clusters = clusterPlaces(placesRef.current, currentZoom);
      clusters.forEach((cluster) => {
        const clusterMarker = createClusterMarker(cluster, map);
        clusterMarkersRef.current.push(clusterMarker);
      });

      console.log('[NaverMapView] 클러스터 생성:', clusters.length, '개 (줌:', currentZoom, ', 그리드:', getGridSizeForZoom(currentZoom), ')');
    } else {
      // 개별 마커 모드: 클러스터 숨기고 개별 마커 표시
      markerMapRef.current.forEach((marker) => marker.setVisible(true));
      console.log('[NaverMapView] 개별 마커 표시:', markerMapRef.current.size, '개');
    }
  }, [createClusterMarker]);

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

    console.log('[NaverMapView] 지도 생성 완료');

    // idle 이벤트: zoom/pan 완료 후 발생
    naver.maps.Event.addListener(map, 'idle', () => {
      const bounds = getMapBounds(map);
      const currentZoom = map.getZoom();
      onBoundsChangeRef.current?.(bounds, currentZoom);
      updateMarkersAndClusters();
    });

    // 초기 bounds 로딩
    setTimeout(() => {
      const bounds = getMapBounds(map);
      const currentZoom = map.getZoom();
      onBoundsChangeRef.current?.(bounds, currentZoom);
    }, 100);
  }, [isLoaded, center.lat, center.lng, zoom, updateMarkersAndClusters]);

  // 지도 중심/줌 업데이트
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

  // 마커 렌더링
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;
    const currentPlaceIds = new Set(places.map((p) => p.placeId));
    const currentZoom = map.getZoom();
    const showClusters = currentZoom <= CLUSTER_MAX_ZOOM && !isFilterActive;

    console.log('[NaverMapView] 마커 렌더링 시작:', { placesCount: places.length });

    // 1. 삭제된 장소의 마커 제거
    const markersToRemove: string[] = [];
    markerMapRef.current.forEach((marker, placeId) => {
      if (!currentPlaceIds.has(placeId)) {
        marker.setMap(null);
        markersToRemove.push(placeId);
      }
    });
    markersToRemove.forEach((id) => markerMapRef.current.delete(id));

    // 2. 새로운 장소의 마커 추가
    let addedCount = 0;
    places.forEach((place) => {
      if (markerMapRef.current.has(place.placeId)) return;

      const iconGrade = tierToIconGrade(place.avgTier);
      const iconPath = getCategoryIconPath(place.categoryKey ?? 'Idle', iconGrade);

      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(place.lat, place.lng),
        map: map,
        title: place.name,
        clickable: true,
        visible: !showClusters,
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
      console.log('[NaverMapView] 마커 추가됨:', addedCount);
    }

    // 3. 클러스터/마커 업데이트
    updateMarkersAndClusters();

    console.log('[NaverMapView] 마커 렌더링 완료, 총:', markerMapRef.current.size);
  }, [places, isLoaded, isFilterActive, updateMarkersAndClusters]);

  // Cleanup
  useEffect(() => {
    return () => {
      clusterMarkersRef.current.forEach((marker) => marker.setMap(null));
      clusterMarkersRef.current = [];
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
