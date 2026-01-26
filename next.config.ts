import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Naver Maps API를 위한 외부 스크립트 허용
  images: {
    domains: [],
  },
};

export default nextConfig;
