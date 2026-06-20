import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 必要的环境变量列表
const REQUIRED_ENV_VARS = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
];

// 不需要环境变量检查的路径
const ENV_CHECK_EXEMPT_PATHS = ['/api/env-check', '/env-error', '/_next', '/favicon.ico'];

// 不需要认证的路径
const publicPaths = [
  '/api/auth/login',
  '/api/auth/callback',
  '/api/auth/status',
  '/setup',
  '/api/setup',
  '/env-error',
  '/api/env-check',
  '/_next',
  '/favicon.ico',
];

/**
 * 检查环境变量是否已配置
 */
function checkEnvironmentVariables(): string[] {
  const missing: string[] = [];
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  return missing;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查是否为免检路径
  if (ENV_CHECK_EXEMPT_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 检查环境变量
  const missingEnvVars = checkEnvironmentVariables();
  if (missingEnvVars.length > 0) {
    // 环境变量缺失，重定向到错误页面
    const errorUrl = new URL('/env-error', request.url);
    errorUrl.searchParams.set('missing', missingEnvVars.join(','));
    return NextResponse.redirect(errorUrl);
  }

  // 检查是否为公开路径
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 检查是否为静态文件
  if (pathname.includes('.')) {
    return NextResponse.next();
  }

  // 检查认证 token
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // 未登录，检查是否为全新应用
    if (pathname === '/') {
      // 首页，允许访问（页面会检查应用状态）
      return NextResponse.next();
    }
    // 其他页面，重定向到首页
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
