'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';
import { Place } from '@/types';

interface PlaceBottomSheetProps {
  place: Place | null;
  onClose: () => void;
}

export default function PlaceBottomSheet({ place, onClose }: PlaceBottomSheetProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isWished, setIsWished] = useState(false);
  const [wishId, setWishId] = useState<string | null>(null);
  const [isTogglingWish, setIsTogglingWish] = useState(false);

  // 위시 상태 확인
  useEffect(() => {
    if (!place || !user || !auth?.currentUser) {
      setIsWished(false);
      setWishId(null);
      return;
    }

    checkWishStatus();
  }, [place, user]);

  async function checkWishStatus() {
    if (!place || !user || !auth?.currentUser) return;

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(
        `/api/wishes?uid=${user.uid}&placeId=${place.placeId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.wishes && data.wishes.length > 0) {
          setIsWished(true);
          setWishId(data.wishes[0].wishId);
        } else {
          setIsWished(false);
          setWishId(null);
        }
      }
    } catch (error) {
      console.error('Wish status check error:', error);
    }
  }

  async function toggleWish() {
    if (!place || !user || !auth?.currentUser || isTogglingWish) return;

    setIsTogglingWish(true);

    try {
      const token = await auth.currentUser.getIdToken();

      if (isWished && wishId) {
        // 위시 삭제
        const response = await fetch(`/api/wishes/${wishId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setIsWished(false);
          setWishId(null);
        } else {
          throw new Error('Failed to remove wish');
        }
      } else {
        // 위시 추가
        const response = await fetch('/api/wishes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ placeId: place.placeId }),
        });

        if (response.ok) {
          const data = await response.json();
          setIsWished(true);
          setWishId(data.wishId);
        } else {
          throw new Error('Failed to add wish');
        }
      }
    } catch (error) {
      console.error('Toggle wish error:', error);
      alert('위시리스트 변경에 실패했습니다.');
    } finally {
      setIsTogglingWish(false);
    }
  }

  if (!place) return null;

  const handleViewDetail = () => {
    router.push(`/places/${place.placeId}`);
  };

  // member/owner만 위시 기능 사용 가능
  const canUseWish = user && (user.role === 'member' || user.role === 'owner');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 animate-slide-up">
        <div className="p-4 space-y-3">
          {/* Handle bar */}
          <div className="flex justify-center">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{place.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{place.address}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="닫기"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                {place.category}
              </span>
              {place.source === 'naver_import' && (
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-500 text-white text-xs font-medium">
                  네이버
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {canUseWish && (
              <button
                onClick={toggleWish}
                disabled={isTogglingWish}
                className={`px-4 py-3 border rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  isWished
                    ? 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                aria-label={isWished ? '위시리스트에서 제거' : '위시리스트에 추가'}
              >
                {isWished ? '💚' : '🤍'}
              </button>
            )}
            <button
              onClick={handleViewDetail}
              className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              상세 보기
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
