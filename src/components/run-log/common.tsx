import React from 'react';
import { CheckCircle2, SkipForward, XCircle } from 'lucide-react';

/** 结构化日志中的单个步骤 */
export interface LogStep {
  name: string;
  command?: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'skipped' | 'cancelled' | null;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  output?: string;
  subSteps?: LogStep[];
}

/** 结构化日志整体（version=1） */
export interface LogData {
  version: number;
  steps: LogStep[];
}

export const CONCLUSION_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; borderColor: string }
> = {
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  failure: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  skipped: {
    icon: SkipForward,
    color: 'text-zinc-400',
    bg: 'bg-zinc-50',
    borderColor: 'border-zinc-200',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-zinc-400',
    bg: 'bg-zinc-50',
    borderColor: 'border-zinc-200',
  },
};

/** 本地化时间显示 */
export function formatTime(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 统一生成步骤展开状态的唯一 key
 *
 * prefix 区分层级（子步骤携带父级 key + '/'），name#index 区分同名步骤，
 * 初始化收集、递归渲染与点击切换必须全部经过此函数，否则会互相串状态。
 */
export function buildStepKey(prefix: string, name: string, index: number): string {
  return `${prefix}${name}#${index}`;
}

/** 收集所有可展开步骤（有输出或子步骤）的 key 到 out */
export function collectExpandableKeys(steps: LogStep[], prefix: string, out: Set<string>): void {
  steps.forEach((s, i) => {
    const key = buildStepKey(prefix, s.name, i);
    if (s.output || (s.subSteps && s.subSteps.length > 0)) {
      out.add(key);
    }
    if (s.subSteps) collectExpandableKeys(s.subSteps, `${key}/`, out);
  });
}

/** 尝试解析结构化日志，失败则返回 null（旧版纯文本日志） */
export function parseStructuredLogs(logs: string): LogData | null {
  try {
    const parsed = JSON.parse(logs);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.steps)) {
      return parsed as LogData;
    }
  } catch {
    // 非 JSON，视为纯文本日志
  }
  return null;
}
