'use client';

import { useRouter } from 'next/navigation';
import { Place } from '@/types';

interface PlaceBottomSheetProps {
  place: Place | null;
  onClose: () => void;
}

export default function PlaceBottomSheet({ place, onClose }: PlaceBottomSheetProps) {
  const router = useRouter();

  if (!place) return null;

  const handleViewDetail = () => {
    router.push(`/places/${place.placeId}`);
  };

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
