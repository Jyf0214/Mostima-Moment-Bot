'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProCard } from '@/components/ui/ProCard';
import { Input } from '@/components/ui/Input';
import { Plug, CheckCircle2, AlertTriangle, Lock, Settings, Paintbrush } from 'lucide-react';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [privateKeyStatus, setPrivateKeyStatus] = useState<{
    configured: boolean;
    source: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadMsgType, setUploadMsgType] = useState<'success' | 'error'>('success');
  const [botInfo, setBotInfo] = useState<{
    slug: string;
    appId: string;
    mention: string;
    fixCommand: string;
    installUrl: string;
  } | null>(null);

  const [heroGradient, setHeroGradient] = useState('from-blue-50 via-transparent to-purple-50');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [heroSaving, setHeroSaving] = useState(false);
  const [heroMsg, setHeroMsg] = useState<string | null>(null);

  const GRADIENT_PRESETS = [
    { labelKey: 'settings.gradientBluePurple', value: 'from-blue-50 via-transparent to-purple-50' },
    { labelKey: 'settings.gradientMint', value: 'from-emerald-50 via-teal-50 to-cyan-50' },
    { labelKey: 'settings.gradientSunset', value: 'from-amber-50 via-orange-50 to-yellow-50' },
    { labelKey: 'settings.gradientRose', value: 'from-pink-50 via-rose-50 to-red-50' },
    { labelKey: 'settings.gradientIndigo', value: 'from-indigo-50 via-blue-50 to-sky-50' },
    { labelKey: 'settings.gradientWhite', value: 'from-white via-zinc-50 to-zinc-100' },
  ];

  useEffect(() => {
    checkPrivateKey();
    fetchBotInfo();
    fetchHeroConfig();
  }, []);

  const fetchHeroConfig = async () => {
    try {
      const res = await fetch('/api/site-config');
      if (res.ok) {
        const data = await res.json();
        if (data.hero_gradient) setHeroGradient(data.hero_gradient);
        if (data.hero_image_url !== undefined) setHeroImageUrl(data.hero_image_url);
      }
    } catch {
      /* default */
    }
  };

  const saveHeroConfig = async () => {
    setHeroSaving(true);
    setHeroMsg(null);
    try {
      await fetch('/api/site-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hero_gradient', value: heroGradient }),
      });
      await fetch('/api/site-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hero_image_url', value: heroImageUrl }),
      });
      setHeroMsg(t('settings.configSaved'));
    } catch {
      setHeroMsg(t('settings.configSaveFailed'));
    } finally {
      setHeroSaving(false);
    }
  };

  const checkPrivateKey = async () => {
    try {
      const res = await fetch('/api/github/private-key');
      const data = await res.json();
      setPrivateKeyStatus(data);
    } catch {
      setPrivateKeyStatus({ configured: false, source: 'unknown' });
    }
  };

  const fetchBotInfo = async () => {
    try {
      const res = await fetch('/api/bot/info');
      if (res.ok) setBotInfo(await res.json());
    } catch {
      /* silent */
    }
  };

  const handleUploadPrivateKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const content = await file.text();
      const res = await fetch('/api/github/private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey: content }),
      });
      if (res.ok) {
        setUploadMsgType('success');
        setUploadMsg(t('setup.privateKeySaved'));
        checkPrivateKey();
      } else {
        const err = await res.json();
        setUploadMsgType('error');
        setUploadMsg(err.error || t('setup.privateKeySaveFailed'));
      }
    } catch {
      setUploadMsgType('error');
      setUploadMsg(t('setup.privateKeySaveFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {botInfo && botInfo.slug && (
        <ProCard className="bg-white border-zinc-200" padding="p-5">
          <div className="flex items-center gap-3 mb-4">
            <Plug className="h-5 w-5 text-zinc-500" />
            <h3 className="text-zinc-900 font-medium">{t('settings.botInfo')}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm">{t('settings.botSlug')}</span>
              <span className="text-zinc-900 text-sm font-mono">{botInfo.slug}</span>
            </div>
            {botInfo.appId && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-sm">{t('settings.botAppId')}</span>
                <span className="text-zinc-900 text-sm font-mono">{botInfo.appId}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm">{t('settings.botMention')}</span>
              <code className="text-blue-600 text-sm bg-blue-50 px-2 py-0.5 rounded">
                {botInfo.fixCommand}
              </code>
            </div>
            {botInfo.installUrl && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-sm">{t('settings.botInstall')}</span>
                <a
                  href={botInfo.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 text-sm hover:text-blue-700 transition-colors"
                >
                  {t('home.installAppButton')} ↗
                </a>
              </div>
            )}
          </div>
        </ProCard>
      )}

      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="h-5 w-5 text-zinc-500" />
          <h3 className="text-zinc-900 font-medium">{t('setup.privateKey')}</h3>
        </div>
        {privateKeyStatus && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              {privateKeyStatus.configured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-sm text-zinc-700">
                {privateKeyStatus.configured
                  ? t('setup.privateKeyConfigured')
                  : t('setup.privateKeyNotConfigured')}
              </span>
            </div>
          </div>
        )}
        <label className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer">
          <input
            type="file"
            accept=".pem,.key"
            className="hidden"
            onChange={handleUploadPrivateKey}
            disabled={uploading}
          />
          {uploading ? t('setup.uploading') : t('setup.uploadPrivateKey')}
        </label>
        {uploadMsg && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${uploadMsgType === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
          >
            {uploadMsgType === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            {uploadMsg}
          </div>
        )}
      </ProCard>

      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <div className="flex items-center gap-3 mb-3">
          <Settings className="h-5 w-5 text-blue-500" />
          <h3 className="text-zinc-900 font-medium">{t('settings.githubAppSection')}</h3>
        </div>
        <p className="text-zinc-500 text-xs">
          {botInfo?.appId
            ? t('settings.githubAppIdLabel', { appId: botInfo.appId })
            : t('settings.githubAppIdNotSet')}
        </p>
      </ProCard>

      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Paintbrush className="h-5 w-5 text-zinc-500" />
          <h3 className="text-zinc-900 font-medium">{t('settings.heroBackground')}</h3>
        </div>
        <div className="mb-4">
          <p className="text-xs font-medium text-zinc-600 mb-2">{t('settings.presetGradients')}</p>
          <div className="grid grid-cols-3 gap-2">
            {GRADIENT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  setHeroGradient(preset.value);
                  setHeroImageUrl('');
                }}
                className={`h-12 rounded-lg bg-gradient-to-br ${preset.value} border-2 transition-all ${heroGradient === preset.value && !heroImageUrl ? 'border-blue-500 shadow-md' : 'border-zinc-200 hover:border-zinc-300'}`}
                title={t(preset.labelKey)}
              >
                <span className="text-[10px] font-medium text-zinc-600 bg-white/80 px-1.5 py-0.5 rounded">
                  {t(preset.labelKey)}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <p className="text-xs font-medium text-zinc-600 mb-2">{t('settings.customImageUrl')}</p>
          <Input
            type="url"
            value={heroImageUrl}
            onChange={(e) => {
              setHeroImageUrl(e.target.value);
              setHeroGradient('');
            }}
            placeholder="https://example.com/image.jpg"
            size="sm"
          />
        </div>
        <button
          onClick={saveHeroConfig}
          disabled={heroSaving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {heroSaving ? t('settings.saving') : t('settings.saveConfig')}
        </button>
        {heroMsg && <p className="mt-2 text-xs text-zinc-500">{heroMsg}</p>}
      </ProCard>
    </div>
  );
}
