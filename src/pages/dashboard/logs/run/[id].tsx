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
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  success: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Success' },
  failure: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Failure' },
  running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Running' },
  pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Pending' },
  cancelled: { icon: XCircle, color: 'text-zinc-400', bg: 'bg-zinc-50', label: 'Cancelled' },
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
          onClick={() => router.back()}
          className="text-zinc-500 hover:text-zinc-900 mb-6"
        >
          {t('repoDetail.back')}
        </Button>

        {/* 运行信息卡片 */}
        <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`h-12 w-12 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}
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
              <span className="text-zinc-400">Event</span>
              <p className="text-zinc-900 font-medium">{run.event}</p>
            </div>
            <div>
              <span className="text-zinc-400">Triggered By</span>
              <p className="text-zinc-900 font-medium">
                {run.triggeredBy ? `@${run.triggeredBy}` : '-'}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">Commit</span>
              <p className="text-zinc-900 font-mono text-xs">
                {run.commitSha ? shaShort(run.commitSha) : '-'}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">Rule ID</span>
              <p className="text-zinc-900 font-medium">{run.ruleId || '-'}</p>
            </div>
            <div>
              <span className="text-zinc-400">Duration</span>
              <p className="text-zinc-900 font-medium">
                {run.duration != null ? formatDuration(run.duration) : '-'}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">Bot Initiated</span>
              <p className="text-zinc-900 font-medium">{run.isBotInitiated ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-zinc-400">Started At</span>
              <p className="text-zinc-900 font-medium">
                {run.startedAt ? formatTime(run.startedAt) : '-'}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">Completed At</span>
              <p className="text-zinc-900 font-medium">
                {run.completedAt ? formatTime(run.completedAt) : '-'}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-zinc-400">Created At</span>
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
            {run.logs && (
              <button
                onClick={copyLogs}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    {t('settings.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    {t('settings.copy')}
                  </>
                )}
              </button>
            )}
          </div>
          {run.logs ? (
            <pre className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-xs text-zinc-700 font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
              {run.logs}
            </pre>
          ) : (
            <p className="text-zinc-400 text-sm">{t('repoDetail.noLogs')}</p>
          )}
        </ProCard>
      </div>
    </div>
  );
}
