'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '@/lib/firebase/client';
import { getPlaceById } from '@/lib/firebase/places';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { getPlaceStats } from '@/lib/firebase/reviews';
import { Place, PlaceStats, RatingTier, MapProvider, CategoryKey } from '@/types';
import { CATEGORY_LABELS, ALL_CATEGORY_KEYS } from '@/lib/utils/categoryIcon';
import ReviewList from '@/components/reviews/ReviewList';
import PhotoGallery from '@/components/photos/PhotoGallery';

interface PlaceDetailPageProps {
  params: Promise<{ placeId: string }>;
}

export default function PlaceDetailPage({ params }: PlaceDetailPageProps) {
  const { placeId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [place, setPlace] = useState<Place | null>(null);
  const [stats, setStats] = useState<PlaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatorNickname, setCreatorNickname] = useState<string>('로딩 중...');
  const [hasOpenDeleteRequest, setHasOpenDeleteRequest] = useState(false);
  const [hasOpenEditRequest, setHasOpenEditRequest] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const isMemberOrOwner = user?.role === 'member' || user?.role === 'owner';

  useEffect(() => {
    async function fetchPlace() {
      setLoading(true);
      try {
        const [data, statsData] = await Promise.all([
          getPlaceById(placeId),
          getPlaceStats(placeId),
        ]);
        if (!data) {
          setError('장소를 찾을 수 없습니다.');
        } else {
          setPlace(data);
          setStats(statsData);

          // 등록자 닉네임 가져오기
          if (data.createdBy) {
            fetchCreatorNickname(data.createdBy);
          } else {
            // createdBy가 없으면 훈동 닉네임 표시
            setCreatorNickname('훈동');
          }
        }
      } catch (err) {
        setError('장소를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchPlace();
  }, [placeId]);

  // 기존 요청 확인 (삭제 & 수정)
  useEffect(() => {
    async function checkExistingRequests() {
      if (!db || !user || !isMemberOrOwner) return;

      try {
        const requestsRef = collection(db, 'requests');

        // 삭제 요청 확인
        const deleteQuery = query(
          requestsRef,
          where('type', '==', 'place_delete'),
          where('placeId', '==', placeId),
          where('requestedBy', '==', user.uid),
          where('status', '==', 'open'),
          limit(1)
        );
        const deleteSnapshot = await getDocs(deleteQuery);
        if (!deleteSnapshot.empty) {
          setHasOpenDeleteRequest(true);
        }

        // 수정 요청 확인
        const editQuery = query(
          requestsRef,
          where('type', '==', 'place_edit'),
          where('placeId', '==', placeId),
          where('requestedBy', '==', user.uid),
          where('status', '==', 'open'),
          limit(1)
        );
        const editSnapshot = await getDocs(editQuery);
        if (!editSnapshot.empty) {
          setHasOpenEditRequest(true);
        }
      } catch (error) {
        console.error('Failed to check existing requests:', error);
      }
    }

    checkExistingRequests();
  }, [placeId, user, isMemberOrOwner]);

  // 등록자 닉네임 조회
  async function fetchCreatorNickname(uid: string) {
    try {
      const response = await fetch(`/api/users/${uid}`);
      if (response.ok) {
        const data = await response.json();
        setCreatorNickname(data.nickname || '알 수 없음');
      } else {
        setCreatorNickname('알 수 없음');
      }
    } catch (error) {
      console.error('Failed to fetch creator nickname:', error);
      setCreatorNickname('알 수 없음');
    }
  }

  // 삭제 요청 제출
  async function handleDeleteRequest() {
    if (!deleteReason.trim()) {
      alert('삭제 사유를 입력해주세요.');
      return;
    }

    if (!auth?.currentUser || !user) return;

    setIsSubmittingRequest(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'place_delete',
          placeId,
          payload: {
            reason: deleteReason,
          },
        }),
      });

      if (response.ok) {
        alert('삭제 요청이 제출되었습니다. 관리자 승인을 기다려주세요.');
        setHasOpenDeleteRequest(true);
        setShowDeleteModal(false);
        setDeleteReason('');
      } else {
        const errorData = await response.json();
        if (response.status === 409) {
          alert('이미 삭제 요청을 제출하셨습니다.');
          setHasOpenDeleteRequest(true);
          setShowDeleteModal(false);
        } else {
          alert(errorData.error || '삭제 요청에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('Failed to submit delete request:', error);
      alert('삭제 요청에 실패했습니다.');
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  // 카테고리 수정 요청 제출
  async function handleEditRequest() {
    if (!newCategory || newCategory === (place?.categoryKey || 'Idle')) {
      alert('다른 카테고리를 선택해주세요.');
      return;
    }

    if (!auth?.currentUser || !user || !place) return;

    setIsSubmittingRequest(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'place_edit',
          placeId,
          payload: {
            categoryKey: newCategory,
            category: CATEGORY_LABELS[newCategory as CategoryKey],
            oldCategoryKey: place.categoryKey || 'Idle',
            oldCategory: place.category,
          },
        }),
      });

      if (response.ok) {
        alert('카테고리 수정 요청이 제출되었습니다. 관리자 승인을 기다려주세요.');
        setHasOpenEditRequest(true);
        setShowEditModal(false);
        setNewCategory('');
      } else {
        const errorData = await response.json();
        if (response.status === 409) {
          alert('이미 수정 요청을 제출하셨습니다.');
          setHasOpenEditRequest(true);
          setShowEditModal(false);
        } else {
          alert(errorData.error || '수정 요청에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('Failed to submit edit request:', error);
      alert('수정 요청에 실패했습니다.');
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  // 가장 많은 티어 계산
  function getTopTier(tierCounts: PlaceStats['tierCounts']): RatingTier | '-' {
    const entries = Object.entries(tierCounts) as [RatingTier, number][];
    const max = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0]);
    return max[1] > 0 ? max[0] : '-';
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-red-600 mb-4">{error || '장소를 찾을 수 없습니다.'}</p>
        <Link
          href="/"
          className="text-blue-600 hover:underline"
        >
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  // 지도 제공자 판별: mapProvider 필드 우선, 없으면 source로 추정
  function getMapProvider(p: Place): MapProvider {
    if (p.mapProvider) return p.mapProvider;
    // 기존 데이터 하위 호환: naver_import는 네이버
    return p.source === 'naver_import' ? 'naver' : 'kakao';
  }

  const provider = getMapProvider(place);

  // 주소에서 "구"까지만 추출 (예: "서울특별시 강남구 역삼동 123" → "강남구")
  function getShortAddress(address: string): string {
    const match = address.match(/([가-힣]+구)/);
    return match ? match[1] : '';
  }

  const shortAddress = getShortAddress(place.address);
  const searchQuery = encodeURIComponent(place.name + (shortAddress ? ' ' + shortAddress : ''));

  // 네이버 지도 URL (항상 표시: 직접 링크 또는 검색)
  const naverUrl = provider === 'naver'
    ? `https://map.naver.com/p/entry/place/${place.placeId}` // 네이버 ID가 있으면 직접 링크
    : `https://map.naver.com/search/${searchQuery}`; // 없으면 검색

  // 카카오 지도 URL (항상 표시: 직접 링크 또는 검색)
  const kakaoUrl = provider === 'kakao'
    ? `https://place.map.kakao.com/${place.placeId}` // 카카오 ID가 있으면 직접 링크
    : `https://map.kakao.com/?q=${searchQuery}`; // 없으면 검색

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {place.name}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {/* 기본 정보 카드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{place.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{place.category}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {/* 네이버 지도 버튼 (항상 표시) */}
                <a
                  href={naverUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
                >
                  네이버
                </a>
                {/* 카카오 지도 버튼 (항상 표시) */}
                <a
                  href={kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-yellow-400 text-gray-900 text-sm font-medium rounded-lg hover:bg-yellow-500 transition-colors"
                >
                  카카오
                </a>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-start gap-2 text-gray-600">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm">{place.address}</span>
              </div>
            </div>
          </div>

          {/* 통계 섹션 (모든 사용자에게 표시) */}
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">통계</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.reviewCount ?? '-'}</p>
                <p className="text-xs text-gray-500">리뷰</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats ? getTopTier(stats.tierCounts) : '-'}
                </p>
                <p className="text-xs text-gray-500">최다 등급</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats?.wishCount ?? 0}</p>
                <p className="text-xs text-gray-500">💚 가고 싶어요</p>
              </div>
            </div>
          </div>

          {/* 요청 버튼들 (member/owner) */}
          {isMemberOrOwner && user && (
            <div className="border-t border-gray-100 px-6 py-3 space-y-2">
              {/* 카테고리 수정 요청 */}
              {hasOpenEditRequest ? (
                <p className="text-sm text-gray-500 text-center">
                  카테고리 수정 요청이 제출되었습니다.
                </p>
              ) : (
                <button
                  onClick={() => {
                    setNewCategory(place?.categoryKey || 'Idle');
                    setShowEditModal(true);
                  }}
                  className="w-full px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  카테고리 수정 요청
                </button>
              )}

              {/* 삭제 요청 */}
              {hasOpenDeleteRequest ? (
                <p className="text-sm text-gray-500 text-center">
                  삭제 요청이 제출되었습니다.
                </p>
              ) : (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  삭제 요청
                </button>
              )}
            </div>
          )}
        </div>

        {/* member/owner 전용 섹션 */}
        {isMemberOrOwner ? (
          <>
            {/* 리뷰 섹션 */}
            <ReviewList placeId={placeId} />

            {/* 사진 갤러리 섹션 */}
            <PhotoGallery placeId={placeId} />
          </>
        ) : (
          /* pending/guest 잠금 안내 */
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-800">
                  멤버 전용 콘텐츠
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  리뷰, 사진은 승인된 멤버만 볼 수 있습니다.
                </p>
                {user?.role === 'pending' && (
                  <p className="mt-2 text-sm text-yellow-600">
                    현재 승인 대기 중입니다. 관리자 승인 후 이용할 수 있습니다.
                  </p>
                )}
                {!user && (
                  <Link
                    href="/login"
                    className="mt-3 inline-block text-sm font-medium text-yellow-800 underline hover:no-underline"
                  >
                    로그인하기
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 메타 정보 */}
        <div className="text-xs text-gray-400 space-y-1">
          <p>장소 ID: {place.placeId}</p>
          <p>등록일: {place.createdAt.toLocaleDateString('ko-KR')}</p>
          <p>등록자: {creatorNickname}</p>
        </div>
      </main>

      {/* 삭제 요청 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              장소 삭제 요청
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              삭제 사유를 입력해주세요. 관리자가 검토 후 승인하면 삭제됩니다.
            </p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="예: 폐업했습니다 / 중복 등록입니다"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteReason('');
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isSubmittingRequest}
              >
                취소
              </button>
              <button
                onClick={handleDeleteRequest}
                disabled={isSubmittingRequest || !deleteReason.trim()}
                className="flex-1 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingRequest ? '제출 중...' : '삭제 요청'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 수정 요청 모달 */}
      {showEditModal && place && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              카테고리 수정 요청
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                현재 카테고리
              </label>
              <p className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-lg">
                {place.category}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                새 카테고리
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ALL_CATEGORY_KEYS.filter(k => k !== 'Idle').map((key) => (
                  <option key={key} value={key}>
                    {CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              관리자가 검토 후 승인하면 카테고리가 변경됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setNewCategory('');
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isSubmittingRequest}
              >
                취소
              </button>
              <button
                onClick={handleEditRequest}
                disabled={isSubmittingRequest || newCategory === (place?.categoryKey || 'Idle')}
                className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingRequest ? '제출 중...' : '수정 요청'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
