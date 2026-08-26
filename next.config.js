/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 旧物理路由统一 301 到 tab 形态，防止收藏夹/外链失效；
  // /dashboard/logs/run/[id] 不受影响（redirect 只匹配精确路径）
  async redirects() {
    return [
      { source: '/dashboard/repos', destination: '/dashboard?page=repos', permanent: true },
      { source: '/dashboard/runners', destination: '/dashboard?page=runners', permanent: true },
      { source: '/dashboard/env', destination: '/dashboard?page=env', permanent: true },
      { source: '/dashboard/apikeys', destination: '/dashboard?page=apikeys', permanent: true },
      { source: '/dashboard/settings', destination: '/dashboard?page=settings', permanent: true },
      { source: '/dashboard/logs', destination: '/dashboard?page=logs', permanent: false },
    ];
  },

  experimental: {
    // tree-shaking 图标库，减少打包体积
    optimizePackageImports: ['lucide-react'],
  },

  // 生产构建：移除 X-Powered-By 头
  poweredByHeader: false,

  // 安全响应头
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },

  // 图片优化
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
    ],
  },

  // 压缩：启用 gzip 压缩
  compress: true,
};

module.exports = nextConfig;
