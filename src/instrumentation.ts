/**
 * Next.js 服务端启动钩子
 *
 * register() 在服务器启动时执行一次，用于：
 * 1. 预热 bot slug 缓存
 * 2. 启动 GitHub App token 定时刷新服务
 */

export async function register() {
  try {
    const { fetchBotSlug } = await import('@/lib/github/auth');
    const { startTokenRefresher } = await import('@/lib/ci/token-refresher');
    const { logger } = await import('@/lib/logger');

    // 预热 bot slug 缓存
    const slug = await fetchBotSlug();
    logger.info(`[Instrumentation] Bot slug preloaded: ${slug}`);

    // 启动 token 定时刷新服务（立即生成一次，然后每 30 分钟刷新）
    startTokenRefresher();
  } catch {
    // 预热失败不阻断启动，仅静默跳过
  }
}
