/**
 * Next.js 服务端启动钩子
 *
 * register() 在服务器启动时执行一次，用于预热关键缓存。
 * 此文件是唯一可靠的服务器启动时执行逻辑的位置。
 */

export async function register() {
  // 仅在服务端执行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { fetchBotSlug } = await import('@/lib/github/auth');
      const { logger } = await import('@/lib/logger');
      const slug = await fetchBotSlug();
      logger.info(`[Instrumentation] Bot slug preloaded: ${slug}`);
    } catch {
      // 预热失败不阻断启动，仅静默跳过
    }
  }
}
