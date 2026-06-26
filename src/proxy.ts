import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 分级环境变量检查策略
 *
 * Tier 1（始终必需）：数据库连接 + 密钥
 *   → DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
 *   → 缺失则无法运行，重定向到 env-error
 *
 * Tier 2（仅数据库为空时必需）：OAuth 配置
 *   → GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 *   → 数据库已有数据时可选（配置已存储在 DB 中）
 */

const TIER1_KEYS = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
const TIER2_KEYS = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];

// 所有需要检查的变量（合并）
const ALL_KEYS = [...TIER1_KEYS, ...TIER2_KEYS];

// 不需要环境变量检查的路径
const ENV_CHECK_EXEMPT_PATHS = ['/api/env-check', '/env-error', '/_next', '/favicon.ico'];

// 不需要认证的路径
const publicPaths = [
  '/api/auth/login',
  '/api/auth/callback',
  '/api/auth/status',
  '/api/webhook/github',
  '/api/health',
  '/api/github/callback',
  '/env-error',
  '/api/env-check',
  '/_next',
  '/favicon.ico',
];

// 数据库状态缓存（避免每次请求都查库）
let dbHasData: boolean | null = null;
let dbCheckTime = 0;
const DB_CACHE_TTL = 60_000; // 60 秒缓存

/**
 * 检查数据库是否有数据（管理员或配置）
 * 有数据说明是已使用的数据库，Tier2 变量可选
 */
async function checkDatabaseHasData(): Promise<boolean> {
  const now = Date.now();
  if (dbHasData !== null && now - dbCheckTime < DB_CACHE_TTL) {
    return dbHasData;
  }

  try {
    // 动态导入避免 middleware 边界问题
    const { prisma } = await import('@/lib/prisma');
    const adminCount = await prisma.admin.count();
    const configCount = await prisma.appConfig.count();
    dbHasData = adminCount > 0 || configCount > 0;
    dbCheckTime = now;
    return dbHasData;
  } catch {
    // 数据库连接失败，保守处理：假设为空（需要完整环境变量）
    return false;
  }
}

/**
 * 检查环境变量缺失情况
 * 返回缺失的变量列表
 */
function getMissingEnvVars(): string[] {
  const missing: string[] = [];
  for (const key of ALL_KEYS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  return missing;
}

/**
 * 获取缺失的 Tier1 变量
 */
function getMissingTier1(): string[] {
  return TIER1_KEYS.filter((key) => !process.env[key]);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查是否为免检路径
  if (ENV_CHECK_EXEMPT_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Tier 1 检查：始终必需
  const missingTier1 = getMissingTier1();
  if (missingTier1.length > 0) {
    const errorUrl = new URL('/env-error', request.url);
    errorUrl.searchParams.set('missing', missingTier1.join(','));
    errorUrl.searchParams.set('tier', '1');
    return NextResponse.redirect(errorUrl);
  }

  // Tier 1 通过，检查数据库状态
  const hasData = await checkDatabaseHasData();

  if (!hasData) {
    // 数据库为空 → Tier 2 也必需
    const missingTier2 = TIER2_KEYS.filter((key) => !process.env[key]);
    if (missingTier2.length > 0) {
      const allMissing = [...missingTier1, ...missingTier2];
      const errorUrl = new URL('/env-error', request.url);
      errorUrl.searchParams.set('missing', allMissing.join(','));
      errorUrl.searchParams.set('tier', '2');
      return NextResponse.redirect(errorUrl);
    }
  }

  // 数据库有数据 → Tier 2 可选，不需要检查

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
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
