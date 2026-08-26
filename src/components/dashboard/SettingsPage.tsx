'use client';

import { BotInfoCard } from '@/components/dashboard/settings/BotInfoCard';
import { PrivateKeyCard } from '@/components/dashboard/settings/PrivateKeyCard';
import { SiteAppearanceCard } from '@/components/dashboard/settings/SiteAppearanceCard';
import { DbModeCard } from '@/components/dashboard/settings/DbModeCard';
import { QwenCliCard } from '@/components/dashboard/settings/QwenCliCard';
import { QwenSettingsCard } from '@/components/dashboard/settings/QwenSettingsCard';

/**
 * 设置页编排层：只负责按顺序组合各自治配置卡片。
 * 每张卡片自带数据获取、操作反馈与错误处理，互不依赖；
 * 此前 660+ 行单文件塞下全部状态（含 4 对重复的 msg/msgType）已成维护负担。
 */
export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <BotInfoCard />
      <PrivateKeyCard />
      <SiteAppearanceCard />
      <DbModeCard />
      <QwenCliCard />
      <QwenSettingsCard />
    </div>
  );
}
