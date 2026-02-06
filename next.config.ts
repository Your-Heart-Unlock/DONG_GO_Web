import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  images: {
    domains: [],
  },
};

export default nextConfig;
