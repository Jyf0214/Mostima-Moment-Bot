/**
 * 时间显示工具：相对时间与耗时格式化
 *
 * 从各页面组件中收敛而来（原先在 ApiKeyPage / RunnersPage / WorkflowLogsPage 各有一份重复实现）。
 */

type TranslateFn = (key: string, opts?: Record<string, string>) => string;

/** 相对时间：x秒前 / x分钟前 / x小时前 / x天前 */
export function timeAgo(dateStr: string, t: TranslateFn): string {
  const rawMs = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(rawMs)) return '-';
  // 未来时间戳/时钟偏移会产生负数，显示"-5秒前"没有意义，钳到 0
  const diff = Math.max(0, Math.floor(rawMs / 1000));
  if (diff < 60) return t('common.secondsAgo', { count: String(diff) });
  if (diff < 3600) return t('common.minutesAgo', { count: String(Math.floor(diff / 60)) });
  if (diff < 86400) return t('common.hoursAgo', { count: String(Math.floor(diff / 3600)) });
  return t('common.daysAgo', { count: String(Math.floor(diff / 86400)) });
}

/** 毫秒耗时格式化：890ms / 12s / 3m 5s */
export function formatDuration(duration: number): string {
  if (duration < 1000) return `${duration}ms`;
  const s = Math.round(duration / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/** 截取 commit SHA 前 7 位，空值显示占位符 */
export function shaShort(sha: string | null): string {
  if (!sha) return '—';
  return sha.slice(0, 7);
}
