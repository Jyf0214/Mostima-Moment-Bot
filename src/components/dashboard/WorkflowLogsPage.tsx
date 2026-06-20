'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  X,
  Search,
  GitBranch,
  GitCommitHorizontal,
  ExternalLink,
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
  ruleId?: string | null;
  checksRan: string[];
  startedAt?: string | null;
  completedAt?: string | null;
  duration?: number | null;
  createdAt: string;
}

interface RunsResponse {
  runs: CiRun[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  failure: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  cancelled: { icon: XCircle, color: 'text-white/40', bg: 'bg-white/5' },
};

const EVENT_LABELS: Record<string, string> = {
  pull_request: 'PR',
  push: 'Push',
  workflow_job: 'Job',
  workflow_run: 'Run',
};

function formatDuration(duration: number): string {
  if (duration < 1000) return `${duration}ms`;
  const s = Math.round(duration / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shaShort(sha: string | null): string {
  if (!sha) return '—';
  return sha.slice(0, 7);
}

export default function WorkflowLogsPage() {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<CiRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterEvent, setFilterEvent] = useState<string>('');
  const [searchRepo, setSearchRepo] = useState('');

  const fetchRuns = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ limit: '50' });
        if (searchRepo.trim()) params.set('repo', searchRepo.trim());

        const res = await fetch(`/api/ci/runs?${params}`);
        if (res.ok) {
          const data: RunsResponse = await res.json();
          let filtered = data.runs;
          if (filterStatus) filtered = filtered.filter((r) => r.status === filterStatus);
          if (filterEvent) filtered = filtered.filter((r) => r.event === filterEvent);
          setRuns(filtered);
          setTotal(data.total);
        }
      } catch {
        // 静默处理
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchRepo, filterStatus, filterEvent]
  );

  useEffect(() => {
    fetchRuns();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => fetchRuns(true);

  const handleSearch = () => fetchRuns();

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-white/40 text-xs">
            {total > 0 && (
              <span>
                {total} {t('repoDetail.totalRuns')}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={handleRefresh}
          className="text-white/50 hover:text-white"
        >
          {t('dashboard.refresh')}
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 仓库搜索 */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={searchRepo}
            onChange={(e) => setSearchRepo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="owner/repo"
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 outline-none focus:border-purple-500/50 transition-colors"
          />
          {searchRepo && (
            <button
              onClick={() => {
                setSearchRepo('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 状态过滤 */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
        >
          <option value="" className="bg-slate-800">
            {t('githubTest.envVars')} / Status
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

        {/* 事件过滤 */}
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
        >
          <option value="" className="bg-slate-800">
            Event / {t('home.repositories')}
          </option>
          <option value="pull_request" className="bg-slate-800">
            PR
          </option>
          <option value="push" className="bg-slate-800">
            Push
          </option>
          <option value="workflow_job" className="bg-slate-800">
            Workflow Job
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
                  {/* 状态图标 */}
                  <div
                    className={`h-8 w-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}
                  >
                    <StatusIcon
                      className={`h-4 w-4 ${cfg.color} ${run.status === 'running' ? 'animate-spin' : ''}`}
                    />
                  </div>

                  {/* 主信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 事件类型 */}
                      <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                        {eventLabel}
                      </span>
                      {/* 分支 */}
                      {run.branch && (
                        <span className="inline-flex items-center gap-1 text-xs text-white/50">
                          <GitBranch className="h-3 w-3" />
                          {run.branch}
                        </span>
                      )}
                      {/* PR 编号 */}
                      {run.prNumber && (
                        <a
                          href={`#/pr-${run.prNumber}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          PR #{run.prNumber}
                        </a>
                      )}
                      {/* Action */}
                      {run.action && (
                        <span className="text-[10px] text-white/30">{run.action}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {/* Commit SHA */}
                      {run.commitSha && (
                        <span className="inline-flex items-center gap-1 text-xs text-white/40 font-mono">
                          <GitCommitHorizontal className="h-3 w-3" />
                          {shaShort(run.commitSha)}
                        </span>
                      )}
                      {/* 触发者 */}
                      {run.triggeredBy && (
                        <span className="text-xs text-white/40">@{run.triggeredBy}</span>
                      )}
                      {/* 耗时 */}
                      {run.duration != null && (
                        <span className="text-xs text-white/30">
                          {formatDuration(run.duration)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 右侧信息 */}
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
    </div>
  );
}
