// User & Auth Types
export type UserRole = 'owner' | 'member' | 'pending';

export interface User {
  uid: string;
  nickname: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt: Date;
}

// Place Types
export type PlaceSource = 'naver_import' | 'user_added';
export type PlaceStatus = 'active' | 'hidden' | 'deleted';

export interface Place {
  placeId: string; // 네이버 지도 고유 ID (sid)
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string; // UI 표시용 (예: "음식점")
  categoryCode?: string; // 필터용 (예: "DINING")
  source: PlaceSource;
  status: PlaceStatus;
  createdBy: string; // uid
  createdAt: Date;
  updatedAt?: Date;
}

// Rating System Types
export type RatingTier = 'S' | 'A' | 'B' | 'C' | 'F';

export interface Review {
  reviewId: string;
  placeId: string;
  uid: string;
  nickname?: string; // 표시용 (조회 시 join)
  ratingTier: RatingTier;
  oneLineReview?: string;
  tags?: string[];
  visitedAt?: Date;
  companions?: string;
  revisitIntent?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

// Visit Types (deprecated: 방문 정보는 Review에 통합됨)
export interface Visit {
  visitId: string;
  placeId: string;
  uid: string;
  visitedAt: Date;
  companions?: string;
  revisitIntent?: boolean;
  createdAt: Date;
}

// Stats Types
export interface PlaceStats {
  reviewCount: number;
  tierCounts: {
    S: number;
    A: number;
    B: number;
    C: number;
    F: number;
  };
  topTags: string[];
}

// Request Types
export type RequestType = 'place_edit' | 'place_delete';
export type RequestStatus = 'open' | 'approved' | 'rejected';

export interface Request {
  requestId: string;
  type: RequestType;
  placeId: string;
  requestedBy: string; // uid
  payload: any; // diff 데이터
  status: RequestStatus;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string; // uid
}

// Admin Import Types
export interface NaverBookmarkItem {
  sid: string; // placeId
  name: string;
  address: string;
  px: number; // lng
  py: number; // lat
  mcid: string; // categoryCode
  mcidName: string; // category
  memo?: string;
  url?: string;
}

export interface NaverBookmarkExport {
  folder: {
    folderId: number;
    name: string;
    [key: string]: any;
  };
  bookmarkList: NaverBookmarkItem[];
}

export interface ImportRow {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  categoryCode?: string;
}

export type ImportRowStatus = 'OK' | 'DUPLICATE' | 'INVALID';

export interface ImportPreviewRow {
  row: ImportRow;
  status: ImportRowStatus;
  reason?: string;
}

export type ImportDuplicatePolicy = 'SKIP' | 'UPDATE';

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// Admin Log Types
export interface AdminLog {
  logId: string;
  action: string;
  performedBy: string; // uid
  metadata: any;
  createdAt: Date;
}

// Rating Label Config
export interface RatingLabel {
  tier: RatingTier;
  labelShort: string; // 예: "전파각"
  labelLong: string; // 예: "진짜 너무 좋아서 남들에게 추천하고 싶은 곳"
}
