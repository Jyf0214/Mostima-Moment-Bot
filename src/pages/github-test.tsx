'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { PageContainer } from '@/components/ui/PageContainer';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  detail?: string;
}

const STATUS_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
} as const;

export default function GitHubTestPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTests = useCallback(async () => {
    setRunning(true);
    setError(null);
    // 重跑时保留旧结果，新结果返回后整体替换；期间旧数据半透明展示

    try {
      const response = await fetch('/api/github/test');
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('githubTest.testFailed'));
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    runTests();
  }, [runTests]);

  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageContainer maxWidth="4xl" padding="default">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => router.push('/dashboard')}
            >
              {t('githubTest.backToDashboard')}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">{t('githubTest.title')}</h1>
              <p className="mt-1 text-sm text-zinc-500">{t('githubTest.subtitle')}</p>
            </div>
            <Button
              variant="default"
              size="sm"
              icon={<RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />}
              onClick={runTests}
              loading={running}
            >
              {t('githubTest.rerunTests')}
            </Button>
          </div>

          {/* 初次检测期间（还没有任何结果）显示大号检测中状态；
              重跑时保留旧结果，仅按钮进入 loading、结果区半透明 */}
          {(loading || running) && results.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-400 border-t-transparent" />
                <p className="text-sm text-zinc-500">{t('githubTest.runningTests')}</p>
              </div>
            </div>
          )}

          {error && (
            <ErrorAlert
              message={error}
              title={t('dashboard.error')}
              onRetry={() => void runTests()}
              retryLabel={t('common.retry')}
            />
          )}

          {results.length > 0 && (
            <>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700">
                    {t('githubTest.passCount', { count: String(passCount) })}
                  </span>
                </div>
                {failCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">
                      {t('githubTest.failCount', { count: String(failCount) })}
                    </span>
                  </div>
                )}
                {warnCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">
                      {t('githubTest.warnCount', { count: String(warnCount) })}
                    </span>
                  </div>
                )}
              </div>

              <ProCard
                title={t('githubTest.testDetails')}
                className={running ? 'opacity-60 transition-opacity' : 'transition-opacity'}
              >
                <div className="flex flex-col gap-2">
                  {results.map((result) => (
                    <div
                      key={result.name}
                      className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-white p-3.5 transition-colors hover:bg-zinc-50"
                    >
                      <div className="mt-0.5 shrink-0">{STATUS_ICON[result.status]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-800">{result.name}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500">{result.message}</p>
                        {result.detail && (
                          <p className="mt-1 break-all font-mono text-xs text-zinc-400">
                            {result.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ProCard>

              {failCount === 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700">
                      {t('githubTest.allPassed')}
                    </p>
                    <p className="text-xs text-emerald-600">{t('githubTest.allPassedDesc')}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
