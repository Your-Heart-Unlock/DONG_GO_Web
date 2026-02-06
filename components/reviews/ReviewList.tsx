'use client';

import { useState, useEffect, useCallback } from 'react';
import { Review, CategoryKey } from '@/types';
import { getReviewsByPlaceId } from '@/lib/firebase/reviews';
import { useAuth } from '@/contexts/AuthContext';
import ReviewCard from './ReviewCard';
import ReviewForm from './ReviewForm';

interface ReviewListProps {
  placeId: string;
  categoryKey?: CategoryKey; // 장소의 카테고리 (리더보드용)
}

export default function ReviewList({ placeId, categoryKey }: ReviewListProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | undefined>(undefined);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const reviewList = await getReviewsByPlaceId(placeId);
      setReviews(reviewList);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleOpenCreate = () => {
    setEditingReview(undefined);
    setShowForm(true);
  };

  const handleOpenEdit = (review: Review) => {
    setEditingReview(review);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingReview(undefined);
    fetchReviews();
  };

  const handleDeleted = () => {
    fetchReviews();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          리뷰 {reviews.length > 0 && <span className="text-gray-400 text-sm font-normal">({reviews.length})</span>}
        </h3>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          리뷰 작성
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">
          <p>리뷰를 불러오는 중...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>아직 리뷰가 없습니다.</p>
          <p className="text-sm mt-1">첫 번째 리뷰를 작성해보세요!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.reviewId}
              review={review}
              isOwn={user?.uid === review.uid}
              onEdit={handleOpenEdit}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ReviewForm
          placeId={placeId}
          existingReview={editingReview}
          onClose={() => {
            setShowForm(false);
            setEditingReview(undefined);
          }}
          onSaved={handleSaved}
          categoryKey={categoryKey}
        />
      )}
    </div>
  );
}
