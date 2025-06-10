// inspect-drive/next.config.ts

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '31.97.66.79',
        port: '3000',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;