'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Settings } from 'lucide-react';
import { ProCard } from '@/components/ui/ProCard';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessAlert } from '@/components/ui/SuccessAlert';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { apiErrorMessage, apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';

/** Qwen settings.json 配置编辑卡片（清除为危险操作，需二次确认） */
export function QwenSettingsCard() {
  const { t } = useTranslation();
  const [qwenSettings, setQwenSettings] = useState('');
  // 用户是否改动过 textarea 内容，防止误覆盖服务端已存配置
  const [qwenDirty, setQwenDirty] = useState(false);
  const [qwenSaving, setQwenSaving] = useState(false);
  const [qwenMsg, setQwenMsg] = useState<string | null>(null);
  const [qwenMsgType, setQwenMsgType] = useState<'success' | 'error'>('success');
  // null 表示尚未查询到状态，避免先闪「未配置」
  const [qwenConfigured, setQwenConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiJson<{ configured: boolean }>('/api/qwen-settings');
        setQwenConfigured(data.configured);
      } catch (err) {
        if (isUnauthorized(err)) redirectToHome();
        /* 失败时保持未知态 */
      }
    })();
  }, []);

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

  return (
    <ProCard className="bg-white border-zinc-200" padding="p-5">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="h-5 w-5 text-zinc-500" />
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
              <span className="text-sm text-zinc-700">{t('settings.qwenSettingsConfigured')}</span>
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
              // 危险操作：清除后 AI 功能将不可用，需二次确认
              if (!window.confirm(t('settings.qwenClearConfirm'))) {
                return;
              }
              // 必须显式传空串，否则闭包捕获旧 state 会把旧配置写回服务端
              void saveQwenSettings('');
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
  );
}
