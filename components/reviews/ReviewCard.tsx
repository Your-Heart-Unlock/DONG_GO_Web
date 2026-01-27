'use client';

import { useState } from 'react';
import { Review, RatingTier } from '@/types';
import { deleteReview } from '@/lib/firebase/reviews';

const TIER_CONFIG: Record<RatingTier, { label: string; bg: string; text: string }> = {
  S: { label: '전파각', bg: 'bg-purple-100', text: 'text-purple-800' },
  A: { label: '동네강자', bg: 'bg-blue-100', text: 'text-blue-800' },
  B: { label: '평타', bg: 'bg-green-100', text: 'text-green-800' },
  C: { label: '땜빵', bg: 'bg-orange-100', text: 'text-orange-800' },
  F: { label: '지뢰', bg: 'bg-red-100', text: 'text-red-800' },
};

interface ReviewCardProps {
  review: Review;
  isOwn: boolean;
  onEdit: (review: Review) => void;
  onDeleted: () => void;
}

export default function ReviewCard({ review, isOwn, onEdit, onDeleted }: ReviewCardProps) {
  const [deleting, setDeleting] = useState(false);

  const tier = TIER_CONFIG[review.ratingTier];

  const handleDelete = async () => {
    if (!confirm('리뷰를 삭제하시겠습니까?')) return;

    setDeleting(true);
    try {
      await deleteReview(review.reviewId, review.placeId);
      onDeleted();
    } catch (error) {
      console.error('Failed to delete review:', error);
      alert('리뷰 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold ${tier.bg} ${tier.text}`}>
            {review.ratingTier}
          </span>
          <span className={`text-xs ${tier.text}`}>{tier.label}</span>
        </div>
        {isOwn && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(review)}
              className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              수정
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          </div>
        )}
      </div>

      {review.oneLineReview && (
        <p className="mt-2 text-sm text-gray-700">{review.oneLineReview}</p>
      )}

      {review.tags && review.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {review.tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 방문 정보 */}
      {(review.visitedAt || review.companions || review.revisitIntent !== undefined) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {review.visitedAt && (
            <span className="inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {review.visitedAt.toLocaleDateString('ko-KR')}
            </span>
          )}
          {review.companions && (
            <span className="inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {review.companions}
            </span>
          )}
          {review.revisitIntent === true && (
            <span className="text-blue-600 font-medium">재방문 의향 있음</span>
          )}
          {review.revisitIntent === false && (
            <span className="text-red-500 font-medium">재방문 의향 없음</span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <span>{review.nickname || '익명'}</span>
        <span>·</span>
        <span>{review.createdAt.toLocaleDateString('ko-KR')}</span>
        {review.updatedAt && review.updatedAt > review.createdAt && (
          <>
            <span>·</span>
            <span>수정됨</span>
          </>
        )}
      </div>
    </div>
  );
}
