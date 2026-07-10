'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ProCard } from '@/components/ui/ProCard';
import { StatusCard } from '@/components/ui/StatusCard';
import {
  RefreshCw,
  Plus,
  Trash2,
  Server,
  Play,
  Square,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  X,
  Circle,
} from 'lucide-react';

interface RunnerItem {
  id: number;
  name: string;
  scopeType: string;
  scopeTarget: string;
  labels: string[];
  status: string;
  runnerId: number | null;
  pid: number | null;
  lastError: string | null;
  installationId: number | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  idle: { color: 'text-zinc-500', bg: 'bg-zinc-100', label: 'runner.statusIdle' },
  running: { color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'runner.statusRunning' },
  stopped: { color: 'text-zinc-400', bg: 'bg-zinc-50', label: 'runner.statusStopped' },
  error: { color: 'text-red-600', bg: 'bg-red-100', label: 'runner.statusError' },
  offline: { color: 'text-amber-600', bg: 'bg-amber-100', label: 'runner.statusOffline' },
};

export default function RunnersPage() {
  const { t } = useTranslation();
  const [runners, setRunners] = useState<RunnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // 新建 Runner 表单状态
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScopeType, setNewScopeType] = useState<'repo' | 'org'>('repo');
  const [newScopeTarget, setNewScopeTarget] = useState('');
  const [newLabels, setNewLabels] = useState('self-hosted,linux,x64');

  // 仓库列表（从 GitHub API 获取）
  const [repoOptions, setRepoOptions] = useState<string[]>([]);
  const [orgOptions, setOrgOptions] = useState<string[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  const fetchRunners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/runners');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRunners(data.runners || []);
    } catch {
      setError(t('runner.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRunners();
  }, [fetchRunners]);

  const fetchRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const res = await fetch('/api/github/repos');
      if (!res.ok) return;
      const data = await res.json();
      const repos: string[] = [];
      const orgs: string[] = [];
      for (const r of [...(data.personal || []), ...(data.organization || [])]) {
        if (r.full_name && !repos.includes(r.full_name)) {
          repos.push(r.full_name);
        }
      }
      for (const inst of data.installations || []) {
        if (
          inst.accountLogin &&
          inst.accountType === 'Organization' &&
          !orgs.includes(inst.accountLogin)
        ) {
          orgs.push(inst.accountLogin);
        }
      }
      setRepoOptions(repos);
      setOrgOptions(orgs);
    } catch {
      // 静默失败，用户可手动输入
    } finally {
      setReposLoading(false);
    }
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newScopeTarget.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/runners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          scopeType: newScopeType,
          scopeTarget: newScopeTarget.trim(),
          labels: newLabels
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setNewName('');
      setNewScopeTarget('');
      setNewLabels('self-hosted,linux,x64');
      setShowForm(false);
      await fetchRunners();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('runner.failedToCreate'));
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (runnerId: number, action: string) => {
    setActionLoading(runnerId);
    setError(null);
    try {
      const res = await fetch('/api/admin/runners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, runnerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await fetchRunners();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('runner.actionFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (runnerId: number, name: string) => {
    if (!window.confirm(t('runner.deleteConfirm', { name }))) {
      return;
    }
    setActionLoading(runnerId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/runners?id=${runnerId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await fetchRunners();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('runner.failedToDelete'));
    } finally {
      setActionLoading(null);
    }
  };

  const timeAgo = (dateStr: string) => {
    // eslint-disable-next-line react-hooks/purity -- Date.now() is acceptable for display-only time formatting
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return t('common.secondsAgo', { count: String(diff) });
    if (diff < 3600) return t('common.minutesAgo', { count: String(Math.floor(diff / 60)) });
    if (diff < 86400) return t('common.hoursAgo', { count: String(Math.floor(diff / 3600)) });
    return t('common.daysAgo', { count: String(Math.floor(diff / 86400)) });
  };

  const getStatusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.offline;

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
            <Server className="h-5 w-5 text-zinc-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">{t('runner.title')}</h2>
            <p className="text-zinc-500 text-xs">{t('runner.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchRunners}
            className="text-zinc-500 hover:text-zinc-700"
          >
            {t('dashboard.refresh')}
          </Button>
          <Button
            variant="default"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setShowForm(!showForm);
              if (!showForm) fetchRepos();
            }}
          >
            {t('runner.addButton')}
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <ProCard className="bg-red-50 border-red-200">
          <StatusCard
            icon={<X className="h-4 w-4" />}
            title={t('dashboard.error')}
            status={error}
            statusType="error"
          />
        </ProCard>
      )}

      {/* 新建 Runner 表单 */}
      {showForm && (
        <ProCard title={t('runner.createTitle')}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('runner.nameLabel')}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('runner.namePlaceholder')}
                size="sm"
              />
              <div className="w-full">
                <label className="block text-sm font-medium mb-2 text-zinc-700">
                  {t('runner.scopeTypeLabel')}
                </label>
                <Select
                  value={newScopeType}
                  onChange={(e) => {
                    setNewScopeType(e.target.value as 'repo' | 'org');
                    setNewScopeTarget('');
                  }}
                  size="sm"
                >
                  <option value="repo">{t('runner.scopeRepo')}</option>
                  <option value="org">{t('runner.scopeOrg')}</option>
                </Select>
              </div>
            </div>
            {newScopeType === 'repo' ? (
              <div className="w-full">
                <label className="block text-sm font-medium mb-2 text-zinc-700">
                  {t('runner.scopeRepoLabel')}
                </label>
                <Select
                  value={newScopeTarget}
                  onChange={(e) => setNewScopeTarget(e.target.value)}
                  size="sm"
                >
                  <option value="">
                    {reposLoading ? t('runner.loadingRepos') : t('runner.selectRepo')}
                  </option>
                  {repoOptions.map((repo) => (
                    <option key={repo} value={repo}>
                      {repo}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="w-full">
                <label className="block text-sm font-medium mb-2 text-zinc-700">
                  {t('runner.scopeOrgLabel')}
                </label>
                <Select
                  value={newScopeTarget}
                  onChange={(e) => setNewScopeTarget(e.target.value)}
                  size="sm"
                >
                  <option value="">
                    {reposLoading ? t('runner.loadingRepos') : t('runner.selectOrg')}
                  </option>
                  {orgOptions.map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Input
              label={t('runner.labelsLabel')}
              type="text"
              value={newLabels}
              onChange={(e) => setNewLabels(e.target.value)}
              placeholder={t('runner.labelsPlaceholder')}
              size="sm"
            />
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleCreate}
                loading={creating}
                disabled={!newName.trim() || !newScopeTarget.trim()}
              >
                {t('runner.createButton')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </ProCard>
      )}

      {/* Runner 列表 */}
      <ProCard title={`${t('runner.existingRunners')} (${runners.length})`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-500" />
          </div>
        ) : runners.length === 0 ? (
          <div className="text-center py-8">
            <Server className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">{t('runner.noRunners')}</p>
            <p className="text-zinc-400 text-xs mt-1">{t('runner.noRunnersHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {runners.map((runner) => {
              const statusCfg = getStatusConfig(runner.status);
              const isBusy = actionLoading === runner.id;
              return (
                <div key={runner.id} className="rounded-xl border border-zinc-200 bg-white p-5">
                  {/* 头部：名称 + 状态 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${statusCfg.bg}`}
                      >
                        <Circle
                          className={`h-3.5 w-3.5 ${statusCfg.color} ${runner.status === 'running' ? 'animate-pulse' : ''}`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{runner.name}</p>
                        <p className="text-xs text-zinc-400 font-mono">
                          {runner.scopeType === 'org' ? 'org' : 'repo'}:{runner.scopeTarget}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}
                    >
                      {t(statusCfg.label)}
                    </span>
                  </div>

                  {/* 详情信息 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-zinc-500 mb-3">
                    <div>
                      <span className="text-zinc-400">{t('runner.labels')}: </span>
                      <span className="font-mono">{runner.labels.join(', ')}</span>
                    </div>
                    {runner.runnerId && (
                      <div>
                        <span className="text-zinc-400">Runner ID: </span>
                        <span className="font-mono">{runner.runnerId}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-zinc-400">{t('runner.createdAt')}: </span>
                      <span>{timeAgo(runner.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">{t('runner.updatedAt')}: </span>
                      <span>{timeAgo(runner.updatedAt)}</span>
                    </div>
                  </div>

                  {/* 错误信息 */}
                  {runner.lastError && (
                    <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3">
                      <p className="text-xs font-medium text-red-800 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t('runner.lastError')}
                      </p>
                      <p className="text-xs text-red-700 mt-1 font-mono break-all">
                        {runner.lastError}
                      </p>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                    {runner.status !== 'running' && (
                      <Button
                        variant="default"
                        size="sm"
                        icon={<Play className="h-3.5 w-3.5" />}
                        onClick={() => handleAction(runner.id, 'start')}
                        loading={isBusy}
                        disabled={isBusy}
                      >
                        {t('runner.start')}
                      </Button>
                    )}
                    {runner.status === 'running' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Square className="h-3.5 w-3.5" />}
                        onClick={() => handleAction(runner.id, 'stop')}
                        loading={isBusy}
                        disabled={isBusy}
                        className="text-zinc-500 hover:text-red-600"
                      >
                        {t('runner.stop')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />}
                      onClick={() => handleAction(runner.id, 'refresh')}
                      loading={isBusy}
                      disabled={isBusy}
                      className="text-zinc-500 hover:text-zinc-700"
                    >
                      {t('runner.refreshStatus')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      onClick={() => handleAction(runner.id, 'reregister')}
                      loading={isBusy}
                      disabled={isBusy}
                      className="text-zinc-500 hover:text-amber-600"
                    >
                      {t('runner.reregister')}
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => handleDelete(runner.id, runner.name)}
                      loading={isBusy}
                      disabled={isBusy}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      {t('runner.delete')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ProCard>

      {/* 使用说明 */}
      <ProCard title={t('runner.usageTitle')}>
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs font-bold text-blue-800 mb-2">{t('runner.howItWorksTitle')}</p>
            <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside">
              <li>{t('runner.step1')}</li>
              <li>{t('runner.step2')}</li>
              <li>{t('runner.step3')}</li>
              <li>{t('runner.step4')}</li>
            </ol>
          </div>

          <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4">
            <p className="text-xs font-bold text-zinc-700 mb-2">{t('runner.scopesTitle')}</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-700">{t('runner.repoScopeTitle')}</p>
                  <p className="text-xs text-zinc-500">{t('runner.repoScopeDesc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-700">{t('runner.orgScopeTitle')}</p>
                  <p className="text-xs text-zinc-500">{t('runner.orgScopeDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProCard>
    </div>
  );
}
