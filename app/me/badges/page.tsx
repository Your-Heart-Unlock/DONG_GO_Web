'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';
import { BADGES, getBadgeInfo, getRarityColors, getRarityLabel } from '@/lib/firebase/badges';
import { Badge, UserBadge } from '@/types';

export default function MyBadgesPage() {
  const { user, loading: authLoading } = useAuth();
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [representativeBadgeId, setRepresentativeBadgeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingRepresentative, setSettingRepresentative] = useState(false);

  const isMemberOrOwner = user?.role === 'member' || user?.role === 'owner';

  useEffect(() => {
    async function fetchBadges() {
      if (!auth?.currentUser || !isMemberOrOwner) {
        setLoading(false);
        return;
      }

      try {
        const token = await auth.currentUser.getIdToken();

        // 뱃지 체크 및 조회
        const response = await fetch('/api/badges/check', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();

          // GET으로 전체 뱃지 조회
          const getResponse = await fetch('/api/badges/check', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (getResponse.ok) {
            const getData = await getResponse.json();
            setEarnedBadges(getData.badges || []);
            setRepresentativeBadgeId(getData.representativeBadgeId || null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch badges:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBadges();
  }, [isMemberOrOwner]);

  async function handleSetRepresentative(badgeId: string) {
    if (!auth?.currentUser || settingRepresentative) return;

    setSettingRepresentative(true);
    try {
      const token = await auth.currentUser.getIdToken();

      if (representativeBadgeId === badgeId) {
        // 이미 대표 뱃지면 해제
        const response = await fetch('/api/users/me/representative-badge', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setRepresentativeBadgeId(null);
        }
      } else {
        // 대표 뱃지 설정
        const response = await fetch('/api/users/me/representative-badge', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ badgeId }),
        });

        if (response.ok) {
          setRepresentativeBadgeId(badgeId);
        }
      }
    } catch (error) {
      console.error('Failed to set representative badge:', error);
    } finally {
      setSettingRepresentative(false);
    }
  }

  const earnedBadgeIds = new Set(earnedBadges.map((b) => b.badgeId));
  const earnedBadgeList = BADGES.filter((b) => earnedBadgeIds.has(b.badgeId));
  const lockedBadgeList = BADGES.filter((b) => !earnedBadgeIds.has(b.badgeId));

  // 권한 없음
  if (!authLoading && !isMemberOrOwner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">멤버 전용 콘텐츠</h2>
          <p className="text-gray-600 mb-4">뱃지는 승인된 멤버만 볼 수 있습니다.</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/me"
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">내 뱃지</h1>
            <p className="text-sm text-gray-500">{earnedBadgeList.length}/{BADGES.length} 획득</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <p>로딩 중...</p>
          </div>
        ) : (
          <>
            {/* 획득한 뱃지 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                획득한 뱃지 ({earnedBadgeList.length})
              </h2>
              {earnedBadgeList.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">🏅</span>
                  </div>
                  <p className="text-gray-600">아직 획득한 뱃지가 없어요</p>
                  <p className="text-sm text-gray-400 mt-1">리뷰를 작성하고 맛집을 등록해보세요!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {earnedBadgeList.map((badge) => (
                    <BadgeCard
                      key={badge.badgeId}
                      badge={badge}
                      earned
                      isRepresentative={badge.badgeId === representativeBadgeId}
                      onSetRepresentative={() => handleSetRepresentative(badge.badgeId)}
                      earnedAt={earnedBadges.find((b) => b.badgeId === badge.badgeId)?.earnedAt}
                      disabled={settingRepresentative}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 잠긴 뱃지 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                잠긴 뱃지 ({lockedBadgeList.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {lockedBadgeList.map((badge) => (
                  <BadgeCard key={badge.badgeId} badge={badge} earned={false} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

interface BadgeCardProps {
  badge: Badge;
  earned: boolean;
  isRepresentative?: boolean;
  onSetRepresentative?: () => void;
  earnedAt?: Date;
  disabled?: boolean;
}

function BadgeCard({
  badge,
  earned,
  isRepresentative,
  onSetRepresentative,
  earnedAt,
  disabled,
}: BadgeCardProps) {
  const rarityColors = getRarityColors(badge.rarity);
  const rarityLabel = getRarityLabel(badge.rarity);

  return (
    <div
      className={`relative border-2 rounded-xl p-4 transition-all ${
        earned
          ? `${rarityColors.bg} ${rarityColors.border} ${isRepresentative ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}`
          : 'bg-gray-50 border-gray-200 opacity-60'
      }`}
    >
      {/* 대표 뱃지 표시 */}
      {isRepresentative && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow">
          <span className="text-xs">⭐</span>
        </div>
      )}

      {/* 아이콘 */}
      <div className={`text-4xl text-center mb-2 ${!earned && 'grayscale'}`}>
        {badge.icon}
      </div>

      {/* 이름 */}
      <h3 className={`text-sm font-bold text-center ${earned ? 'text-gray-900' : 'text-gray-500'}`}>
        {badge.name}
      </h3>

      {/* 설명 */}
      <p className="text-xs text-gray-500 text-center mt-1">
        {badge.description}
      </p>

      {/* 희귀도 */}
      <div className={`mt-2 text-center`}>
        <span className={`text-xs font-medium ${rarityColors.text}`}>
          {rarityLabel}
        </span>
      </div>

      {/* 획득일 또는 조건 */}
      {earned ? (
        <>
          {earnedAt && (
            <p className="text-xs text-gray-400 text-center mt-2">
              {new Date(earnedAt).toLocaleDateString('ko-KR')} 획득
            </p>
          )}
          {onSetRepresentative && (
            <button
              onClick={onSetRepresentative}
              disabled={disabled}
              className={`mt-3 w-full py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isRepresentative
                  ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } disabled:opacity-50`}
            >
              {isRepresentative ? '대표 해제' : '대표로 설정'}
            </button>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-400 text-center mt-2">
          {getConditionText(badge)}
        </p>
      )}
    </div>
  );
}

function getConditionText(badge: Badge): string {
  const { type, threshold } = badge.condition;

  switch (type) {
    case 'review_count':
      return `리뷰 ${threshold}개 작성`;
    case 'place_add':
      return `맛집 ${threshold}개 등록`;
    case 'tier_s':
      return `S등급 ${threshold}개`;
    default:
      return `조건 달성 필요`;
  }
}
