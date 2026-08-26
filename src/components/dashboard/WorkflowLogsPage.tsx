'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import { Select } from '@/components/ui/Select';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiErrorMessage, apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';
import { timeAgo, formatDuration, shaShort } from '@/lib/time';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
  FolderGit2,
  ArrowRight,
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
  ruleId?: string | null;
  checksRan: string[];
  isBotInitiated?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  duration?: number | null;
  createdAt: string;
}

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
  success: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  failure: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50' },
  pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
  cancelled: { icon: XCircle, color: 'text-zinc-400', bg: 'bg-zinc-50' },
};

const EVENT_LABELS: Record<string, string> = {
  pull_request: 'PR',
  push: 'Push',
  workflow_job: 'Job',
  workflow_run: 'Run',
  issue_labeled: 'Issue',
  issue_comment: 'Issue',
  security_audit: 'Audit',
};

export default function WorkflowLogsPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // 从路由派生选中仓库（统一走 /dashboard?page=logs&repo= 单一 URL 形态）
  const selectedRepo =
    router.isReady && typeof router.query.repo === 'string' && router.query.repo
      ? router.query.repo
      : null;

  // === 列表视图状态 ===
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // === 详情视图状态 ===
  const [runs, setRuns] = useState<CiRun[]>([]);
  const [total, setTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailRefreshing, setDetailRefreshing] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 30;

  // 竞态守卫序号：仅接受最新一次请求的响应
  const reposRequestIdRef = useRef(0);
  const runsRequestIdRef = useRef(0);

  // === 列表数据 ===
  const fetchRepos = useCallback(
    async (showRefresh = false) => {
      const requestId = ++reposRequestIdRef.current;
      if (showRefresh) setListRefreshing(true);
      else setListLoading(true);
      setListError(null);
      try {
        const data = await apiJson<{ repos?: RepoSummary[] }>('/api/ci/runs');
        // 响应回来时已不是最新请求则丢弃，避免旧响应覆盖新响应
        if (reposRequestIdRef.current !== requestId) return;
        setRepos(data.repos || []);
      } catch (err) {
        if (reposRequestIdRef.current !== requestId) return;
        if (isUnauthorized(err)) {
          redirectToHome();
          return;
        }
        setListError(apiErrorMessage(err, t('workflowLogs.loadRunsFailed')));
      } finally {
        if (reposRequestIdRef.current === requestId) {
          setListLoading(false);
          setListRefreshing(false);
        }
      }
    },
    [t]
  );

  // === 详情数据（筛选与分页作为查询参数交给服务端过滤）===
  const fetchRuns = useCallback(
    async (showRefresh = false) => {
      if (!selectedRepo) return;
      const requestId = ++runsRequestIdRef.current;
      if (showRefresh) setDetailRefreshing(true);
      else setDetailLoading(true);
      setDetailError(null);
      try {
        const params = new URLSearchParams({
          repo: selectedRepo,
          limit: String(pageSize),
          offset: String(page * pageSize),
          botOnly: 'true',
        });
        if (filterStatus) params.set('status', filterStatus);
        if (filterEvent) params.set('event', filterEvent);
        const data = await apiJson<{ runs?: CiRun[]; total?: number }>(`/api/ci/runs?${params}`);
        // 响应回来时已不是最新请求则丢弃，避免快速切换筛选/翻页时旧响应覆盖新响应
        if (runsRequestIdRef.current !== requestId) return;
        setRuns(data.runs || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (runsRequestIdRef.current !== requestId) return;
        if (isUnauthorized(err)) {
          redirectToHome();
          return;
        }
        setDetailError(apiErrorMessage(err, t('workflowLogs.loadRunsFailed')));
      } finally {
        if (runsRequestIdRef.current === requestId) {
          setDetailLoading(false);
          setDetailRefreshing(false);
        }
      }
    },
    [selectedRepo, page, filterStatus, filterEvent, t]
  );

  // 未选中仓库时加载仓库列表（等待路由就绪，避免直链 ?repo= 初载时多拉一次列表）
  useEffect(() => {
    if (!router.isReady) return;
    if (!selectedRepo) fetchRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchRepos 变化不应触发重新获取
  }, [router.isReady, selectedRepo]);

  // 选中仓库时加载运行记录（筛选与翻页变化也会重新拉取）
  useEffect(() => {
    if (selectedRepo) fetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchRuns 变化不应触发重新获取
  }, [selectedRepo, filterStatus, filterEvent, page]);

  // repo 变化时清空详情数据，避免显示上一个仓库的遗留内容（如 header 上的旧 total）
  useEffect(() => {
    setRuns([]);
    setTotal(0);
    setPage(0);
    setFilterStatus('');
    setFilterEvent('');
  }, [selectedRepo]);

  // 进入某仓库的运行记录列表：push 产生历史条目，浏览器后退可返回
  const handleViewDetail = (repoFullName: string) => {
    router.push(
      { pathname: '/dashboard', query: { page: 'logs', repo: repoFullName } },
      undefined,
      {
        shallow: true,
      }
    );
  };

  // 返回列表：显式 push 不带 repo 的地址（不用 router.back()，
  // 避免用户经直链 ?repo= 进入时后退会退出站点）；浏览器后退由 query 同步自然处理
  const handleBack = () => {
    router.push({ pathname: '/dashboard', query: { page: 'logs' } }, undefined, {
      shallow: true,
    });
  };

  // 是否处于筛选状态（决定空状态文案）
  const hasFilters = filterStatus !== '' || filterEvent !== '';

  // === 详情视图 ===
  if (selectedRepo) {
    const repoShortName = selectedRepo.split('/').pop() || selectedRepo;
    return (
      <div className="space-y-4">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors text-sm"
              aria-label={t('repoDetail.back')}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('repoDetail.back')}
            </button>
            <div>
              <h1 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                {repoShortName}
                <span className="text-zinc-400 text-sm font-normal">{selectedRepo}</span>
              </h1>
              <p className="text-zinc-500 text-xs mt-0.5">
                {total > 0 ? `${total} ${t('repoDetail.totalRuns')}` : t('repoDetail.noRuns')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={`h-3.5 w-3.5 ${detailRefreshing ? 'animate-spin' : ''}`} />}
            onClick={() => fetchRuns(true)}
            className="text-zinc-500 hover:text-zinc-700"
          >
            {t('dashboard.refresh')}
          </Button>
        </div>

        {/* 过滤器 */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(0);
            }}
            size="sm"
            className="w-auto"
          >
            <option value="">{t('workflowLogs.statusFilter')}</option>
            <option value="success">✓ {t('workflowLogs.statusSuccess')}</option>
            <option value="failure">✗ {t('workflowLogs.statusFailure')}</option>
            <option value="running">⟳ {t('workflowLogs.statusRunning')}</option>
            <option value="pending">⏳ {t('workflowLogs.statusPending')}</option>
            <option value="cancelled">— {t('workflowLogs.statusCancelled')}</option>
          </Select>
          <Select
            value={filterEvent}
            onChange={(e) => {
              setFilterEvent(e.target.value);
              setPage(0);
            }}
            size="sm"
            className="w-auto"
          >
            <option value="">{t('workflowLogs.eventFilter')}</option>
            <option value="issue_labeled">{t('workflowLogs.eventIssueLabel')}</option>
            <option value="issue_comment">{t('workflowLogs.eventIssueComment')}</option>
            <option value="security_audit">{t('workflowLogs.eventSecurityAudit')}</option>
          </Select>
        </div>

        {/* 初载骨架屏 */}
        {detailLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* 加载错误 */}
        {!detailLoading && detailError && (
          <ErrorAlert
            message={detailError || t('workflowLogs.loadRunsFailed')}
            onRetry={() => fetchRuns(true)}
            retryLabel={t('common.retry')}
          />
        )}

        {/* 空状态：区分「完全无记录」与「有筛选条件但结果为空」 */}
        {!detailLoading && !detailError && runs.length === 0 && (
          <EmptyState
            icon={<Clock className="h-10 w-10 text-zinc-300" />}
            title={hasFilters ? t('workflowLogs.filterEmpty') : t('repoDetail.noRuns')}
          />
        )}

        {/* 运行列表 */}
        {!detailLoading && runs.length > 0 && (
          <div className="space-y-2">
            {runs.map((run) => {
              const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const eventLabel = EVENT_LABELS[run.event] || run.event;
              return (
                <button
                  key={run.id}
                  onClick={() => router.push(`/dashboard/logs/run/${run.id}`)}
                  className="w-full text-left"
                >
                  <ProCard
                    className="bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all cursor-pointer"
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
                          <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                            {eventLabel}
                          </span>
                          {run.branch && (
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                              <GitBranch className="h-3 w-3" />
                              {run.branch}
                            </span>
                          )}
                          {run.prNumber && (
                            <span className="text-xs text-blue-500">PR #{run.prNumber}</span>
                          )}
                          {run.action && (
                            <span className="text-[10px] text-zinc-400">{run.action}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {run.commitSha && (
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-mono">
                              <GitCommitHorizontal className="h-3 w-3" />
                              {shaShort(run.commitSha)}
                            </span>
                          )}
                          {run.triggeredBy && (
                            <span className="text-xs text-zinc-400">@{run.triggeredBy}</span>
                          )}
                          {run.duration != null && (
                            <span className="text-xs text-zinc-400">
                              {formatDuration(run.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-zinc-400 block">
                          {timeAgo(run.createdAt, t)}
                        </span>
                        <span className={`text-[10px] font-medium ${cfg.color}`}>{run.status}</span>
                      </div>
                    </div>
                  </ProCard>
                </button>
              );
            })}
          </div>
        )}

        {/* 分页 */}
        {!detailLoading && total > pageSize && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-zinc-500 hover:text-zinc-700"
            >
              ← {t('dashboard.prev')}
            </Button>
            <span className="text-zinc-400 text-xs">
              {page + 1} / {Math.ceil(total / pageSize)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
              className="text-zinc-500 hover:text-zinc-700"
            >
              {t('dashboard.next')} →
            </Button>
          </div>
        )}
      </div>
    );
  }

  // === 列表视图 ===
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-400 text-xs">
          {repos.length > 0 && (
            <span>
              {repos.length} {t('home.repositories')}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={`h-3.5 w-3.5 ${listRefreshing ? 'animate-spin' : ''}`} />}
          onClick={() => fetchRepos(true)}
          className="text-zinc-500 hover:text-zinc-700"
        >
          {t('dashboard.refresh')}
        </Button>
      </div>

      {/* 初载骨架屏 */}
      {listLoading && repos.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* 加载错误 */}
      {!listLoading && listError && (
        <ErrorAlert
          message={listError || t('workflowLogs.loadRunsFailed')}
          onRetry={() => fetchRepos(true)}
          retryLabel={t('common.retry')}
        />
      )}

      {/* 空状态 */}
      {!listLoading && !listError && repos.length === 0 && (
        <EmptyState
          icon={<Clock className="h-10 w-10 text-zinc-300" />}
          title={t('repoDetail.noRuns')}
        />
      )}

      {/* 仓库列表 */}
      {!listLoading && repos.length > 0 && (
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
                  className="bg-white border-zinc-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                  padding="p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                      <FolderGit2 className="h-5 w-5 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-900 font-medium text-sm truncate">
                          {repoName}
                        </span>
                        <span className="text-zinc-400 text-xs truncate">{owner}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-zinc-500 text-xs">
                          {repo.totalRuns} {t('repoDetail.totalRuns')}
                        </span>
                        {repo.latest.branch && (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <GitBranch className="h-3 w-3" />
                            {repo.latest.branch}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                          {eventLabel}
                        </span>
                      </div>
                    </div>
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
                        <span className="text-[10px] text-zinc-400 block mt-0.5">
                          {timeAgo(repo.latest.createdAt, t)}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-300 group-hover:text-blue-500 transition-colors" />
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
