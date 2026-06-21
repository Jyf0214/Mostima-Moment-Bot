'use client';

import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  GitBranch,
  GitCommitHorizontal,
} from 'lucide-react';

interface CiRun {
  id: number;
  event: string;
  action?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  prNumber?: number | null;
  status: string;
  conclusion?: string | null;
  triggeredBy?: string | null;
  checksRan: string[];
  isBotInitiated?: boolean;
  duration?: number | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  failure: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  cancelled: { icon: XCircle, color: 'text-white/40', bg: 'bg-white/5' },
};

const EVENT_LABELS: Record<string, string> = {
  issue_labeled: 'Issue',
  issue_comment: 'Issue',
  security_audit: 'Audit',
};

function formatDuration(duration: number): string {
  if (duration < 1000) return `${duration}ms`;
  const s = Math.round(duration / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shaShort(sha: string | null): string {
  return sha ? sha.slice(0, 7) : '—';
}

export default function RepoLogsDetailPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const repo = typeof router.query.repo === 'string' ? decodeURIComponent(router.query.repo) : '';

  const [runs, setRuns] = useState<CiRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const fetchRuns = useCallback(
    async (showRefresh = false) => {
      if (!repo) return;
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          repo,
          limit: String(pageSize),
          offset: String(page * pageSize),
          botOnly: 'true',
        });
        const res = await fetch(`/api/ci/runs?${params}`);
        if (res.ok) {
          const data = await res.json();
          let filtered = data.runs || [];
          if (filterStatus) filtered = filtered.filter((r: CiRun) => r.status === filterStatus);
          if (filterEvent) filtered = filtered.filter((r: CiRun) => r.event === filterEvent);
          setRuns(filtered);
          setTotal(data.total || 0);
        }
      } catch {
        /* 静默 */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [repo, filterStatus, filterEvent, page]
  );

  useEffect(() => {
    if (repo) fetchRuns();
  }, [repo]); // eslint-disable-line react-hooks/exhaustive-deps

  const repoShortName = repo.split('/').pop() || repo;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('repoDetail.back')}
            </a>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                {repoShortName}
                <span className="text-white/30 text-sm font-normal">{repo}</span>
              </h1>
              <p className="text-white/40 text-xs mt-0.5">
                {total > 0 ? `${total} ${t('repoDetail.totalRuns')}` : t('repoDetail.noRuns')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={() => fetchRuns(true)}
            className="text-white/50 hover:text-white"
          >
            {t('dashboard.refresh')}
          </Button>
        </div>

        {/* 过滤器 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(0);
            }}
            className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-800">
              Status
            </option>
            <option value="success" className="bg-slate-800">
              ✓ Success
            </option>
            <option value="failure" className="bg-slate-800">
              ✗ Failure
            </option>
            <option value="running" className="bg-slate-800">
              ⟳ Running
            </option>
            <option value="pending" className="bg-slate-800">
              ⏳ Pending
            </option>
            <option value="cancelled" className="bg-slate-800">
              — Cancelled
            </option>
          </select>
          <select
            value={filterEvent}
            onChange={(e) => {
              setFilterEvent(e.target.value);
              setPage(0);
            }}
            className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-800">
              Event
            </option>
            <option value="issue_labeled" className="bg-slate-800">
              Issue (Label)
            </option>
            <option value="issue_comment" className="bg-slate-800">
              Issue (Comment)
            </option>
            <option value="security_audit" className="bg-slate-800">
              Security Audit
            </option>
          </select>
        </div>

        {/* 加载中 */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/20 border-t-purple-500" />
          </div>
        )}

        {/* 空状态 */}
        {!loading && runs.length === 0 && (
          <ProCard
            className="bg-white/5 backdrop-blur-xl border-white/10 border-dashed"
            padding="p-8"
          >
            <div className="text-center">
              <Clock className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">{t('repoDetail.noRuns')}</p>
            </div>
          </ProCard>
        )}

        {/* 运行列表 */}
        {!loading && runs.length > 0 && (
          <div className="space-y-2">
            {runs.map((run) => {
              const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const eventLabel = EVENT_LABELS[run.event] || run.event;
              return (
                <ProCard
                  key={run.id}
                  className="bg-white/5 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all"
                  padding="p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}
                    >
                      <StatusIcon
                        className={`h-4 w-4 ${cfg.color} ${run.status === 'running' ? 'animate-spin' : ''}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                          {eventLabel}
                        </span>
                        {run.branch && (
                          <span className="inline-flex items-center gap-1 text-xs text-white/50">
                            <GitBranch className="h-3 w-3" />
                            {run.branch}
                          </span>
                        )}
                        {run.prNumber && (
                          <span className="text-xs text-blue-400">PR #{run.prNumber}</span>
                        )}
                        {run.action && (
                          <span className="text-[10px] text-white/30">{run.action}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {run.commitSha && (
                          <span className="inline-flex items-center gap-1 text-xs text-white/40 font-mono">
                            <GitCommitHorizontal className="h-3 w-3" />
                            {shaShort(run.commitSha)}
                          </span>
                        )}
                        {run.triggeredBy && (
                          <span className="text-xs text-white/40">@{run.triggeredBy}</span>
                        )}
                        {run.duration != null && (
                          <span className="text-xs text-white/30">
                            {formatDuration(run.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-white/30 block">{timeAgo(run.createdAt)}</span>
                      <span className={`text-[10px] font-medium ${cfg.color}`}>{run.status}</span>
                    </div>
                  </div>
                </ProCard>
              );
            })}
          </div>
        )}

        {/* 分页 */}
        {!loading && total > pageSize && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-white/50 hover:text-white"
            >
              ← Prev
            </Button>
            <span className="text-white/40 text-xs">
              {page + 1} / {Math.ceil(total / pageSize)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
              className="text-white/50 hover:text-white"
            >
              Next →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
