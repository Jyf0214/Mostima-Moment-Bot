---
name: github-connectivity-test
description: GitHub App 连通性诊断：逐项检查环境、JWT、API 通信、安装状态、Webhook 配置的测试页面模式
source: auto-skill
extracted_at: '2026-06-20T13:28:34.287Z'
---

# GitHub App 连通性测试模式

## 概述

当 GitHub App 集成出现问题时，通过逐项诊断快速定位根因。模式包含：API 端点执行各项检查 + 前端页面展示结果。

## 诊断项清单

| 序号 | 检查项                        | 失败含义                    | 严重度 |
| ---- | ----------------------------- | --------------------------- | ------ |
| 1    | 环境变量完整性                | 缺少必要配置                | P0     |
| 2    | 私钥文件可读性 + PEM 格式     | 私钥路径错误或文件损坏      | P0     |
| 3    | JWT 生成                      | 私钥与 App ID 不匹配        | P0     |
| 4    | GitHub API 通信 (`/app` 端点) | App 身份验证失败            | P0     |
| 5    | Installation 状态 (数据库)    | 安装回调未执行              | P1     |
| 6    | 访问令牌获取                  | Installation 已失效         | P1     |
| 7    | 仓库列表获取                  | App 未被授予仓库权限        | P2     |
| 8    | Webhook Secret 配置           | 签名验证会失败              | P1     |
| 9    | APP_URL 协议                  | HTTP 环境下 Cookie 可能异常 | P2     |

## API 端点实现模式

```typescript
// src/pages/api/github/test.ts
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { generateJWT } from '@/lib/github/auth';
import i18n from '@/i18n';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  detail?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. 验证管理员身份（复用 auth_token）
  const JWT_SECRET = process.env.JWT_SECRET;
  const authToken = req.cookies.auth_token;
  if (!authToken || !JWT_SECRET) return res.status(401).json({ error: 'Not authenticated' });
  try {
    jwt.verify(authToken, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const t = i18n.t.bind(i18n);
  const results: TestResult[] = [];

  // 2. 逐项检查，每项 push 一个 TestResult
  // 环境变量 → 私钥 → JWT → API 通信 → Installation → 令牌 → 仓库 → Webhook → APP_URL

  return res.status(200).json({ results });
}
```

### 关键检查实现

**环境变量检查**：

```typescript
const envVars = ['GITHUB_APP_ID', 'GITHUB_APP_SLUG', 'GITHUB_PRIVATE_KEY_PATH', 'WEBHOOK_SECRET', ...];
const missing = envVars.filter((v) => !process.env[v.key]);
```

**私钥格式验证**：

```typescript
const content = fs.readFileSync(privateKeyPath, 'utf8');
if (!content.includes('BEGIN') || !content.includes('END')) {
  /* PEM 格式异常 */
}
```

**API 通信测试**：

```typescript
const appJwt = generateJWT(appId, privateKeyPath);
const response = await fetch('https://api.github.com/app', {
  headers: { Authorization: `Bearer ${appJwt}`, Accept: 'application/vnd.github.v3+json' },
});
if (response.ok) {
  /* 成功 */
} else {
  /* 失败，返回状态码 */
}
```

**访问令牌 + 仓库列表（级联测试）**：

```typescript
// 先获取令牌，成功后再测试仓库列表
const token = await getInstallationAccessToken(installationId);
const repos = await listInstallationRepos(token);
```

## 前端页面模式

```typescript
// src/pages/github-test.tsx
export default function GitHubTestPage() {
  const { t } = useTranslation();
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const runTests = useCallback(async () => {
    setRunning(true);
    const response = await fetch('/api/github/test');
    const data = await response.json();
    setResults(data.results);
    setRunning(false);
  }, []);

  // 渲染：汇总统计 + 逐项展示（pass/fail/warn 图标 + 消息 + 详情）
}
```

### UI 设计要点

- 使用项目 UI 组件库：`ProCard`、`StatusCard`、`Button`、`PageContainer`
- 三色状态汇总：绿色通过数 / 红色失败数 / 橙色警告数
- 每项结果带 `pass`/`fail`/`warn` 图标 + 消息 + 可折叠详情
- 全部通过时显示绿色成功横幅
- 支持手动重新测试按钮（带旋转动画）

## i18n 规范

所有面向用户的字符串必须通过 i18n：

- **API 路由**：`import i18n from '@/i18n'`，使用 `i18n.t('key', { param })`
- **前端页面**：`const { t } = useTranslation()`，使用 `t('key', { param })`
- 翻译文件：`src/i18n/locales/zh.json` 和 `en.json` 中添加 `githubTest` 命名空间
- i18n 合规测试会扫描 `src/` 下所有 `.ts`/`.tsx` 文件（排除 `__tests__`、`i18n/locales` 等），硬编码中文会导致测试失败

## 仪表盘集成

在仪表盘概览的快捷操作区添加入口：

```tsx
<button onClick={() => (window.location.href = '/github-test')}>
  <BarChart3 className="h-5 w-5 text-amber-400" />
  <p className="text-sm font-medium">{t('dashboard.testConnection')}</p>
  <p className="text-xs">{t('dashboard.testConnectionDesc')}</p>
</button>
```

## 使用场景

1. **新部署后验证**：确认所有环境变量、密钥、API 通信正常
2. **安装后检测**：验证 Installation 记录已创建且令牌可用
3. **Webhook 调试**：确认 Webhook Secret 配置正确
4. **故障排查**：逐项排除，快速定位问题环节

## 文件清单

| 文件                           | 用途                              |
| ------------------------------ | --------------------------------- |
| `src/pages/api/github/test.ts` | 测试 API 端点                     |
| `src/pages/github-test.tsx`    | 测试结果展示页面                  |
| `src/i18n/locales/zh.json`     | 中文翻译（`githubTest` 命名空间） |
| `src/i18n/locales/en.json`     | 英文翻译（`githubTest` 命名空间） |
