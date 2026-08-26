/**
 * Next.js 服务端启动钩子
 *
 * register() 在服务器启动时执行一次，用于：
 * 1. 预热 bot slug 缓存
 * 2. 启动 GitHub App token 定时刷新服务
 * 3. 自动恢复之前注册的 GitHub Actions Runner
 */

export async function register() {
  const { logger } = await import('@/lib/logger');

  // 各步骤独立 try/catch：此前外层整体静默吞错，
  // slug 预热失败会连带跳过 token 刷新服务且无任何日志
  try {
    const { fetchBotSlug } = await import('@/lib/github/auth');

    // 预热 bot slug 缓存
    const slug = await fetchBotSlug();
    logger.info(`[Instrumentation] Bot slug preloaded: ${slug}`);
  } catch (err) {
    logger.warn('[Instrumentation] Bot slug preload failed:', err);
  }

  // 启动 token 定时刷新服务（立即生成一次，然后每 30 分钟刷新）
  try {
    const { startTokenRefresher } = await import('@/lib/ci/token-refresher');
    startTokenRefresher();
  } catch (err) {
    logger.warn('[Instrumentation] Token refresher failed to start:', err);
  }

  // 自动恢复之前注册的 GitHub Actions Runner
  try {
    const { restoreRunners } = await import('@/lib/runner/service');
    await restoreRunners();
  } catch (runnerErr) {
    logger.warn('[Instrumentation] Runner auto-restore skipped:', runnerErr);
  }
}
