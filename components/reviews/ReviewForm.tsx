'use client';

import { useState } from 'react';
import { Review, RatingTier, CategoryKey } from '@/types';
import { createReview, updateReview } from '@/lib/firebase/reviews';
import { useAuth } from '@/contexts/AuthContext';

const TIERS: { tier: RatingTier; label: string; bg: string; bgSelected: string; text: string; border: string }[] = [
  { tier: 'S', label: '전파각', bg: 'bg-purple-50', bgSelected: 'bg-purple-200', text: 'text-purple-800', border: 'border-purple-400' },
  { tier: 'A', label: '동네강자', bg: 'bg-blue-50', bgSelected: 'bg-blue-200', text: 'text-blue-800', border: 'border-blue-400' },
  { tier: 'B', label: '평타', bg: 'bg-green-50', bgSelected: 'bg-green-200', text: 'text-green-800', border: 'border-green-400' },
  { tier: 'C', label: '땜빵', bg: 'bg-orange-50', bgSelected: 'bg-orange-200', text: 'text-orange-800', border: 'border-orange-400' },
  { tier: 'F', label: '지뢰', bg: 'bg-red-50', bgSelected: 'bg-red-200', text: 'text-red-800', border: 'border-red-400' },
];

interface ReviewFormProps {
  placeId: string;
  existingReview?: Review;
  onClose: () => void;
  onSaved: () => void;
  categoryKey?: CategoryKey; // 장소의 카테고리 (리더보드용)
}

export default function ReviewForm({ placeId, existingReview, onClose, onSaved, categoryKey }: ReviewFormProps) {
  const { user } = useAuth();
  const [selectedTier, setSelectedTier] = useState<RatingTier | null>(existingReview?.ratingTier || null);
  const [oneLineReview, setOneLineReview] = useState(existingReview?.oneLineReview || '');
  const [tagInput, setTagInput] = useState(existingReview?.tags?.join(', ') || '');
  const [visitedAt, setVisitedAt] = useState(
    existingReview?.visitedAt ? existingReview.visitedAt.toISOString().slice(0, 10) : ''
  );
  const [companions, setCompanions] = useState(existingReview?.companions || '');
  const [revisitIntent, setRevisitIntent] = useState<boolean | undefined>(existingReview?.revisitIntent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!existingReview;

  const handleSave = async () => {
    if (!selectedTier) {
      setError('등급을 선택해주세요.');
      return;
    }
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }

    setError('');
    setSaving(true);

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const parsedVisitedAt = visitedAt ? new Date(visitedAt) : undefined;

    try {
      if (isEdit && existingReview) {
        await updateReview(existingReview.reviewId, {
          ratingTier: selectedTier,
          oneLineReview: oneLineReview || '',
          tags,
          visitedAt: parsedVisitedAt,
          companions: companions || undefined,
          revisitIntent,
        });
      } else {
        await createReview({
          placeId,
          uid: user.uid,
          ratingTier: selectedTier,
          oneLineReview: oneLineReview || '',
          tags,
          visitedAt: parsedVisitedAt,
          companions: companions || undefined,
          revisitIntent,
          categoryKey, // 장소의 카테고리 (리더보드용)
        });
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save review:', err);
      setError('리뷰 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {isEdit ? '리뷰 수정' : '리뷰 작성'}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="닫기"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tier Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">등급 선택</label>
              <div className="flex gap-2">
                {TIERS.map(({ tier, label, bg, bgSelected, text, border }) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`flex-1 py-2 px-1 rounded-lg border-2 text-center transition-colors ${
                      selectedTier === tier
                        ? `${bgSelected} ${border} ${text}`
                        : `${bg} border-transparent ${text} hover:border-gray-300`
                    }`}
                  >
                    <span className="block text-lg font-bold">{tier}</span>
                    <span className="block text-xs mt-0.5">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* One-line Review */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                한줄평 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <textarea
                value={oneLineReview}
                onChange={(e) => setOneLineReview(e.target.value)}
                placeholder="이 장소에 대한 한줄평을 남겨주세요"
                maxLength={200}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{oneLineReview.length}/200</p>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                태그 <span className="text-gray-400 font-normal">(선택, 쉼표로 구분)</span>
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="맛집, 분위기좋은, 가성비"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 방문 정보 (선택) */}
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">방문 정보 <span className="text-gray-400 font-normal">(선택)</span></p>
              <div className="space-y-3">
                {/* 방문일 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">방문일</label>
                  <input
                    type="date"
                    value={visitedAt}
                    onChange={(e) => setVisitedAt(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {/* 동행자 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">동행자</label>
                  <input
                    type="text"
                    value={companions}
                    onChange={(e) => setCompanions(e.target.value)}
                    placeholder="예: 친구, 가족, 혼자"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {/* 재방문 의향 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">재방문 의향</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRevisitIntent(revisitIntent === true ? undefined : true)}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                        revisitIntent === true
                          ? 'bg-blue-100 border-blue-400 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      또 갈래요
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevisitIntent(revisitIntent === false ? undefined : false)}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                        revisitIntent === false
                          ? 'bg-red-100 border-red-400 text-red-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      안 갈래요
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedTier}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '저장 중...' : isEdit ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
