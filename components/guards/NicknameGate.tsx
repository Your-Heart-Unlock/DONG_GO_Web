'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 닉네임 강제 게이트
 * 로그인은 했지만 닉네임이 없는 사용자를 /onboarding/nickname로 리다이렉트
 */
export default function NicknameGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { firebaseUser, user, loading } = useAuth();

  useEffect(() => {
    // 로딩 중이거나 예외 경로면 skip
    if (loading) return;

    // /login과 /onboarding/nickname은 예외
    if (pathname === '/login' || pathname === '/onboarding/nickname') {
      return;
    }

    // 로그인했지만 닉네임이 없으면 온보딩으로
    if (firebaseUser && user && !user.nickname) {
      router.push('/onboarding/nickname');
    }
  }, [firebaseUser, user, loading, pathname, router]);

  // 로딩 중에는 빈 화면
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  // 닉네임 없는 사용자는 리다이렉트 중이므로 children 렌더링 안 함
  if (
    firebaseUser &&
    user &&
    !user.nickname &&
    pathname !== '/login' &&
    pathname !== '/onboarding/nickname'
  ) {
    return null;
  }

  return <>{children}</>;
}
