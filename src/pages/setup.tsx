'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Check,
  AlertCircle,
  Key,
  Settings,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Server,
  FileCode,
  GitBranch,
  Webhook,
  BarChart3,
  MessageCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

function GithubIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const featureIcons = [Rocket, Webhook, BarChart3, MessageCircle, Settings];

const gradientBg = 'bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]';
const glassPanel = 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl';
const inputBase =
  'w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors';

export default function SetupPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [privateKey, setPrivateKey] = useState<File | null>(null);
  const [appId, setAppId] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAppStatus();
  }, []);

  const checkAppStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setIsNew(data.isNew);
    } catch {
      setError(t('setup.checkStatusFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!privateKey || !appId || !webhookSecret || !repoOwner || !repoName) {
      setError(t('setup.fillAllFields'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('privateKey', privateKey);
      formData.append('appId', appId);
      formData.append('webhookSecret', webhookSecret);
      formData.append('repoOwner', repoOwner);
      formData.append('repoName', repoName);

      const response = await fetch('/api/setup', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('setup.setupFailed'));
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && (!privateKey || !appId || !webhookSecret)) {
      setError(t('setup.fillAllFields'));
      return;
    }
    if (activeStep === 1 && (!repoOwner || !repoName)) {
      setError(t('setup.fillAllFields'));
      return;
    }
    setError('');
    setActiveStep((prev) => Math.min(prev + 1, 2));
  };

  const handlePrevious = () => {
    setError('');
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPrivateKey(file);
  };

  /* ---------- Loading state ---------- */
  if (loading) {
    return (
      <div className={`${gradientBg} min-h-screen flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-blue-500" />
          <p className="text-sm text-white/50">{t('setup.title')}</p>
        </div>
      </div>
    );
  }

  /* ---------- Success state ---------- */
  if (success) {
    return (
      <div className={`${gradientBg} min-h-screen flex items-center justify-center p-6`}>
        <div className={`${glassPanel} max-w-md w-full p-12 flex flex-col items-center gap-8`}>
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center shadow-lg shadow-green-500/20">
            <Check className="h-12 w-12 text-white" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">{t('setup.complete')}</h2>
            <p className="mt-2 text-white/60">{t('setup.completeSubtitle')}</p>
          </div>

          <a
            href="/api/auth/login"
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-lg font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-blue-500/40"
          >
            <GithubIcon className="h-5 w-5" />
            {t('setup.loginGithub')}
          </a>
        </div>
      </div>
    );
  }

  /* ---------- Welcome-back state ---------- */
  if (!isNew) {
    return (
      <div className={`${gradientBg} min-h-screen flex items-center justify-center p-6`}>
        <div className={`${glassPanel} max-w-md w-full p-12 flex flex-col items-center gap-8`}>
          <div className="h-18 w-18 rounded-full bg-gradient-to-br from-blue-600 to-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <GithubIcon className="h-9 w-9 text-white" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">{t('setup.welcomeBack')}</h2>
            <p className="mt-2 text-white/60">{t('setup.welcomeBackSubtitle')}</p>
          </div>

          <a
            href="/api/auth/login"
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-lg font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-blue-500/40"
          >
            <GithubIcon className="h-5 w-5" />
            {t('setup.loginGithub')}
          </a>
        </div>
      </div>
    );
  }

  /* ---------- Main setup wizard ---------- */
  const steps = [
    { label: t('setup.stepCredentials'), desc: t('setup.stepCredentialsDesc'), icon: Key },
    { label: t('setup.stepRepository'), desc: t('setup.stepRepositoryDesc'), icon: GitBranch },
    { label: t('setup.stepReview'), desc: t('setup.stepReviewDesc'), icon: Rocket },
  ];

  return (
    <div className={`${gradientBg} min-h-screen`}>
      <div className="mx-auto max-w-screen-xl px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white">{t('setup.title')}</h1>
          <p className="mt-2 text-lg text-white/60">{t('setup.subtitle')}</p>
        </div>

        {/* Stepper */}
        <div className={`${glassPanel} p-6 mb-8`}>
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === activeStep;
              const isComplete = idx < activeStep;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className="flex flex-1 items-center gap-3 group cursor-pointer"
                >
                  {/* Circle */}
                  <div
                    className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                      isComplete
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        : isActive
                          ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-white/10 text-white/40 group-hover:bg-white/15'
                    }`}
                  >
                    {isComplete ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                  </div>
                  {/* Label */}
                  <div className="hidden sm:block text-left">
                    <p
                      className={`text-sm font-semibold ${
                        isActive || isComplete ? 'text-white' : 'text-white/40'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-white/40">{step.desc}</p>
                  </div>
                  {/* Connector */}
                  {idx < steps.length - 1 && (
                    <div
                      className={`mx-3 hidden sm:block h-px flex-1 ${
                        idx < activeStep ? 'bg-green-500/50' : 'bg-white/10'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left panel - Features */}
          <div className={`${glassPanel} p-8`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-500 shadow-lg shadow-violet-500/20">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">{t('setup.featureTitle')}</h3>
            </div>

            <hr className="mb-6 border-white/10" />

            <div className="flex flex-col gap-4">
              {[
                t('setup.feature1'),
                t('setup.feature2'),
                t('setup.feature3'),
                t('setup.feature4'),
                t('setup.feature5'),
              ].map((feature, index) => {
                const FeatureIcon = featureIcons[index];
                return (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                      <FeatureIcon className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-white/80">{feature}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel - Form */}
          <div className={`${glassPanel} p-8`}>
            {/* Step 0: Credentials */}
            {activeStep === 0 && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-cyan-500/20">
                    <Key className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{t('setup.credentialsTitle')}</h4>
                    <p className="text-sm text-white/50">{t('setup.credentialsDesc')}</p>
                  </div>
                </div>

                <hr className="border-white/10" />

                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6">
                  <div className="flex flex-col gap-5">
                    {/* File upload */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-white/80">
                        {t('setup.privateKey')}
                      </label>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-3.5 text-left transition-colors hover:border-blue-500/40 hover:bg-white/[0.07]"
                      >
                        <Upload className="h-4 w-4 shrink-0 text-white/40" />
                        <span
                          className={`text-sm ${
                            privateKey ? 'text-white' : 'text-white/40'
                          } truncate`}
                        >
                          {privateKey ? privateKey.name : t('setup.privateKeyPlaceholder')}
                        </span>
                        {privateKey && (
                          <Check className="ml-auto h-4 w-4 shrink-0 text-green-400" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pem"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

                    {/* App ID */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-white/80">
                        {t('setup.appId')}
                      </label>
                      <input
                        type="text"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        placeholder={t('setup.appIdPlaceholder')}
                        required
                        className={inputBase}
                      />
                    </div>

                    {/* Webhook Secret */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-white/80">
                        {t('setup.webhookSecret')}
                      </label>
                      <input
                        type="text"
                        value={webhookSecret}
                        onChange={(e) => setWebhookSecret(e.target.value)}
                        placeholder={t('setup.webhookSecretPlaceholder')}
                        required
                        className={inputBase}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-blue-500/40"
                  >
                    {t('setup.next')}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Repository */}
            {activeStep === 1 && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-500/20">
                    <Server className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{t('setup.repoConfigTitle')}</h4>
                    <p className="text-sm text-white/50">{t('setup.repoConfigDesc')}</p>
                  </div>
                </div>

                <hr className="border-white/10" />

                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6">
                  <div className="flex flex-col gap-5">
                    {/* Repo Owner */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-white/80">
                        {t('setup.repoOwner')}
                      </label>
                      <div className="relative">
                        <GithubIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <input
                          type="text"
                          value={repoOwner}
                          onChange={(e) => setRepoOwner(e.target.value)}
                          placeholder={t('setup.repoOwnerPlaceholder')}
                          required
                          className={`${inputBase} pl-10`}
                        />
                      </div>
                    </div>

                    {/* Repo Name */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-white/80">
                        {t('setup.repoName')}
                      </label>
                      <div className="relative">
                        <FileCode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <input
                          type="text"
                          value={repoName}
                          onChange={(e) => setRepoName(e.target.value)}
                          placeholder={t('setup.repoNamePlaceholder')}
                          required
                          className={`${inputBase} pl-10`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-2">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white/80"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('setup.previous')}
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-blue-500/40"
                  >
                    {t('setup.next')}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Review */}
            {activeStep === 2 && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-teal-500 shadow-lg shadow-teal-500/20">
                    <Rocket className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{t('setup.reviewTitle')}</h4>
                    <p className="text-sm text-white/50">{t('setup.reviewDesc')}</p>
                  </div>
                </div>

                <hr className="border-white/10" />

                {/* App Info Card */}
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-400" />
                      <p className="text-sm font-semibold text-white">{t('setup.appInfo')}</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white/50">{t('setup.privateKey')}:</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            privateKey
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {privateKey ? privateKey.name : t('setup.fillAllFields')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white/50">{t('setup.appId')}:</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            appId ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {appId || '-'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white/50">{t('setup.webhookSecret')}:</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            webhookSecret
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {webhookSecret ? '***' : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Repo Info Card */}
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-violet-400" />
                      <p className="text-sm font-semibold text-white">{t('setup.repoInfo')}</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white/50">{t('setup.repoOwner')}:</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            repoOwner
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {repoOwner || '-'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white/50">{t('setup.repoName')}:</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            repoName
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {repoName || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-2">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white/80"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('setup.previous')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:from-green-500 hover:to-teal-400 hover:shadow-teal-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        {t('setup.saveConfig')}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        {t('setup.saveConfig')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Skip Login */}
        <div className="flex justify-center mt-10">
          <a
            href="/api/auth/login"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white/50 transition-colors hover:bg-white/5 hover:text-white/70 rounded-lg"
          >
            <GithubIcon className="h-4 w-4" />
            {t('setup.skipLogin')}
          </a>
        </div>
      </div>
    </div>
  );
}
