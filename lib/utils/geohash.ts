/**
 * Geohash 유틸리티
 * 좌표 기반 중복 체크에 사용
 */

import geohash from 'ngeohash';

// Geohash 정밀도 (9자리 = 약 5m x 5m)
const GEOHASH_PRECISION = 9;

// 중복 체크 거리 (미터) - 같은 건물 내 다른 가게는 보통 20-30m 이상 떨어짐
const DUPLICATE_DISTANCE_METERS = 30;

/**
 * 위경도를 geohash로 변환
 */
export function encodeGeohash(lat: number, lng: number): string {
  return geohash.encode(lat, lng, GEOHASH_PRECISION);
}

/**
 * geohash를 위경도로 변환
 */
export function decodeGeohash(hash: string): { lat: number; lng: number } {
  const decoded = geohash.decode(hash);
  return { lat: decoded.latitude, lng: decoded.longitude };
}

/**
 * 주변 geohash 목록 반환 (현재 + 8방향 이웃)
 * ngeohash.neighbors() returns: [n, ne, e, se, s, sw, w, nw]
 */
export function getNeighborGeohashes(hash: string): string[] {
  const neighbors = geohash.neighbors(hash);
  return [hash, ...neighbors];
}

/**
 * 두 좌표 간 거리 계산 (Haversine formula, 미터 단위)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 지구 반지름 (미터)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * 30m 이내 중복 체크를 위한 geohash prefix 반환
 * 7자리 prefix = 약 150m x 150m 영역
 */
export function getGeohashPrefixForDuplicateCheck(lat: number, lng: number): string {
  const hash = encodeGeohash(lat, lng);
  return hash.slice(0, 7); // 7자리 prefix
}

/**
 * 중복 체크용 geohash prefix 목록 (현재 위치 + 인접 영역)
 * ngeohash.neighbors() returns: [n, ne, e, se, s, sw, w, nw]
 */
export function getGeohashPrefixesForNearbySearch(lat: number, lng: number): string[] {
  const hash = encodeGeohash(lat, lng);
  const prefix = hash.slice(0, 7);
  const neighbors = geohash.neighbors(prefix);
  return [prefix, ...neighbors];
}

/**
 * 중복 판단 거리 상수 (미터)
 */
export const DUPLICATE_THRESHOLD_METERS = DUPLICATE_DISTANCE_METERS;
