import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Performance: Enable response compression ──
  compress: true,

  // ── CDN Caching: Reduce origin load under 200+ concurrent users ──
  headers: async () => [
    {
      // All pages: cache at edge for 10s, serve stale while revalidating for 59s
      source: '/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=10, stale-while-revalidate=59',
        },
      ],
    },
    {
      // Static assets: cache immutably (content-hashed by Next.js)
      source: '/_next/static/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],

  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    };
    // Fix for missing fs and path modules in browser environment when compiling WASM
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
  turbopack: {},
};

export default nextConfig;
