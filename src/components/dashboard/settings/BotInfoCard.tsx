'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug } from 'lucide-react';
import { ProCard } from '@/components/ui/ProCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';

/** bot 信息（/api/bot/info 返回结构） */
interface BotInfo {
  slug: string;
  appId: string;
  mention: string;
  fixCommand: string;
  installUrl: string;
}

/**
 * Bot 信息卡片。
 * 原 SettingsPage 里「GitHub App」卡与本卡重复展示 appId，现已合并为一张。
 */
export function BotInfoCard() {
  const { t } = useTranslation();
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiJson<BotInfo>('/api/bot/info');
        if (!cancelled) setBotInfo(data);
      } catch (err) {
        if (isUnauthorized(err)) redirectToHome();
        /* 静默失败，保持占位骨架 */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!botInfo?.slug) {
    // bot 信息加载中的等高占位骨架，避免整卡突然弹出
    return <Skeleton className="h-40 rounded-xl border border-zinc-200" />;
  }

  return (
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
  );
}
