/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 自定义中间件文件名（默认是 middleware.ts）
  middleware: './proxy',

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
