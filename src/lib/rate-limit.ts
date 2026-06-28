/**
 * 简易内存速率限制器
 *
 * 基于 IP 的滑动窗口限流，适用于认证端点防暴力破解。
 * 仅在单实例部署下有效（内存不跨进程共享）。
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 每 5 分钟清理一次过期条目，防止内存泄漏
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

/**
 * 检查并记录一次请求
 * @param key - 限流键（如 IP 地址）
 * @param maxAttempts - 窗口内最大允许次数
 * @param windowMs - 窗口时长（毫秒）
 * @returns 是否允许通过
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 10,
  windowMs: number = 60_000
): boolean {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // 新窗口
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * 获取指定 key 的剩余尝试次数和重置时间
 */
export function getRateLimitInfo(
  key: string,
  maxAttempts: number = 10,
  windowMs: number = 60_000
): { remaining: number; resetInMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    return { remaining: maxAttempts, resetInMs: 0 };
  }

  return {
    remaining: Math.max(0, maxAttempts - entry.count),
    resetInMs: entry.resetAt - now,
  };
}
