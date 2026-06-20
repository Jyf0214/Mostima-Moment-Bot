import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 不需要认证的路径
const publicPaths = [
  '/api/auth/login',
  '/api/auth/callback',
  '/api/auth/status',
  '/setup',
  '/api/setup',
  '/_next',
  '/favicon.ico',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查是否为公开路径
  if (publicPaths.some(path => pathname.startsWith(path))) {
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
