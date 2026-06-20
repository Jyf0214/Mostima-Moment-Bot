'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Check, RefreshCw, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);

  useEffect(() => {
    checkEnvStatus();
  }, []);

  const checkEnvStatus = async () => {
    try {
      const response = await fetch('/api/env-check');
      const data = await response.json();
      setEnvStatus(data);
    } catch (err) {
      console.error('Failed to check environment variables:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-400 border-t-transparent" />
          <p className="text-sm text-zinc-500">{t('envError.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-500 via-rose-500 to-purple-900 p-4">
      <PageContainer maxWidth="4xl" padding="default">
        <div className="flex flex-col items-center gap-6">
          {/* Warning Icon */}
          <div className="flex h-18 w-18 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-9 w-9 text-red-500" />
          </div>

          {/* Title */}
          <h2 className="text-center text-2xl font-bold text-zinc-900">{t('envError.title')}</h2>

          {/* Description */}
          <p className="max-w-md text-center text-sm text-zinc-500">{t('envError.description')}</p>

          {envStatus && (
            <div className="flex w-full flex-col gap-5">
              {/* Missing Variables */}
              {envStatus.missing.length > 0 && (
                <ProCard
                  title={t('envError.missingVars')}
                  extra={
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                      {envStatus.missing.length}
                    </span>
                  }
                >
                  <div className="flex flex-col gap-3">
                    {envStatus.missing.map((envVar) => (
                      <StatusCard
                        key={envVar.key}
                        icon={<X className="h-4 w-4" />}
                        title={envVar.key}
                        status={envVar.description}
                        statusType="error"
                      />
                    ))}
                    {envStatus.missing.map((envVar) => (
                      <div
                        key={`${envVar.key}-hint`}
                        className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                      >
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
                    ))}
                  </div>
                </ProCard>
              )}

              {/* Present Variables */}
              {envStatus.present.length > 0 && (
                <ProCard
                  title={t('envError.presentVars')}
                  extra={
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-xs font-medium text-white">
                      {envStatus.present.length}
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

              {/* Solution Steps */}
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

              {/* Retry Link */}
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={checkEnvStatus}
              >
                {t('envError.retry')}
              </Button>
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
