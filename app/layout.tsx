import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import NicknameGate from '@/components/guards/NicknameGate';
import './globals.css';

export const metadata: Metadata = {
  title: '훈동이 맛집 지도',
  description: '우리끼리 공유하는 맛집 큐레이션',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider>
          <NicknameGate>
            {children}
          </NicknameGate>
        </AuthProvider>
      </body>
    </html>
  );
}
