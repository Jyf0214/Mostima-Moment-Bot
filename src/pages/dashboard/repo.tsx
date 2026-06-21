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
  Clock,
  ScrollText,
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
  const [repoId, setRepoId] = useState('');
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRepoName(params.get('name') || '');
    setRepoId(params.get('repoId') || '');
  }, []);

  const loadRules = useCallback(async () => {
    if (!repoName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ci/trigger-rules?repo=${encodeURIComponent(repoName)}`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
      }
    } catch {
      // 使用默认规则
    } finally {
      setLoading(false);
    }
  }, [repoName]);

  const loadRuns = useCallback(async () => {
    if (!repoName) return;
    try {
      const res = await fetch(`/api/ci/runs?repo=${encodeURIComponent(repoName)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        setRunsTotal(data.total || 0);
      }
    } catch {
      // 静默失败
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
      const res = await fetch(`/api/ci/trigger-rules?repo=${encodeURIComponent(repoName)}`);
      if (res.ok) {
        const data = await res.json();
        // 删除自定义配置（通过保存空标记）
        await fetch('/api/ci/trigger-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: repoName, rules: data.rules }),
        });
        setRules(data.rules);
        setSaveMsg(t('repoDetail.resetSuccess'));
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <PageContainer maxWidth="5xl" padding="default">
        <div className="py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => (window.location.href = '/dashboard')}
              className="text-white/50 hover:text-white"
            >
              {t('repoDetail.back')}
            </Button>
          </div>

          {/* Repo Info */}
          <ProCard className="bg-white/5 backdrop-blur-xl border-white/10 mb-6" padding="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">{repoName || 'Repository'}</h1>
                  <p className="text-white/40 text-xs">ID: {repoId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://github.com/${repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </ProCard>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* CI/CD 配置 */}
              <ProCard className="bg-white/5 backdrop-blur-xl border-white/10 mb-6" padding="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <h3 className="text-white font-semibold">{t('repoDetail.cicdConfig')}</h3>
                  </div>
                  <span className="text-white/30 text-xs">
                    {enabledCount}/{rules.length} {t('repoDetail.activeRules')}
                  </span>
                </div>

                <div className="space-y-3">
                  {cicdRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleRule(rule.id)}
                          className={`relative h-5 w-9 rounded-full transition-colors ${
                            rule.enabled ? 'bg-purple-500' : 'bg-white/10'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                              rule.enabled ? 'left-4.5 translate-x-0' : 'left-0.5'
                            }`}
                            style={{ left: rule.enabled ? '18px' : '2px' }}
                          />
                        </button>
                        <div>
                          <p className="text-white text-sm font-medium">{rule.name}</p>
                          <p className="text-white/30 text-xs">
                            {rule.events.join(' / ')}{' '}
                            {rule.branches && `→ ${rule.branches.include.join(', ')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {rule.enabled ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-white/20" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 检查步骤 */}
                <div className="mt-4 border-t border-white/5 pt-4">
                  <p className="text-white/40 text-xs mb-2">{t('repoDetail.checkSteps')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cicdRules
                      .filter((r) => r.enabled)
                      .flatMap((r) => r.checks)
                      .map((check, i) => (
                        <span
                          key={`${check.name}-${i}`}
                          className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] text-purple-300"
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
              <ProCard className="bg-white/5 backdrop-blur-xl border-white/10 mb-6" padding="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="h-4 w-4 text-blue-400" />
                  <h3 className="text-white font-semibold">{t('repoDetail.triggerRules')}</h3>
                </div>

                <div className="space-y-3">
                  {auditRules.concat(autoFixRules).map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleRule(rule.id)}
                          className={`relative h-5 w-9 rounded-full transition-colors ${
                            rule.enabled ? 'bg-purple-500' : 'bg-white/10'
                          }`}
                        >
                          <span
                            className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                            style={{ left: rule.enabled ? '18px' : '2px' }}
                          />
                        </button>
                        <div>
                          <p className="text-white text-sm font-medium">{rule.name}</p>
                          <p className="text-white/30 text-xs">
                            {rule.events.join(' / ')}
                            {rule.actions && ` → ${rule.actions.join(', ')}`}
                            {rule.labels && ` [${rule.labels.join(', ')}]`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {rule.requiredAuthorAssociation && (
                          <span className="text-[10px] text-white/20 bg-white/5 rounded px-1.5 py-0.5">
                            {rule.requiredAuthorAssociation.join(' | ')}
                          </span>
                        )}
                        {rule.enabled ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-white/20" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ProCard>

              {/* Webhook 设置 */}
              <ProCard className="bg-white/5 backdrop-blur-xl border-white/10 mb-6" padding="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-white font-semibold">{t('repoDetail.webhookConfig')}</h3>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 text-sm">Webhook URL</span>
                    </div>
                    <code className="text-white/40 text-xs font-mono bg-white/5 px-2 py-1 rounded">
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/api/webhook/github`
                        : '/api/webhook/github'}
                    </code>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <span className="text-white/50 text-sm">{t('repoDetail.signatureVerify')}</span>
                    <span className="flex items-center gap-1 text-emerald-400 text-xs">
                      <CheckCircle2 className="h-3 w-3" />
                      HMAC-SHA256
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <span className="text-white/50 text-sm">{t('repoDetail.acceptedEvents')}</span>
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
                          className="text-[10px] text-purple-300 bg-purple-500/10 rounded px-1.5 py-0.5"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </ProCard>

              {/* 运行日志 */}
              <ProCard className="bg-white/5 backdrop-blur-xl border-white/10 mb-6" padding="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <ScrollText className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{t('repoDetail.runLogs')}</h3>
                      <p className="text-white/40 text-xs mt-0.5">
                        {runsTotal > 0
                          ? `${runsTotal} ${t('repoDetail.totalRuns')}`
                          : t('repoDetail.noRuns')}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/dashboard/logs/${encodeURIComponent(repoName)}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-2 text-sm text-cyan-400 hover:bg-cyan-500/20 transition-colors"
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
                  className="text-white/40 hover:text-white"
                >
                  {t('repoDetail.resetDefaults')}
                </Button>

                <div className="flex items-center gap-3">
                  {saveMsg && (
                    <span
                      className={`text-xs ${
                        saveMsg === t('repoDetail.saveSuccess') ||
                        saveMsg === t('repoDetail.resetSuccess')
                          ? 'text-emerald-400'
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
