/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@tabler/icons-react', '@mantine/core', '@mantine/hooks'],
  },
};

module.exports = nextConfig;
