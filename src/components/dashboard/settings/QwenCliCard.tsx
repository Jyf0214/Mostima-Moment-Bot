'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, RefreshCw, Terminal } from 'lucide-react';
import { ProCard } from '@/components/ui/ProCard';
import { apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';

/** Qwen CLI 安装状态卡片（检查失败显示"状态未知"+重试，不伪装成未安装） */
export function QwenCliCard() {
  const { t } = useTranslation();
  // qwen CLI 安装状态
  const [qwenCliInstalled, setQwenCliInstalled] = useState<boolean | null>(null);
  const [qwenCliVersion, setQwenCliVersion] = useState<string | null>(null);
  // CLI 状态检查失败：网络错误不能伪装成「未安装」，需展示"状态未知"+重试
  const [qwenCliCheckFailed, setQwenCliCheckFailed] = useState(false);

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
      // 检查失败 ≠ 未安装：回到"状态未知"并允许重试，与私钥状态的策略一致
      setQwenCliInstalled(null);
      setQwenCliVersion(null);
      setQwenCliCheckFailed(true);
    }
  };

  useEffect(() => {
    void fetchQwenCliStatus();
  }, []);

  return (
    <ProCard className="bg-white border-zinc-200" padding="p-5">
      <div className="flex items-center gap-3 mb-4">
        <Terminal className="h-5 w-5 text-zinc-500" />
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
  );
}
