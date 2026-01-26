'use client';

import { useEffect, useRef } from 'react';
import { useNaverMaps } from '@/lib/naver/useNaverMaps';
import { Place } from '@/types';

interface NaverMapViewProps {
  places: Place[];
  onMarkerClick?: (place: Place) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

export default function NaverMapView({
  places,
  onMarkerClick,
  center = { lat: 37.5665, lng: 126.978 }, // 서울 시청 기본값
  zoom = 12,
}: NaverMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<naver.maps.Marker[]>([]);

  const { isLoaded, error } = useNaverMaps();

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

    mapInstanceRef.current = new naver.maps.Map(mapRef.current, mapOptions);
  }, [isLoaded, center.lat, center.lng, zoom]);

  // 마커 렌더링
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    // 기존 마커 제거
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // 새 마커 생성
    places.forEach((place) => {
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(place.lat, place.lng),
        map: mapInstanceRef.current!,
        title: place.name,
        clickable: true,
      });

      // 마커 클릭 이벤트
      if (onMarkerClick) {
        naver.maps.Event.addListener(marker, 'click', () => {
          onMarkerClick(place);
        });
      }

      markersRef.current.push(marker);
    });

    // 마커가 있으면 bounds 맞추기
    if (places.length > 0) {
      const bounds = new naver.maps.LatLngBounds(
        new naver.maps.LatLng(places[0].lat, places[0].lng),
        new naver.maps.LatLng(places[0].lat, places[0].lng)
      );

      places.forEach((place) => {
        bounds.extend(new naver.maps.LatLng(place.lat, place.lng));
      });

      mapInstanceRef.current?.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 200, // 바텀시트 공간 확보
        left: 50,
      });
    }
  }, [places, isLoaded, onMarkerClick]);

  // Cleanup
  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
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
