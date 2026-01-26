import OwnerGuard from '@/components/guards/OwnerGuard';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Admin Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <Link href="/admin" className="text-xl font-bold text-gray-900">
                  관리자 콘솔
                </Link>
                <nav className="hidden md:flex gap-6">
                  <Link
                    href="/admin"
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    대시보드
                  </Link>
                  <Link
                    href="/admin/import"
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Import
                  </Link>
                  <Link
                    href="/admin/users"
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    사용자
                  </Link>
                  <Link
                    href="/admin/places"
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    장소
                  </Link>
                </nav>
              </div>
              <Link
                href="/"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← 메인으로
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </OwnerGuard>
  );
}
