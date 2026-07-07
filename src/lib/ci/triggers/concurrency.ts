/**
 * 并发控制管理器
 *
 * 参考 GitHub Actions 的 concurrency 机制：
 * - 相同 group key 的运行互相排斥
 * - cancelInProgress=true 时取消旧运行，保留最新
 *
 * 实现方式：基于内存的 Map + AbortController
 * 注意：这是进程内的并发控制，跨进程/多实例需要外部锁（如 Redis）
 *
 * 安全说明：
 * - groupKey 模板经过严格白名单验证，只允许 alphanumeric + _ - /
 * - 不接受用户直接输入的任意字符串
 *
 * 内存管理：
 * - 最大并发组数量限制为 1000，防止内存泄漏
 * - 超过限制时淘汰最旧的条目（简单 FIFO 策略）
 * - 每个条目有 1 小时 TTL，过期后自动清理
 * - 生产环境建议使用 Redis 等外部存储替代内存实现
 */

import { logger } from '../../logger';
import type { ConcurrencyConfig, ConcurrencyCheckResult } from './types';

/** 活跃的并发组记录 */
interface ConcurrencyEntry {
  /** 运行 ID */
  runId: string;
  /** 创建时间 */
  createdAt: number;
  /** 取消回调 */
  abortController?: AbortController;
}

/** 并发组白名单字符 */
const SAFE_GROUP_CHARS = /^[a-zA-Z0-9_\-/]+$/;

/**
 * 渲染并发组 key 模板
 * 将 {{event}}, {{ref}}, {{pr_number}} 等占位符替换为实际值
 *
 * 安全说明：占位符名称经过白名单验证，替换值经过 sanitize
 */
export function renderConcurrencyGroup(
  template: string,
  vars: Record<string, string | number>
): string {
  // 模板本身必须只包含安全字符和占位符语法
  if (!template || typeof template !== 'string') return 'default';
  if (template.length > 200) return 'default';

  let result = template;

  // 替换 {{var}} 占位符
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return 'unknown';
    // sanitize: 只保留安全字符（含 /）
    return String(value)
      .replace(/[^a-zA-Z0-9_\-\/]/g, '_')
      .slice(0, 100);
  });

  // 最终验证：渲染后的 key 只能包含安全字符
  if (!SAFE_GROUP_CHARS.test(result)) {
    return 'default';
  }

  return result;
}

/**
 * 并发控制管理器
 */
export class ConcurrencyManager {
  private active = new Map<string, ConcurrencyEntry>();
  private cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** 最大并发组数量（防止内存泄漏） */
  private static readonly MAX_GROUPS = 1000;
  /** 条目过期时间（1 小时） */
  private static readonly ENTRY_TTL = 3600_000;

  /**
   * 检查是否允许运行
   * @returns 并发检查结果，allowed=false 时包含取消信息
   */
  check(config: ConcurrencyConfig, groupKey: string, runId: string): ConcurrencyCheckResult {
    // 输入验证
    if (!groupKey || typeof groupKey !== 'string') {
      return { allowed: false, groupKey: 'invalid', reason: 'Invalid group key' };
    }
    if (!SAFE_GROUP_CHARS.test(groupKey)) {
      return { allowed: false, groupKey, reason: 'Group key contains unsafe characters' };
    }
    if (!runId || typeof runId !== 'string') {
      return { allowed: false, groupKey, reason: 'Invalid run ID' };
    }

    // 检查是否超过最大组数
    if (this.active.size >= ConcurrencyManager.MAX_GROUPS && !this.active.has(groupKey)) {
      this.evictOldest();
    }

    const existing = this.active.get(groupKey);

    if (existing) {
      if (config.cancelInProgress) {
        // 取消旧运行
        if (existing.abortController) {
          existing.abortController.abort();
        }
        this.active.set(groupKey, {
          runId,
          createdAt: Date.now(),
          abortController: new AbortController(),
        });
        this.scheduleCleanup(groupKey);
        return {
          allowed: true,
          groupKey,
          cancelledPrevious: true,
          reason: `Cancelled previous run ${existing.runId}`,
        };
      } else {
        // 不取消，拒绝新运行
        return {
          allowed: false,
          groupKey,
          reason: `Run ${existing.runId} is already active in group "${groupKey}"`,
        };
      }
    }

    // 新组，直接放行
    this.active.set(groupKey, {
      runId,
      createdAt: Date.now(),
      abortController: new AbortController(),
    });
    this.scheduleCleanup(groupKey);
    return { allowed: true, groupKey };
  }

  /**
   * 完成一个运行（释放并发组）
   */
  complete(groupKey: string, runId: string): void {
    const entry = this.active.get(groupKey);
    if (entry && entry.runId === runId) {
      this.active.delete(groupKey);
      this.clearCleanupTimer(groupKey);
    }
  }

  /**
   * 获取并发组的 AbortSignal
   */
  getSignal(groupKey: string): AbortSignal | undefined {
    return this.active.get(groupKey)?.abortController?.signal;
  }

  /**
   * 获取当前活跃组数量（监控用）
   */
  getActiveCount(): number {
    return this.active.size;
  }

  /**
   * 清理所有组（测试用）
   */
  clear(): void {
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();
    this.active.clear();
  }

  /** 淘汰最旧的条目 */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.active) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.active.get(oldestKey);
      // 取消被淘汰条目的运行
      if (entry?.abortController) {
        entry.abortController.abort();
      }
      this.active.delete(oldestKey);
      this.clearCleanupTimer(oldestKey);
      logger.warn(
        `[Concurrency] Evicted oldest group "${oldestKey}" (run ${entry?.runId}) ` +
          `to make room. Active groups: ${this.active.size}`
      );
    }
  }

  /** 自动清理过期条目 */
  private scheduleCleanup(groupKey: string): void {
    this.clearCleanupTimer(groupKey);

    const timer = setTimeout(() => {
      const entry = this.active.get(groupKey);
      if (entry && Date.now() - entry.createdAt > ConcurrencyManager.ENTRY_TTL) {
        this.active.delete(groupKey);
      }
      this.cleanupTimers.delete(groupKey);
    }, ConcurrencyManager.ENTRY_TTL);

    this.cleanupTimers.set(groupKey, timer);
  }

  private clearCleanupTimer(groupKey: string): void {
    const timer = this.cleanupTimers.get(groupKey);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(groupKey);
    }
  }
}
