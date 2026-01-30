'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPlacesPage() {
  const router = useRouter();

  useEffect(() => {
    // /admin/requests로 리디렉션
    router.replace('/admin/requests');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-gray-500">요청 관리 페이지로 이동 중...</p>
    </div>
  );
}
