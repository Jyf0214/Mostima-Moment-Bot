/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 编译时优化：tree-shaking 图标库
  optimizePackageImports: ['lucide-react'],

  // 生产构建：移除 X-Powered-By 头
  poweredByHeader: false,

  // 图片优化
  images: {
    // 允许外部图片域名（如 GitHub 头像）
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
    ],
    // 禁用静态图片优化（无本地图片，减少构建时间）
    unoptimized: false,
  },

  // 压缩：启用 gzip 压缩（Vercel/反向代理通常已启用，但 Docker 部署需要）
  compress: true,

  // 输出配置：standalone 模式减小 Docker 镜像体积
  // output: 'standalone',
};

module.exports = nextConfig;
