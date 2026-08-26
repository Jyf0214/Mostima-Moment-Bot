'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProCard } from '@/components/ui/ProCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessAlert } from '@/components/ui/SuccessAlert';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { apiErrorMessage, apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';
import {
  Plug,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Lock,
  Settings,
  Paintbrush,
  Database,
  RefreshCw,
  Terminal,
} from 'lucide-react';

/** bot 信息（/api/bot/info 返回结构） */
interface BotInfo {
  slug: string;
  appId: string;
  mention: string;
  fixCommand: string;
  installUrl: string;
}

/** site-config 两个配置项的展示名，部分失败时用于提示是哪一项写入失败 */
const HERO_CONFIG_ITEMS = ['gradient', 'image_url'] as const;

/** 登录态失效（401）统一跳回首页重新登录 */

export default function SettingsPage() {
  const { t } = useTranslation();
  const [privateKeyStatus, setPrivateKeyStatus] = useState<{
    configured: boolean;
    source: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadMsgType, setUploadMsgType] = useState<'success' | 'error'>('success');
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);

  const [heroGradient, setHeroGradient] = useState('from-blue-50 via-transparent to-purple-50');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [heroSaving, setHeroSaving] = useState(false);
  const [heroMsg, setHeroMsg] = useState<string | null>(null);
  const [heroMsgType, setHeroMsgType] = useState<'success' | 'error'>('success');

  const [qwenSettings, setQwenSettings] = useState('');
  // 用户是否改动过 textarea 内容，防止误覆盖服务端已存配置
  const [qwenDirty, setQwenDirty] = useState(false);
  const [qwenSaving, setQwenSaving] = useState(false);
  const [qwenMsg, setQwenMsg] = useState<string | null>(null);
  const [qwenMsgType, setQwenMsgType] = useState<'success' | 'error'>('success');
  // null 表示尚未查询到状态，避免先闪「未配置」
  const [qwenConfigured, setQwenConfigured] = useState<boolean | null>(null);

  // qwen CLI 安装状态
  const [qwenCliInstalled, setQwenCliInstalled] = useState<boolean | null>(null);
  const [qwenCliVersion, setQwenCliVersion] = useState<string | null>(null);
  // CLI 状态检查失败：网络错误不能伪装成「未安装」，需展示"状态未知"+重试
  const [qwenCliCheckFailed, setQwenCliCheckFailed] = useState(false);

  // 数据库运行模式状态（null 表示未知）
  const [dbModeEnabled, setDbModeEnabled] = useState<boolean | null>(null);
  const [dbModeEnvCount, setDbModeEnvCount] = useState(0);
  const [dbModeLoading, setDbModeLoading] = useState(false);
  const [dbModeMsg, setDbModeMsg] = useState<string | null>(null);
  const [dbModeMsgType, setDbModeMsgType] = useState<'success' | 'error'>('success');

  const GRADIENT_PRESETS = [
    { labelKey: 'settings.gradientBluePurple', value: 'from-blue-50 via-transparent to-purple-50' },
    { labelKey: 'settings.gradientMint', value: 'from-emerald-50 via-teal-50 to-cyan-50' },
    { labelKey: 'settings.gradientSunset', value: 'from-amber-50 via-orange-50 to-yellow-50' },
    { labelKey: 'settings.gradientRose', value: 'from-pink-50 via-rose-50 to-red-50' },
    { labelKey: 'settings.gradientIndigo', value: 'from-indigo-50 via-blue-50 to-sky-50' },
    { labelKey: 'settings.gradientWhite', value: 'from-white via-zinc-50 to-zinc-100' },
  ];

  const checkPrivateKey = async () => {
    try {
      const data = await apiJson<{ configured: boolean; source: string }>(
        '/api/github/private-key'
      );
      setPrivateKeyStatus(data);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      // 网络错误不能伪装成「未配置」，标记来源为 error 以显示中性的「状态未知」
      setPrivateKeyStatus({ configured: false, source: 'error' });
    }
  };

  const fetchBotInfo = async () => {
    try {
      const data = await apiJson<BotInfo>('/api/bot/info');
      setBotInfo(data);
    } catch (err) {
      if (isUnauthorized(err)) redirectToHome();
      /* 静默失败，保持占位骨架 */
    }
  };

  const fetchHeroConfig = async () => {
    try {
      const data = await apiJson<{ hero_gradient?: string; hero_image_url?: string }>(
        '/api/site-config'
      );
      if (data.hero_gradient) setHeroGradient(data.hero_gradient);
      if (data.hero_image_url !== undefined) setHeroImageUrl(data.hero_image_url);
    } catch (err) {
      if (isUnauthorized(err)) redirectToHome();
      /* 失败时保留默认值 */
    }
  };

  const fetchQwenSettings = async () => {
    try {
      const data = await apiJson<{ configured: boolean }>('/api/qwen-settings');
      setQwenConfigured(data.configured);
    } catch (err) {
      if (isUnauthorized(err)) redirectToHome();
      /* 失败时保持未知态 */
    }
  };

  const fetchQwenCliStatus = async () => {
    try {
      const data = await apiJson<{ installed: boolean; version?: string | null }>(
        '/api/qwen-status'
      );
      setQwenCliInstalled(data.installed);
      setQwenCliVersion(data.version ?? null);
      setQwenCliCheckFailed(false);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      // 检查失败 ≠ 未安装：回到"状态未知"并允许重试，与 checkPrivateKey 的策略一致
      setQwenCliInstalled(null);
      setQwenCliVersion(null);
      setQwenCliCheckFailed(true);
    }
  };

  const fetchDbModeStatus = async () => {
    try {
      const data = await apiJson<{ enabled: boolean; envCount: number }>('/api/env-db-mode');
      setDbModeEnabled(data.enabled);
      setDbModeEnvCount(data.envCount);
    } catch (err) {
      if (isUnauthorized(err)) redirectToHome();
      /* 失败时保持未知态，不误报「未启用」 */
    }
  };

  const enableDbMode = async () => {
    setDbModeLoading(true);
    setDbModeMsg(null);
    try {
      const data = await apiJson<{ envCount: number }>('/api/env-db-mode', { method: 'POST' });
      setDbModeMsgType('success');
      setDbModeMsg(t('settings.dbModeEnabled', { count: data.envCount }));
      setDbModeEnabled(true);
      setDbModeEnvCount(data.envCount);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setDbModeMsgType('error');
      setDbModeMsg(apiErrorMessage(err, t('settings.dbModeEnableFailed')));
    } finally {
      setDbModeLoading(false);
    }
  };

  const disableDbMode = async () => {
    setDbModeLoading(true);
    setDbModeMsg(null);
    try {
      await apiJson('/api/env-db-mode', { method: 'DELETE' });
      setDbModeMsgType('success');
      setDbModeMsg(t('settings.dbModeDisabled'));
      setDbModeEnabled(false);
      setDbModeEnvCount(0);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setDbModeMsgType('error');
      setDbModeMsg(apiErrorMessage(err, t('settings.dbModeDisableFailed')));
    } finally {
      setDbModeLoading(false);
    }
  };

  useEffect(() => {
    checkPrivateKey();
    fetchBotInfo();
    fetchHeroConfig();
    fetchQwenSettings();
    fetchQwenCliStatus();
    fetchDbModeStatus();
  }, []);

  const saveHeroConfig = async () => {
    setHeroSaving(true);
    setHeroMsg(null);
    try {
      // 使用 Promise.allSettled 并行保存，确保两个配置都尝试写入
      const results = await Promise.allSettled([
        apiJson('/api/site-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'hero_gradient', value: heroGradient }),
        }),
        apiJson('/api/site-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'hero_image_url', value: heroImageUrl }),
        }),
      ]);
      let unauthorized = false;
      const failedItems: string[] = [];
      results.forEach((r, idx) => {
        if (r.status !== 'rejected') return;
        if (isUnauthorized(r.reason)) unauthorized = true;
        failedItems.push(HERO_CONFIG_ITEMS[idx]);
      });
      if (unauthorized) {
        redirectToHome();
        return;
      }
      if (failedItems.length > 0) {
        // 部分失败时带上具体是哪一项失败，便于排查
        setHeroMsgType('error');
        setHeroMsg(`${t('settings.configSaveFailed')}: ${failedItems.join(', ')}`);
      } else {
        setHeroMsgType('success');
        setHeroMsg(t('settings.configSaved'));
      }
    } finally {
      setHeroSaving(false);
    }
  };

  /**
   * 保存 qwen 配置。
   * 显式接受参数而非直接读 state：「清除配置」传空串时，
   * 若闭包捕获旧 state 会把旧配置原样 PUT 回服务端却提示成功。
   */
  const saveQwenSettings = async (value: string = qwenSettings) => {
    setQwenSaving(true);
    setQwenMsg(null);
    try {
      await apiJson('/api/qwen-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: value }),
      });
      setQwenMsgType('success');
      setQwenMsg(t('settings.qwenSettingsSaved'));
      setQwenConfigured(!!value.trim());
      setQwenDirty(false);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setQwenMsgType('error');
      setQwenMsg(apiErrorMessage(err, t('settings.qwenSettingsSaveFailed')));
    } finally {
      setQwenSaving(false);
    }
  };

  const handleUploadPrivateKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 无论成功失败都复位 input，否则再次选择同一个文件不会触发 onChange
    const input = e.target;
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const content = await file.text();
      await apiJson('/api/github/private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey: content }),
      });
      setUploadMsgType('success');
      setUploadMsg(t('setup.privateKeySaved'));
      checkPrivateKey();
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setUploadMsgType('error');
      setUploadMsg(apiErrorMessage(err, t('setup.privateKeySaveFailed')));
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {botInfo?.slug ? (
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
      ) : (
        // bot 信息加载中的等高占位骨架，避免整卡突然弹出
        <Skeleton className="h-40 rounded-xl border border-zinc-200" />
      )}

      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="h-5 w-5 text-zinc-500" />
          <h3 className="text-zinc-900 font-medium">{t('setup.privateKey')}</h3>
        </div>
        {privateKeyStatus === null ? (
          <div className="mb-4">
            {/* 状态检查中先占位，避免误闪「未配置」 */}
            <Skeleton className="h-4 w-28" />
          </div>
        ) : (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              {privateKeyStatus.configured ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-zinc-700">{t('setup.privateKeyConfigured')}</span>
                </>
              ) : privateKeyStatus.source === 'error' ? (
                <>
                  {/* 网络错误等异常显示中性灰色的「状态未知」，不伪装成未配置 */}
                  <HelpCircle className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm text-zinc-500">{t('settings.statusUnknown')}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-zinc-700">
                    {t('setup.privateKeyNotConfigured')}
                  </span>
                </>
              )}
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
        {uploadMsg &&
          (uploadMsgType === 'success' ? (
            <SuccessAlert message={uploadMsg} />
          ) : (
            <ErrorAlert message={uploadMsg} className="mt-3" />
          ))}
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
        <Button variant="default" onClick={saveHeroConfig} loading={heroSaving}>
          {t('settings.saveConfig')}
        </Button>
        {heroMsg &&
          (heroMsgType === 'success' ? (
            <SuccessAlert message={heroMsg} />
          ) : (
            <ErrorAlert message={heroMsg} className="mt-3" />
          ))}
      </ProCard>

      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-5 w-5 text-indigo-500" />
          <h3 className="text-zinc-900 font-medium">{t('settings.dbMode')}</h3>
        </div>
        <p className="text-zinc-500 text-xs mb-4">{t('settings.dbModeDescription')}</p>

        <div className="flex items-center gap-2 mb-4">
          {dbModeEnabled === null ? (
            /* 状态查询中先占位，避免误闪「未启用」 */
            <Skeleton className="h-4 w-28" />
          ) : dbModeEnabled ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-zinc-700">
                {t('settings.dbModeStatusEnabled', { count: dbModeEnvCount })}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-zinc-700">{t('settings.dbModeStatusDisabled')}</span>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {!dbModeEnabled ? (
            <Button
              variant="default"
              icon={<Database className="h-4 w-4" />}
              onClick={enableDbMode}
              loading={dbModeLoading}
              disabled={dbModeEnabled === null || dbModeLoading}
              className="border-indigo-600 bg-indigo-600 text-white hover:border-indigo-700 hover:bg-indigo-700 hover:text-white"
            >
              {t('settings.dbModeEnable')}
            </Button>
          ) : (
            <Button
              variant="default"
              icon={<Database className="h-4 w-4" />}
              onClick={disableDbMode}
              loading={dbModeLoading}
              disabled={dbModeEnabled === null || dbModeLoading}
              className="border-zinc-100 bg-zinc-100 text-zinc-700 hover:border-zinc-200 hover:bg-zinc-200 hover:text-zinc-700"
            >
              {t('settings.dbModeDisable')}
            </Button>
          )}
        </div>

        {dbModeMsg &&
          (dbModeMsgType === 'success' ? (
            <SuccessAlert message={dbModeMsg} />
          ) : (
            <ErrorAlert message={dbModeMsg} className="mt-3" />
          ))}

        <p className="mt-3 text-xs text-zinc-500">{t('settings.dbModeHint')}</p>
      </ProCard>

      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Terminal className="h-5 w-5 text-cyan-500" />
          <h3 className="text-zinc-900 font-medium">{t('settings.qwenCliTitle')}</h3>
        </div>
        <div className="flex items-center gap-2">
          {qwenCliInstalled === null && !qwenCliCheckFailed ? (
            <RefreshCw className="h-4 w-4 text-zinc-400 animate-spin" />
          ) : qwenCliInstalled ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-sm text-zinc-700">
            {qwenCliInstalled === null
              ? qwenCliCheckFailed
                ? t('settings.statusUnknown')
                : '...'
              : qwenCliInstalled
                ? t('settings.qwenCliInstalled')
                : t('settings.qwenCliNotInstalled')}
          </span>
          {qwenCliVersion && (
            <span className="text-xs text-zinc-400 font-mono ml-1">({qwenCliVersion})</span>
          )}
          {qwenCliCheckFailed && (
            <button
              type="button"
              onClick={() => void fetchQwenCliStatus()}
              className="ml-1 inline-flex items-center gap-1 rounded-md p-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <RefreshCw className="h-3 w-3" />
              {t('common.retry')}
            </button>
          )}
        </div>
      </ProCard>

      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="h-5 w-5 text-purple-500" />
          <h3 className="text-zinc-900 font-medium">{t('settings.qwenSettings')}</h3>
        </div>
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            {qwenConfigured === null ? (
              /* 状态查询中先占位，避免误闪「未配置」 */
              <Skeleton className="h-4 w-28" />
            ) : qwenConfigured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-zinc-700">
                  {t('settings.qwenSettingsConfigured')}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-zinc-700">
                  {t('settings.qwenSettingsNotConfigured')}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="mb-4">
          <p className="text-xs font-medium text-zinc-600 mb-2">
            {t('settings.qwenSettingsJsonLabel')}
          </p>
          <Textarea
            value={qwenSettings}
            onChange={(e) => {
              setQwenSettings(e.target.value);
              setQwenDirty(true);
            }}
            placeholder={t('settings.qwenSettingsPlaceholder')}
            spellCheck={false}
            className="h-40 bg-zinc-50 font-mono"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={() => saveQwenSettings()}
            loading={qwenSaving}
            disabled={qwenSaving || !qwenDirty || (!qwenSettings.trim() && !!qwenConfigured)}
          >
            {t('settings.saveConfig')}
          </Button>
          {!!qwenConfigured && (
            <Button
              variant="default"
              onClick={() => {
                // 必须显式传空串，否则闭包捕获旧 state 会把旧配置写回服务端
                saveQwenSettings('');
              }}
              loading={qwenSaving}
              disabled={qwenSaving}
            >
              {t('settings.clearConfig')}
            </Button>
          )}
        </div>
        {/* 服务端刻意不下发已存配置内容；内容为空且已配置时阻止保存以防误覆盖 */}
        {!!qwenConfigured && !qwenSettings.trim() && (
          <p className="mt-2 text-xs text-zinc-500">{t('settings.qwenSaveBlockedHint')}</p>
        )}
        {qwenMsg &&
          (qwenMsgType === 'success' ? (
            <SuccessAlert message={qwenMsg} />
          ) : (
            <ErrorAlert message={qwenMsg} className="mt-3" />
          ))}
        <p className="mt-3 text-xs text-zinc-500">{t('settings.qwenSettingsHint')}</p>
      </ProCard>
    </div>
  );
}
