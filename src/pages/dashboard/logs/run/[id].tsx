'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { StructuredLogs } from '@/components/run-log/StructuredLogs';
import { formatTime, parseStructuredLogs } from '@/components/run-log/common';
import {
  ApiError,
  apiErrorMessage,
  apiJson,
  isUnauthorized,
  redirectToHome,
} from '@/lib/api-client';
import { copyTextToClipboard } from '@/lib/clipboard';
import { formatDuration } from '@/lib/time';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  GitBranch,
  ScrollText,
  Copy,
  Check,
  ExternalLink,
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

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; ring: string; labelKey: string }
> = {
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    labelKey: 'runDetail.statusSuccess',
  },
  failure: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    ring: 'ring-red-200',
    labelKey: 'runDetail.statusFailure',
  },
  running: {
    icon: Loader2,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    labelKey: 'runDetail.statusRunning',
  },
  pending: {
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    labelKey: 'runDetail.statusPending',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-zinc-400',
    bg: 'bg-zinc-50',
    ring: 'ring-zinc-200',
    labelKey: 'runDetail.statusCancelled',
  },
};

export default function RunDetailPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = router.query;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 轮询失败信息：非 null 时停止轮询并展示错误横幅（带重试）
  const [pollError, setPollError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);

  // 时间显示跟随界面语言：zh 系用 zh-CN，其余用 en-US
  const dateLocale = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US';

  const fetchRun = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPollError(null);
    try {
      const data = await apiJson<RunDetail>(`/api/ci/runs?id=${id}`);
      setRun(data);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setError(
        err instanceof ApiError && err.status === 404
          ? t('repoDetail.notFound')
          : apiErrorMessage(err, t('repoDetail.loadFailed'))
      );
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // 轮询单次刷新：静默进行，不置 loading、不清空现有数据
  const pollRun = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiJson<RunDetail>(`/api/ci/runs?id=${id}`);
      setPollError(null);
      setRun(data);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setPollError(
        err instanceof ApiError && err.status === 404
          ? t('repoDetail.notFound')
          : apiErrorMessage(err, t('repoDetail.loadFailed'))
      );
    }
  }, [id, t]);

  // 运行中/等待中的 run 每 10 秒静默轮询；变为终态、轮询失败或组件卸载时清理
  useEffect(() => {
    if (!run || pollError) return;
    if (run.status !== 'running' && run.status !== 'pending') return;
    const timer = setInterval(() => {
      pollRun();
    }, 10000);
    return () => clearInterval(timer);
  }, [run, pollError, pollRun]);

  /** 解析结构化日志 */
  const logData = run?.logs ? parseStructuredLogs(run.logs) : null;

  const copyLogs = async () => {
    if (!run?.logs) return;
    const ok = await copyTextToClipboard(run.logs);
    if (!ok) return; // 剪贴板不可用时静默失败
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <DashboardLayout activePage="logs">
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !run) {
    return (
      <DashboardLayout activePage="logs">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() =>
            router.push({ pathname: '/dashboard', query: { page: 'logs' } }, undefined, {
              shallow: true,
            })
          }
          className="text-zinc-500 hover:text-zinc-900 mb-6"
        >
          {t('repoDetail.back')}
        </Button>
        <ErrorAlert
          message={error || t('repoDetail.notFound')}
          onRetry={() => void fetchRun()}
          retryLabel={t('common.retry')}
        />
      </DashboardLayout>
    );
  }

  const copySha = async () => {
    if (!run?.commitSha) return;
    const ok = await copyTextToClipboard(run.commitSha);
    if (!ok) return; // 剪贴板不可用时静默失败
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  return (
    <DashboardLayout activePage="logs">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="sm"
        icon={<ArrowLeft className="h-4 w-4" />}
        onClick={() =>
          router.push({ pathname: '/dashboard', query: { page: 'logs', repo: run.repoFullName } })
        }
        className="text-zinc-500 hover:text-zinc-900 mb-6"
      >
        {t('repoDetail.back')}
      </Button>

      {/* 轮询失败提示（带重试，重试成功后自动恢复轮询） */}
      {pollError && (
        <ErrorAlert
          message={pollError}
          onRetry={() => void fetchRun()}
          retryLabel={t('common.retry')}
          className="mb-6"
        />
      )}

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
                {t(cfg.labelKey)}
              </span>
              {run.conclusion && <span className="text-xs text-zinc-500">→ {run.conclusion}</span>}
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
            <span className="text-zinc-400">{t('repoDetail.action')}</span>
            <p className="text-zinc-900 font-medium">{run.action || '-'}</p>
          </div>
          <div>
            <span className="text-zinc-400">{t('repoDetail.triggeredBy')}</span>
            <p className="text-zinc-900 font-medium">
              {run.triggeredBy ? `@${run.triggeredBy}` : '-'}
            </p>
          </div>
          <div>
            <span className="text-zinc-400">{t('repoDetail.ruleId')}</span>
            <p className="text-zinc-900 font-medium">{run.ruleId || '-'}</p>
          </div>
          <div>
            <span className="text-zinc-400">{t('repoDetail.commit')}</span>
            {run.commitSha ? (
              <div className="flex items-center gap-2">
                <p className="text-zinc-900 font-mono text-xs">{run.commitSha}</p>
                <button
                  onClick={copySha}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                  title="Copy full SHA"
                >
                  {copiedSha ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <a
                  href={`https://github.com/${run.repoFullName}/commit/${run.commitSha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                  title="View on GitHub"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <p className="text-zinc-900 font-medium">-</p>
            )}
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
              {run.startedAt ? formatTime(run.startedAt, dateLocale) : '-'}
            </p>
          </div>
          <div>
            <span className="text-zinc-400">{t('repoDetail.completedAt')}</span>
            <p className="text-zinc-900 font-medium">
              {run.completedAt ? formatTime(run.completedAt, dateLocale) : '-'}
            </p>
          </div>
          <div>
            <span className="text-zinc-400">{t('repoDetail.createdAt')}</span>
            <p className="text-zinc-900 font-medium">{formatTime(run.createdAt, dateLocale)}</p>
          </div>
          {run.prNumber && (
            <div>
              <span className="text-zinc-400">Pull Request</span>
              <p>
                <a
                  href={`https://github.com/${run.repoFullName}/pull/${run.prNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                >
                  PR #{run.prNumber}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          )}
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
    </DashboardLayout>
  );
}
