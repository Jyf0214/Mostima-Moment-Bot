/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // tree-shaking 图标库，减少打包体积
    optimizePackageImports: ['lucide-react'],
  },

  // 生产构建：移除 X-Powered-By 头
  poweredByHeader: false,

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
