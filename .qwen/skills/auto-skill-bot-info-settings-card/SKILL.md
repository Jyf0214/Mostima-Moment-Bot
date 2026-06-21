---
name: bot-info-settings-card
description: 设置页面机器人信息卡片：API 端点 + 信息展示 + i18n 国际化
source: auto-skill
extracted_at: '2026-06-21T00:11:16.822Z'
---

# 机器人信息设置卡片

在仪表盘设置页面顶部显示机器人配置信息（slug、App ID、触发命令、安装链接）。

## 文件结构

```
src/pages/api/bot/info.ts          — API 端点
src/pages/dashboard.tsx            — SettingsPage 组件
src/i18n/locales/{zh,en}.json     — 翻译键
```

## 实现步骤

### 1. 创建 API 端点

```typescript
// src/pages/api/bot/info.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = process.env.GITHUB_APP_SLUG || '';
  const appId = process.env.GITHUB_APP_ID || '';

  return res.status(200).json({
    slug,
    appId,
    mention: slug ? `@${slug}` : '',
    fixCommand: slug ? `@${slug} /fix` : '',
    installUrl: slug ? `https://github.com/apps/${slug}/installations/new` : '',
  });
}
```

### 2. SettingsPage 组件

```typescript
// 状态
const [botInfo, setBotInfo] = useState<{
  slug: string; appId: string; mention: string;
  fixCommand: string; installUrl: string;
} | null>(null);

// 获取
useEffect(() => { fetchBotInfo(); }, []);
const fetchBotInfo = async () => {
  const res = await fetch('/api/bot/info');
  if (res.ok) setBotInfo(await res.json());
};

// 渲染（在 return 最顶部，privateKey 卡片之前）
{botInfo && botInfo.slug && (
  <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-5">
    <div className="flex items-center gap-3 mb-4">
      <Plug className="h-5 w-5 text-purple-400" />
      <h3 className="text-white font-medium">{t('settings.botInfo')}</h3>
    </div>
    <div className="space-y-3">
      {/* slug、appId、fixCommand、installUrl */}
    </div>
  </ProCard>
)}
```

### 3. i18n 翻译键

```json
{
  "settings": {
    "botInfo": "机器人信息",
    "botSlug": "App Slug",
    "botAppId": "App ID",
    "botMention": "Issue 触发命令",
    "botInstall": "安装链接"
  }
}
```

## 关键设计点

- API 无认证要求（只读公开配置）
- 卡片仅在 slug 配置存在时显示
- 代码高亮显示触发命令：`<code className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">`
- 安装链接外部跳转：`target="_blank" rel="noopener noreferrer"`
