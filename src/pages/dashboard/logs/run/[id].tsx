'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  GitBranch,
  ScrollText,
  AlertTriangle,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  SkipForward,
  ChevronsUpDown,
  ChevronsDownUp,
} from 'lucide-react';

interface RunDetail {
  id: number;
  repoFullName: string;
  event: string;
  action: string | null;
  branch: string | null;
  commitSha: string | null;
  prNumber: number | null;
  status: string;
  conclusion: string | null;
  triggeredBy: string | null;
  ruleId: string | null;
  checksRan: string[];
  isBotInitiated: boolean;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  createdAt: string;
  logs: string | null;
}

interface LogStep {
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

interface LogData {
  version: number;
  steps: LogStep[];
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string; ring: string }
> = {
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    label: 'Success',
  },
  failure: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    ring: 'ring-red-200',
    label: 'Failure',
  },
  running: {
    icon: Loader2,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    label: 'Running',
  },
  pending: {
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    label: 'Pending',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-zinc-400',
    bg: 'bg-zinc-50',
    ring: 'ring-zinc-200',
    label: 'Cancelled',
  },
};

const CONCLUSION_CONFIG: Record<
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

function formatDuration(duration: number): string {
  if (duration < 1000) return `${duration}ms`;
  const s = Math.round(duration / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function shaShort(sha: string): string {
  return sha.slice(0, 7);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** 尝试解析结构化日志，失败则返回 null（旧版纯文本日志） */
function parseStructuredLogs(logs: string): LogData | null {
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

/** 带时间线的步骤组件 */
function StepTimeline({
  step,
  index,
  total,
  expandedSet,
  onToggle,
}: {
  step: LogStep;
  index: number;
  total: number;
  expandedSet: Set<string>;
  onToggle: (key: string) => void;
}) {
  const stepKey = `${step.name}-${index}`;
  const expanded = expandedSet.has(stepKey);
  const conclusion = step.conclusion || (step.status === 'completed' ? 'success' : null);
  const cfg = conclusion ? CONCLUSION_CONFIG[conclusion] : null;
  const isLast = index === total - 1;
  const hasSubSteps = step.subSteps && step.subSteps.length > 0;
  const hasOutput = !!step.output;
  const isExpandable = hasSubSteps || hasOutput;

  const StatusIcon = cfg?.icon || (step.status === 'in_progress' ? Loader2 : Clock);
  const statusColor =
    cfg?.color || (step.status === 'in_progress' ? 'text-blue-500' : 'text-zinc-400');

  return (
    <div className="relative flex gap-3">
      {/* 时间线连接器 */}
      <div className="flex flex-col items-center shrink-0">
        {/* 状态圆点 */}
        <div
          className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
            cfg ? cfg.bg : 'bg-zinc-100'
          } ring-2 ${cfg ? cfg.borderColor : 'ring-zinc-200'}`}
        >
          <StatusIcon
            className={`h-4 w-4 ${statusColor} ${
              step.status === 'in_progress' ? 'animate-spin' : ''
            }`}
          />
        </div>
        {/* 连接线 */}
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-4 ${
              conclusion === 'failure' ? 'bg-red-200' : 'bg-zinc-200'
            }`}
          />
        )}
      </div>

      {/* 步骤内容 */}
      <div className={`flex-1 pb-4 ${isLast ? 'pb-0' : ''}`}>
        {/* 步骤头部 */}
        <button
          onClick={() => isExpandable && onToggle(stepKey)}
          className={`w-full text-left group ${isExpandable ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isExpandable ? 'hover:bg-zinc-50 group-hover:bg-zinc-50' : ''
            }`}
          >
            {/* 展开/折叠箭头 */}
            {isExpandable ? (
              expanded ? (
                <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
              )
            ) : (
              <div className="w-4 shrink-0" />
            )}

            {/* 步骤名称 */}
            <span
              className={`text-sm font-medium flex-1 min-w-0 truncate ${
                conclusion === 'failure'
                  ? 'text-red-700'
                  : conclusion === 'success'
                    ? 'text-zinc-900'
                    : 'text-zinc-600'
              }`}
            >
              {step.name}
            </span>

            {/* 命令标签 */}
            {step.command && (
              <code className="text-[10px] text-zinc-400 font-mono bg-zinc-100 px-2 py-0.5 rounded shrink-0 hidden sm:inline max-w-[200px] truncate">
                {step.command}
              </code>
            )}

            {/* 耗时 */}
            {step.durationMs != null && step.durationMs > 0 && (
              <span className="text-[10px] text-zinc-400 shrink-0 tabular-nums">
                {formatDuration(step.durationMs)}
              </span>
            )}

            {/* 状态徽章 */}
            {conclusion && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                  cfg ? `${cfg.bg} ${cfg.color}` : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {conclusion === 'success'
                  ? 'OK'
                  : conclusion === 'failure'
                    ? 'FAIL'
                    : conclusion === 'skipped'
                      ? 'SKIP'
                      : conclusion}
              </span>
            )}
          </div>
        </button>

        {/* 展开内容 */}
        {expanded && (
          <div className="ml-2 mt-1 space-y-2">
            {/* 子步骤 */}
            {hasSubSteps && (
              <div className="space-y-0">
                {step.subSteps!.map((sub, i) => (
                  <StepTimeline
                    key={`${sub.name}-${i}`}
                    step={sub}
                    index={i}
                    total={step.subSteps!.length}
                    expandedSet={expandedSet}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            )}

            {/* 输出 */}
            {hasOutput && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200 bg-zinc-100/50">
                  <span className="text-[10px] text-zinc-500 font-medium">Output</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(step.output || '');
                    }}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <pre className="p-3 text-xs text-zinc-700 font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                  {step.output}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 结构化日志渲染 */
function StructuredLogs({
  logData,
  onCopy,
  copied,
}: {
  logData: LogData;
  onCopy: () => void;
  copied: boolean;
}) {
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const successCount = logData.steps.filter((s) => s.conclusion === 'success').length;
  const failCount = logData.steps.filter((s) => s.conclusion === 'failure').length;
  const skipCount = logData.steps.filter((s) => s.conclusion === 'skipped').length;

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedSet(new Set());
    } else {
      const all = new Set<string>();
      const collect = (steps: LogStep[], prefix = '') => {
        steps.forEach((s, i) => {
          const key = `${s.name}-${prefix}${i}`;
          if (s.output || (s.subSteps && s.subSteps.length > 0)) {
            all.add(key);
          }
          if (s.subSteps) collect(s.subSteps, `${key}-`);
        });
      };
      collect(logData.steps);
      setExpandedSet(all);
    }
    setAllExpanded(!allExpanded);
  };

  const toggleStep = (key: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div>
      {/* 摘要栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500 font-medium">
            {logData.steps.length} {logData.steps.length === 1 ? 'step' : 'steps'}
          </span>
          {successCount > 0 && (
            <span className="text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {successCount} passed
            </span>
          )}
          {failCount > 0 && (
            <span className="text-red-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" /> {failCount} failed
            </span>
          )}
          {skipCount > 0 && (
            <span className="text-zinc-400 flex items-center gap-1">
              <SkipForward className="h-3 w-3" /> {skipCount} skipped
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            {allExpanded ? (
              <>
                <ChevronsDownUp className="h-3 w-3" />
                Collapse all
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-3 w-3" />
                Expand all
              </>
            )}
          </button>
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy JSON
              </>
            )}
          </button>
        </div>
      </div>

      {/* 步骤时间线 */}
      <div>
        {logData.steps.map((step, i) => (
          <StepTimeline
            key={`${step.name}-${i}`}
            step={step}
            index={i}
            total={logData.steps.length}
            expandedSet={expandedSet}
            onToggle={toggleStep}
          />
        ))}
      </div>
    </div>
  );
}

export default function RunDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = router.query;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchRun = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ci/runs?id=${id}`);
      if (res.ok) {
        setRun(await res.json());
      } else if (res.status === 404) {
        setError(t('repoDetail.notFound'));
      } else {
        setError(t('home.checkStatusFailed'));
      }
    } catch {
      setError(t('home.checkStatusFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  /** 解析结构化日志 */
  const logData = run?.logs ? parseStructuredLogs(run.logs) : null;

  const copyLogs = async () => {
    if (!run?.logs) return;
    try {
      await navigator.clipboard.writeText(run.logs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板 API 不可用时静默
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => router.back()}
            className="text-zinc-500 hover:text-zinc-900 mb-6"
          >
            {t('repoDetail.back')}
          </Button>
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error || t('repoDetail.notFound') || 'Run not found'}
          </div>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* 返回按钮 */}
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() =>
            router.push(`/dashboard/logs?repo=${encodeURIComponent(run.repoFullName)}`)
          }
          className="text-zinc-500 hover:text-zinc-900 mb-6"
        >
          {t('repoDetail.back')}
        </Button>

        {/* 运行信息卡片 */}
        <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`h-12 w-12 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 ring-2 ${cfg.ring}`}
            >
              <StatusIcon
                className={`h-6 w-6 ${cfg.color} ${run.status === 'running' ? 'animate-spin' : ''}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-lg font-bold text-zinc-900">#{run.id}</h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
                >
                  {cfg.label}
                </span>
                {run.conclusion && (
                  <span className="text-xs text-zinc-500">→ {run.conclusion}</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-zinc-500 flex-wrap">
                <span className="font-medium text-zinc-700">{run.repoFullName}</span>
                {run.branch && (
                  <span className="inline-flex items-center gap-1">
                    <GitBranch className="h-3.5 w-3.5" />
                    {run.branch}
                  </span>
                )}
                {run.prNumber && <span className="text-blue-500">PR #{run.prNumber}</span>}
                {run.action && <span className="text-zinc-400">{run.action}</span>}
              </div>
            </div>
          </div>
        </ProCard>

        {/* 详细信息 */}
        <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
          <h3 className="text-zinc-900 font-semibold mb-4">{t('repoDetail.runInfo')}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-400">{t('repoDetail.event')}</span>
              <p className="text-zinc-900 font-medium">{run.event}</p>
            </div>
            <div>
              <span className="text-zinc-400">{t('repoDetail.triggeredBy')}</span>
              <p className="text-zinc-900 font-medium">
                {run.triggeredBy ? `@${run.triggeredBy}` : '-'}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">{t('repoDetail.commit')}</span>
              <p className="text-zinc-900 font-mono text-xs">
                {run.commitSha ? shaShort(run.commitSha) : '-'}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">{t('repoDetail.ruleId')}</span>
              <p className="text-zinc-900 font-medium">{run.ruleId || '-'}</p>
            </div>
            <div>
              <span className="text-zinc-400">{t('repoDetail.duration')}</span>
              <p className="text-zinc-900 font-medium">
                {run.duration != null ? formatDuration(run.duration) : '-'}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">{t('repoDetail.botInitiated')}</span>
              <p className="text-zinc-900 font-medium">
                {run.isBotInitiated ? t('repoDetail.yes') : t('repoDetail.no')}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">{t('repoDetail.startedAt')}</span>
              <p className="text-zinc-900 font-medium">
                {run.startedAt ? formatTime(run.startedAt) : '-'}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">{t('repoDetail.completedAt')}</span>
              <p className="text-zinc-900 font-medium">
                {run.completedAt ? formatTime(run.completedAt) : '-'}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-zinc-400">{t('repoDetail.createdAt')}</span>
              <p className="text-zinc-900 font-medium">{formatTime(run.createdAt)}</p>
            </div>
          </div>
        </ProCard>

        {/* 检查步骤 */}
        {run.checksRan.length > 0 && (
          <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
            <h3 className="text-zinc-900 font-semibold mb-4">{t('repoDetail.checkSteps')}</h3>
            <div className="flex flex-wrap gap-2">
              {run.checksRan.map((check, i) => (
                <span
                  key={`${check}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-xs text-purple-600"
                >
                  {check}
                </span>
              ))}
            </div>
          </ProCard>
        )}

        {/* 运行日志 */}
        <ProCard className="bg-white border-zinc-200" padding="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-cyan-500" />
              <h3 className="text-zinc-900 font-semibold">{t('repoDetail.logs')}</h3>
            </div>
          </div>
          {run.logs ? (
            logData ? (
              <StructuredLogs logData={logData} onCopy={copyLogs} copied={copied} />
            ) : (
              <div>
                <div className="flex items-center justify-end mb-2">
                  <button
                    onClick={copyLogs}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        {t('apiKey.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {t('apiKey.copy')}
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-xs text-zinc-700 font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
                  {run.logs}
                </pre>
              </div>
            )
          ) : (
            <p className="text-zinc-400 text-sm">{t('repoDetail.noLogs')}</p>
          )}
        </ProCard>
      </div>
    </div>
  );
}
