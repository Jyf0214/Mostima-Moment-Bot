'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X, Check, RefreshCw, Info, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusCard } from '@/components/ui/StatusCard';
import { PageContainer } from '@/components/ui/PageContainer';
import { ProCard } from '@/components/ui/ProCard';

interface EnvVar {
  key: string;
  description: string;
  generateHint: string;
}

interface EnvStatus {
  isConfigured: boolean;
  missing: EnvVar[];
  present: EnvVar[];
  message: string;
}

const STEPS_KEYS = ['envError.step1', 'envError.step2', 'envError.step3'] as const;

export default function EnvErrorPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkEnvStatus = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/env-check');
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setEnvStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('envError.checkFailed'));
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    checkEnvStatus();
  }, [checkEnvStatus]);

  const failCount = envStatus?.missing.length ?? 0;
  const passCount = envStatus?.present.length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <PageContainer maxWidth="4xl" padding="default">
        <div className="flex flex-col gap-6">
          {/* 标题区 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <ShieldAlert className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">{t('envError.title')}</h1>
                <p className="mt-1 text-sm text-zinc-500">{t('envError.description')}</p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              icon={<RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />}
              onClick={checkEnvStatus}
              loading={running}
            >
              {t('envError.retry')}
            </Button>
          </div>

          {/* 加载中 */}
          {loading && !running && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-400 border-t-transparent" />
                <p className="text-sm text-zinc-500">{t('envError.loading')}</p>
              </div>
            </div>
          )}

          {/* 错误 */}
          {error && (
            <ProCard>
              <StatusCard
                icon={<X className="h-4 w-4" />}
                title="Error"
                status={error}
                statusType="error"
              />
            </ProCard>
          )}

          {/* 检测结果 */}
          {envStatus && (
            <>
              {/* 统计卡片 */}
              <div className="flex gap-4">
                {failCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">
                      {t('envError.missingVars')} {failCount}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700">
                    {t('envError.presentVars')} {passCount}
                  </span>
                </div>
              </div>

              {/* 缺失的环境变量 */}
              {envStatus.missing.length > 0 && (
                <ProCard
                  title={t('envError.missingVars')}
                  extra={
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                      {failCount}
                    </span>
                  }
                >
                  <div className="flex flex-col gap-3">
                    {envStatus.missing.map((envVar) => (
                      <div key={envVar.key} className="flex flex-col gap-2">
                        <StatusCard
                          icon={<X className="h-4 w-4" />}
                          title={envVar.key}
                          status={envVar.description}
                          statusType="error"
                        />
                        <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                          <div className="flex-1">
                            <span className="mb-1 block text-xs font-semibold text-zinc-700">
                              {t('envError.howToGet')}:
                            </span>
                            <code className="block break-all whitespace-pre-wrap rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100">
                              {envVar.generateHint}
                            </code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ProCard>
              )}

              {/* 已配置的环境变量 */}
              {envStatus.present.length > 0 && (
                <ProCard
                  title={t('envError.presentVars')}
                  extra={
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-medium text-white">
                      {passCount}
                    </span>
                  }
                >
                  <div className="flex flex-col gap-2">
                    {envStatus.present.map((envVar) => (
                      <StatusCard
                        key={envVar.key}
                        icon={<Check className="h-4 w-4" />}
                        title={envVar.key}
                        status={envVar.description}
                        statusType="success"
                      />
                    ))}
                  </div>
                </ProCard>
              )}

              {/* 全部配置完成 */}
              {failCount === 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <Check className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700">{t('api.envConfigured')}</p>
                    <p className="text-xs text-emerald-600">{envStatus.message}</p>
                  </div>
                </div>
              )}

              {/* 解决方法 */}
              {failCount > 0 && (
                <ProCard title={t('envError.solution')}>
                  <div className="flex flex-col gap-3">
                    {STEPS_KEYS.map((key, index) => (
                      <div key={key} className="flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500">
                          <span className="text-xs font-bold text-white">{index + 1}</span>
                        </div>
                        <p className="text-sm text-zinc-700">{t(key)}</p>
                      </div>
                    ))}
                    <p className="ml-9 text-xs text-zinc-500">{t('envError.step4')}</p>
                  </div>
                </ProCard>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
