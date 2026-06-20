'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Check, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#ff4b2b] via-[#ff416c] to-[#2d1b69] p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6">
            {/* Warning Icon */}
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-9 w-9 text-red-500" />
            </div>

            {/* Title */}
            <h2 className="text-center text-2xl font-bold text-gray-900">{t('envError.title')}</h2>

            {/* Description */}
            <p className="max-w-[400px] text-center text-sm text-gray-500">
              {t('envError.description')}
            </p>

            {envStatus && (
              <div className="flex w-full flex-col gap-5">
                {/* Missing Variables */}
                {envStatus.missing.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-200">
                        <X className="h-3 w-3 text-red-600" />
                      </div>
                      <span className="text-sm font-semibold text-red-700">
                        {t('envError.missingVars')}
                      </span>
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                        {envStatus.missing.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {envStatus.missing.map((envVar) => (
                        <div
                          key={envVar.key}
                          className="rounded-lg border border-red-200 bg-red-100/60 p-3"
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                              <X className="h-3 w-3" />
                              {envVar.key}
                            </span>
                          </div>
                          <p className="mb-1.5 text-xs text-gray-500">{envVar.description}</p>
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 text-xs font-semibold text-gray-900">
                              {t('envError.howToGet')}:
                            </span>
                            <code className="flex-1 break-all whitespace-pre-wrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-gray-100">
                              {envVar.generateHint}
                            </code>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Present Variables */}
                {envStatus.present.length > 0 && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-200">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span className="text-sm font-semibold text-green-700">
                        {t('envError.presentVars')}
                      </span>
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-xs font-medium text-white">
                        {envStatus.present.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {envStatus.present.map((envVar) => (
                        <div key={envVar.key} className="flex items-start gap-2">
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            <Check className="h-3 w-3" />
                            {envVar.key}
                          </span>
                          <span className="text-xs text-gray-500">{envVar.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Solution Steps */}
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                      <span className="text-xs font-bold text-white">?</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">
                      {t('envError.solution')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {STEPS_KEYS.map((key, index) => (
                      <div key={key} className="flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500">
                          <span className="text-xs font-bold text-white">{index + 1}</span>
                        </div>
                        <p className="text-sm text-gray-700">{t(key)}</p>
                      </div>
                    ))}
                    <p className="ml-9 text-xs text-gray-500">{t('envError.step4')}</p>
                  </div>
                </div>

                {/* Retry Link */}
                <button
                  type="button"
                  onClick={checkEnvStatus}
                  className="flex items-center justify-center gap-1.5 self-center text-xs text-gray-500 transition-colors hover:text-gray-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('envError.retry')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
