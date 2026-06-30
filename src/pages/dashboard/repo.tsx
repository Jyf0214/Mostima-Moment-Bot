'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import { PageContainer } from '@/components/ui/PageContainer';
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
  const [repoName, setRepoName] = useState('');
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRepoName(params.get('name') || '');
  }, []);

  const loadRules = useCallback(async () => {
    if (!repoName) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/ci/trigger-rules?repo=${encodeURIComponent(repoName)}`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
      } else {
        setLoadError(t('repoDetail.loadFailed'));
      }
    } catch {
      setLoadError(t('repoDetail.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [repoName, t]);

  const loadRuns = useCallback(async () => {
    if (!repoName) return;
    try {
      const res = await fetch(
        `/api/ci/runs?repo=${encodeURIComponent(repoName)}&limit=1&botOnly=true`
      );
      if (res.ok) {
        const data = await res.json();
        setRunsTotal(data.total || 0);
      }
    } catch {
      // 运行日志加载失败不阻断主流程
    }
  }, [repoName]);

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
      const res = await fetch('/api/ci/trigger-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoName, rules }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveMsg(t('repoDetail.saveSuccess'));
      } else {
        setSaveMsg(data.error || t('repoDetail.saveFailed'));
      }
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : t('repoDetail.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    try {
      // 先获取默认规则
      const getRes = await fetch(`/api/ci/trigger-rules?repo=${encodeURIComponent(repoName)}`);
      if (!getRes.ok) {
        setSaveMsg(t('repoDetail.saveFailed'));
        return;
      }
      const data = await getRes.json();
      // 保存默认规则（POST 成功后才更新 UI，避免竞态）
      const postRes = await fetch('/api/ci/trigger-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoName, rules: data.rules }),
      });
      if (postRes.ok) {
        setRules(data.rules);
        setSaveMsg(t('repoDetail.resetSuccess'));
      } else {
        setSaveMsg(t('repoDetail.saveFailed'));
      }
    } catch {
      setSaveMsg(t('repoDetail.saveFailed'));
    }
  };

  // 按类别分组规则
  const cicdRules = rules.filter((r) => r.id === 'ci-verification' || r.id === 'build-check');
  const auditRules = rules.filter((r) => r.id === 'security-audit');
  const autoFixRules = rules.filter((r) => r.id === 'auto-fix');

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageContainer maxWidth="5xl" padding="default">
        <div className="py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => (window.location.href = '/dashboard')}
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
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {loadError}
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
                  <span className="text-zinc-400 text-xs">
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
                          <span className="text-[10px] text-zinc-300 bg-white/5 rounded px-1.5 py-0.5">
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
                  <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-sm">Webhook URL</span>
                    </div>
                    <code className="text-zinc-500 text-xs font-mono bg-zinc-100 px-2 py-1 rounded">
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/api/webhook/github`
                        : '/api/webhook/github'}
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
                    <div className="flex flex-wrap gap-1">
                      {[
                        'push',
                        'pull_request',
                        'issue_comment',
                        'workflow_run',
                        'installation',
                      ].map((event) => (
                        <span
                          key={event}
                          className="text-[10px] text-purple-600 bg-purple-50 rounded px-1.5 py-0.5"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </ProCard>

              {/* 运行日志 */}
              <ProCard className="bg-white border-zinc-200 mb-6" padding="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-cyan-50 flex items-center justify-center">
                      <ScrollText className="h-4 w-4 text-cyan-500" />
                    </div>
                    <div>
                      <h3 className="text-zinc-900 font-semibold">{t('repoDetail.runLogs')}</h3>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {runsTotal > 0
                          ? `${runsTotal} ${t('repoDetail.totalRuns')}`
                          : t('repoDetail.noRuns')}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/dashboard?logsRepo=${encodeURIComponent(repoName)}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-50 px-4 py-2 text-sm text-cyan-500 hover:bg-cyan-100 transition-colors"
                  >
                    {t('repoDetail.viewLogs')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </ProCard>

              {/* 操作栏 */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={resetToDefaults}
                  className="text-zinc-500 hover:text-zinc-900"
                >
                  {t('repoDetail.resetDefaults')}
                </Button>

                <div className="flex items-center gap-3">
                  {saveMsg && (
                    <span
                      className={`text-xs ${
                        saveMsg === t('repoDetail.saveSuccess') ||
                        saveMsg === t('repoDetail.resetSuccess')
                          ? 'text-emerald-500'
                          : 'text-red-400'
                      }`}
                    >
                      {saveMsg}
                    </span>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Save className="h-3.5 w-3.5" />}
                    onClick={saveRules}
                    loading={saving}
                  >
                    {t('repoDetail.saveConfig')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
