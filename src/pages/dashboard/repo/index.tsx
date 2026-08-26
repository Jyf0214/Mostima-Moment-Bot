'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Shield,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  Zap,
  ScrollText,
  AlertTriangle,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { apiJson, apiErrorMessage, isUnauthorized, redirectToHome } from '@/lib/api-client';

interface TriggerRule {
  id: string;
  name: string;
  enabled: boolean;
  events: string[];
  branches?: { include: string[]; exclude?: string[] };
  actions?: string[];
  labels?: string[];
  commentPattern?: string;
  requiredAuthorAssociation?: string[];
  concurrency?: { group: string; cancelInProgress: boolean };
  checks: Array<{ name: string; type: string; command?: string }>;
}

export default function RepoDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [repoName, setRepoName] = useState('');
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsError, setRunsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveMsgType, setSaveMsgType] = useState<'success' | 'error'>('success');
  const [loadError, setLoadError] = useState<string | null>(null);
  // 已保存规则的基线快照，用于判断「有未保存的更改」；
  // 渲染期需要读取且变更需触发重渲染，因此用 state 而非 ref
  const [savedRulesJson, setSavedRulesJson] = useState<string>('[]');
  // webhook 完整地址依赖 window.location.origin，
  // 只能在客户端挂载后写入 state，避免 SSR/客户端渲染不一致
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const params = new URLSearchParams(window.location.search);
    setRepoName(params.get('name') || '');
  }, [router.isReady]);

  const loadRules = useCallback(async () => {
    if (!repoName) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiJson<{ rules: TriggerRule[] }>(
        `/api/ci/trigger-rules?repo=${encodeURIComponent(repoName)}`
      );
      setRules(data.rules);
      setSavedRulesJson(JSON.stringify(data.rules));
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      logger.error('Failed to load trigger rules:', err);
      setLoadError(t('repoDetail.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [repoName, t]);

  const loadRuns = useCallback(
    async (silent = false) => {
      if (!repoName) return;
      if (!silent) setRunsError(false);
      try {
        const data = await apiJson<{ total?: number }>(
          `/api/ci/runs?repo=${encodeURIComponent(repoName)}&limit=1&botOnly=true`
        );
        setRunsTotal(data.total || 0);
      } catch (err) {
        if (isUnauthorized(err)) {
          redirectToHome();
          return;
        }
        // 运行数加载失败不再静默伪装成「暂无运行」
        logger.error('Failed to load run count:', err);
        setRunsError(true);
      }
    },
    [repoName]
  );

  useEffect(() => {
    loadRules();
    loadRuns();
  }, [loadRules, loadRuns]);

  const toggleRule = (ruleId: string) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)));
  };

  const saveRules = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const data = await apiJson<{ success?: boolean; error?: string }>('/api/ci/trigger-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoName, rules }),
      });
      if (data.success) {
        setSavedRulesJson(JSON.stringify(rules));
        setSaveMsgType('success');
        setSaveMsg(t('repoDetail.saveSuccess'));
      } else {
        setSaveMsgType('error');
        setSaveMsg(data.error || t('repoDetail.saveFailed'));
      }
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setSaveMsgType('error');
      // 透传服务端具体原因，不能只给通用"保存失败"
      setSaveMsg(apiErrorMessage(err, t('repoDetail.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    // 恢复默认会覆盖自定义规则，必须二次确认
    if (!window.confirm(t('repoDetail.resetConfirm'))) {
      return;
    }
    setResetting(true);
    setSaveMsg(null);
    try {
      const data = await apiJson<{ rules: TriggerRule[] }>(
        `/api/ci/trigger-rules?repo=${encodeURIComponent(repoName)}`
      );
      await apiJson('/api/ci/trigger-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoName, rules: data.rules }),
      });
      setRules(data.rules);
      setSavedRulesJson(JSON.stringify(data.rules));
      setSaveMsgType('success');
      setSaveMsg(t('repoDetail.resetSuccess'));
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setSaveMsgType('error');
      // 透传服务端具体原因，不能只给通用"保存失败"
      setSaveMsg(apiErrorMessage(err, t('repoDetail.saveFailed')));
    } finally {
      setResetting(false);
    }
  };

  const handleBack = () => {
    router.push({ pathname: '/dashboard', query: { page: 'repos' } }, undefined, {
      shallow: true,
    });
  };

  // 按类别分组规则
  const cicdRules = rules.filter((r) => r.id === 'ci-verification' || r.id === 'build-check');
  const auditRules = rules.filter((r) => r.id === 'security-audit');
  const autoFixRules = rules.filter((r) => r.id === 'auto-fix');

  const enabledCount = rules.filter((r) => r.enabled).length;
  const hasUnsavedChanges = JSON.stringify(rules) !== savedRulesJson;

  return (
    <DashboardLayout activePage="repos">
      <div className="py-2">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={handleBack}
            className="text-zinc-500 hover:text-zinc-900"
          >
            {t('repoDetail.back')}
          </Button>
        </div>

        {/* Repo Info */}
        <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <GitBranch className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-zinc-900">
                  {repoName || t('sidebar.repos')}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`https://github.com/${repoName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </ProCard>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-500" />
          </div>
        ) : loadError ? (
          <div className="space-y-4 mb-6">
            <ErrorAlert
              message={loadError}
              onRetry={() => void loadRules()}
              retryLabel={t('common.retry')}
            />
          </div>
        ) : (
          <>
            {/* CI/CD 配置 */}
            <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <h3 className="text-zinc-900 font-semibold">{t('repoDetail.cicdConfig')}</h3>
                </div>
                <span className="text-zinc-400 text-xs flex items-center gap-2">
                  {hasUnsavedChanges && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {t('repoDetail.unsavedChanges')}
                    </span>
                  )}
                  {enabledCount}/{rules.length} {t('repoDetail.activeRules')}
                </span>
              </div>

              <div className="space-y-3">
                {cicdRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        role="switch"
                        aria-checked={rule.enabled}
                        aria-label={rule.name}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          rule.enabled ? 'bg-purple-500' : 'bg-zinc-100'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            rule.enabled ? 'left-[18px] translate-x-0' : 'left-[2px]'
                          }`}
                        />
                      </button>
                      <div>
                        <p className="text-zinc-900 text-sm font-medium">{rule.name}</p>
                        <p className="text-zinc-400 text-xs">
                          {rule.events.join(' / ')}{' '}
                          {rule.branches && `→ ${rule.branches.include.join(', ')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {rule.enabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-zinc-300" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 检查步骤 */}
              <div className="mt-4 border-t border-white/5 pt-4">
                <p className="text-zinc-500 text-xs mb-2">{t('repoDetail.checkSteps')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cicdRules
                    .filter((r) => r.enabled)
                    .flatMap((r) => r.checks)
                    .map((check, i) => (
                      <span
                        key={`${check.name}-${i}`}
                        className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[10px] text-purple-600"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            check.type === 'test'
                              ? 'bg-emerald-400'
                              : check.type === 'lint'
                                ? 'bg-amber-400'
                                : check.type === 'typecheck'
                                  ? 'bg-blue-400'
                                  : 'bg-purple-400'
                          }`}
                        />
                        {check.name}
                      </span>
                    ))}
                </div>
              </div>
            </ProCard>

            {/* 触发规则 */}
            <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="h-4 w-4 text-blue-500" />
                <h3 className="text-zinc-900 font-semibold">{t('repoDetail.triggerRules')}</h3>
              </div>

              <div className="space-y-3">
                {auditRules.concat(autoFixRules).map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        role="switch"
                        aria-checked={rule.enabled}
                        aria-label={rule.name}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          rule.enabled ? 'bg-purple-500' : 'bg-zinc-100'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            rule.enabled ? 'left-[18px] translate-x-0' : 'left-[2px]'
                          }`}
                        />
                      </button>
                      <div>
                        <p className="text-zinc-900 text-sm font-medium">{rule.name}</p>
                        <p className="text-zinc-400 text-xs">
                          {rule.events.join(' / ')}
                          {rule.actions && ` → ${rule.actions.join(', ')}`}
                          {rule.labels && ` [${rule.labels.join(', ')}]`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {rule.requiredAuthorAssociation && (
                        <span className="text-[10px] text-zinc-300 rounded px-1.5 py-0.5">
                          {rule.requiredAuthorAssociation.join(' | ')}
                        </span>
                      )}
                      {rule.enabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-zinc-300" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ProCard>

            {/* Webhook 设置 */}
            <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-emerald-500" />
                <h3 className="text-zinc-900 font-semibold">{t('repoDetail.webhookConfig')}</h3>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-zinc-500 text-sm">Webhook URL</span>
                  </div>
                  <code className="text-zinc-500 text-xs font-mono bg-zinc-100 px-2 py-1 rounded break-all text-right">
                    {origin ? `${origin}/api/webhook/github` : '/api/webhook/github'}
                  </code>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
                  <span className="text-zinc-500 text-sm">{t('repoDetail.signatureVerify')}</span>
                  <span className="flex items-center gap-1 text-emerald-500 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    HMAC-SHA256
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
                  <span className="text-zinc-500 text-sm">{t('repoDetail.acceptedEvents')}</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {['push', 'pull_request', 'issue_comment', 'workflow_run', 'installation'].map(
                      (event) => (
                        <span
                          key={event}
                          className="text-[10px] text-purple-600 bg-purple-50 rounded px-1.5 py-0.5"
                        >
                          {event}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </ProCard>

            {/* 运行日志 */}
            <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                    <ScrollText className="h-4 w-4 text-cyan-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-zinc-900 font-semibold">{t('repoDetail.runLogs')}</h3>
                    <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-2">
                      {!runsError && runsTotal > 0 && (
                        <span>
                          {runsTotal} {t('repoDetail.totalRuns')}
                        </span>
                      )}
                      {!runsError && runsTotal === 0 && t('repoDetail.noRuns')}
                      {runsError && (
                        <>
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span className="text-amber-600">{t('repoDetail.loadFailed')}</span>
                          <button
                            onClick={() => void loadRuns()}
                            className="text-cyan-600 hover:text-cyan-700 underline underline-offset-2"
                          >
                            {t('common.retry')}
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  onClick={() =>
                    router.push({ pathname: '/dashboard', query: { page: 'logs', repo: repoName } })
                  }
                  className="shrink-0 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 border border-cyan-100"
                >
                  {t('repoDetail.viewLogs')}
                </Button>
              </div>
            </ProCard>

            {/* 操作栏 */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} />}
                onClick={() => void resetToDefaults()}
                disabled={resetting || saving}
                loading={resetting}
                className="text-zinc-500 hover:text-zinc-900"
              >
                {t('repoDetail.resetDefaults')}
              </Button>

              <div className="flex items-center gap-3">
                {saveMsg && (
                  <span
                    className={`text-xs ${
                      saveMsgType === 'success' ? 'text-emerald-500' : 'text-red-400'
                    }`}
                  >
                    {saveMsg}
                  </span>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Save className="h-3.5 w-3.5" />}
                  onClick={() => void saveRules()}
                  loading={saving}
                  disabled={resetting}
                >
                  {t('repoDetail.saveConfig')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
