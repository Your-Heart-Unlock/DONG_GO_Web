'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Owner 전용 가드
 * role이 owner가 아니면 홈으로 리다이렉트
 */
export default function OwnerGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // 로그인하지 않았거나 owner가 아니면 홈으로
    if (!user || user.role !== 'owner') {
      router.push('/');
    }
  }, [user, loading, router]);

  // 로딩 중이거나 권한 없으면 렌더링 안 함
  if (loading || !user || user.role !== 'owner') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">권한 확인 중...</p>
      </div>
    );
  }

  return <>{children}</>;
}
