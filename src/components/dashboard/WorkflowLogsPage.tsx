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
  FolderGit2,
  ArrowRight,
  GitBranch,
} from 'lucide-react';

interface RepoSummary {
  repoFullName: string;
  totalRuns: number;
  latest: {
    status: string;
    createdAt: string;
    event: string;
    branch: string | null;
  };
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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function WorkflowLogsPage() {
  const { t } = useTranslation();
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRepos = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/ci/runs');
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos || []);
      }
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDetail = (repoFullName: string) => {
    window.location.href = `/dashboard/logs/${encodeURIComponent(repoFullName)}`;
  };

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          {repos.length > 0 && (
            <span>
              {repos.length} {t('home.repositories')}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={() => fetchRepos(true)}
          className="text-white/50 hover:text-white"
        >
          {t('dashboard.refresh')}
        </Button>
      </div>

      {/* 加载中 */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/20 border-t-purple-500" />
        </div>
      )}

      {/* 空状态 */}
      {!loading && repos.length === 0 && (
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

      {/* 仓库列表 */}
      {!loading && repos.length > 0 && (
        <div className="space-y-2">
          {repos.map((repo) => {
            const cfg = STATUS_CONFIG[repo.latest.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const eventLabel = EVENT_LABELS[repo.latest.event] || repo.latest.event;
            const repoName = repo.repoFullName.split('/').pop() || repo.repoFullName;
            const owner = repo.repoFullName.split('/').slice(0, -1).join('/');

            return (
              <button
                key={repo.repoFullName}
                onClick={() => handleViewDetail(repo.repoFullName)}
                className="w-full text-left"
              >
                <ProCard
                  className="bg-white/5 backdrop-blur-xl border-white/10 hover:border-purple-500/30 hover:bg-white/[0.07] transition-all cursor-pointer group"
                  padding="p-4"
                >
                  <div className="flex items-center gap-4">
                    {/* 仓库图标 */}
                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <FolderGit2 className="h-5 w-5 text-purple-400" />
                    </div>

                    {/* 仓库信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm truncate">{repoName}</span>
                        <span className="text-white/30 text-xs truncate">{owner}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-white/40 text-xs">
                          {repo.totalRuns} {t('repoDetail.totalRuns')}
                        </span>
                        {repo.latest.branch && (
                          <span className="inline-flex items-center gap-1 text-xs text-white/40">
                            <GitBranch className="h-3 w-3" />
                            {repo.latest.branch}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
                          {eventLabel}
                        </span>
                      </div>
                    </div>

                    {/* 右侧：最新状态 + 箭头 */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon
                            className={`h-3.5 w-3.5 ${cfg.color} ${repo.latest.status === 'running' ? 'animate-spin' : ''}`}
                          />
                          <span className={`text-xs font-medium ${cfg.color}`}>
                            {repo.latest.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/30 block mt-0.5">
                          {timeAgo(repo.latest.createdAt)}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-purple-400 transition-colors" />
                    </div>
                  </div>
                </ProCard>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
