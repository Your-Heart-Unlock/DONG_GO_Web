'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { setNickname } from '@/lib/firebase/user';

export default function NicknamePage() {
  const router = useRouter();
  const { firebaseUser, user, loading, refreshUser } = useAuth();

  const [nickname, setNicknameInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 로그인하지 않았으면 로그인 페이지로
    if (!loading && !firebaseUser) {
      router.push('/login');
      return;
    }

    // 이미 닉네임이 있으면 홈으로
    if (!loading && user?.nickname) {
      router.push('/');
    }
  }, [firebaseUser, user, loading, router]);

  const validateNickname = (value: string): string | null => {
    if (value.length < 2) {
      return '닉네임은 최소 2자 이상이어야 합니다.';
    }
    if (value.length > 20) {
      return '닉네임은 최대 20자까지 가능합니다.';
    }
    // 기본 금칙어 체크 (선택 사항)
    const forbiddenWords = ['admin', 'owner', 'test', '관리자'];
    if (forbiddenWords.some((word) => value.toLowerCase().includes(word))) {
      return '사용할 수 없는 닉네임입니다.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedNickname = nickname.trim();
    const validationError = validateNickname(trimmedNickname);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!firebaseUser) {
      setError('로그인이 필요합니다.');
      return;
    }

    setSubmitting(true);

    try {
      await setNickname(firebaseUser.uid, trimmedNickname);
      await refreshUser(); // 사용자 프로필 새로고침
      router.push('/'); // 홈으로 이동
    } catch (err) {
      console.error('닉네임 설정 실패:', err);
      setError('닉네임 설정에 실패했습니다. 다시 시도해주세요.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">닉네임 설정</h1>
          <p className="mt-2 text-sm text-gray-600">
            서비스에서 사용할 닉네임을 설정해주세요.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            실명이나 이메일은 공개되지 않습니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
              닉네임
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="2~20자"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={submitting}
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting || !nickname.trim()}
            className="w-full flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? '설정 중...' : '완료'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            닉네임은 나중에 설정에서 변경할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
