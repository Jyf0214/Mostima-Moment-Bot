---
name: github-app-installation-flow
description: GitHub App 安装流程实现：CSRF 防护、数据库模型、Webhook 事件处理、API 端点、部署兼容性、私钥数据库存储
source: auto-skill
extracted_at: '2026-06-20T15:00:00.000Z'
---

# GitHub App 安装流程实现

## 概述

实现 GitHub App 安装功能的完整模式：用户点击安装 → CSRF state 防护 → 跳转 GitHub → 回调存储 → 仪表盘展示仓库。

## 架构设计

### 安全流程

```
用户点击 "安装" → 生成随机 state → 存入 HttpOnly cookie (600s)
→ 重定向到 GitHub 安装页面
→ GitHub 回调: /api/github/callback?installation_id=xxx&state=xxx
→ 校验 state 匹配 → 校验 auth_token 管理员身份
→ 通过 GitHub API 获取安装详情 → 存入数据库
→ 重定向到仪表盘?install=success
```

### 安全要求

1. **CSRF 防护**：安装发起时生成 `crypto.randomUUID()` state，存入 HttpOnly cookie
2. **身份绑定**：从 `auth_token` JWT 提取 `githubId`，关联到 installation 记录
3. **中间件白名单**：`/api/github/callback` 必须加入 publicPaths（从 GitHub 重定向回来时无 auth_token）
4. **State 校验**：回调时比较 `query.state === cookie state`，不匹配则拒绝

## 数据库模型

```prisma
model GitHubInstallation {
  id             Int      @id @default(autoincrement())
  installationId Int      @unique @map("installation_id")
  accountLogin   String   @map("account_login")
  accountType    String   @map("account_type")    // "User" 或 "Organization"
  accountId      Int      @map("account_id")
  avatarUrl      String?  @map("avatar_url")
  adminId        Int      @map("admin_id")
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  admin Admin @relation(fields: [adminId], references: [id])

  @@map("github_installations")
}
```

Admin 模型需添加关联：

```prisma
installations GitHubInstallation[]
```

## API 端点设计

### 1. GET /api/github/install — 安装入口

```typescript
// 生成 CSRF state
const state = crypto.randomUUID();
res.setHeader(
  'Set-Cookie',
  `github_install_state=${state}; Path=/api/github; HttpOnly; SameSite=Lax; Max-Age=600; Secure`
);
// 重定向到 GitHub
res.redirect(`https://github.com/apps/${SLUG}/installations/new?state=${state}`);
```

### 2. GET /api/github/callback — 安装回调

```typescript
// 1. 校验 CSRF state
const cookieState = req.cookies.github_install_state;
if (!cookieState || cookieState !== state) { /* 拒绝 */ }

// 2. 校验管理员身份（从 JWT 提取 githubId）
const decoded = jwt.verify(authToken, JWT_SECRET) as JwtPayload;
const admin = await prisma.admin.findUnique({ where: { githubId: decoded.githubId } });

// 3. 通过 GitHub API 获取安装详情
const appJwt = generateJWT(appId, privateKeyPath);
const response = await fetch(`https://api.github.com/app/installations/${installId}`, {
  headers: { Authorization: `Bearer ${appJwt}` }
});

// 4. 存储 installation 记录
await prisma.gitHubInstallation.create({ data: { installationId, accountLogin, ... } });
```

### 3. GET /api/github/repos — 列出授权仓库

使用 installation access token 调用 `GET https://api.github.com/installation/repositories`，按 `owner.type` 分组为个人/组织仓库。

### 4. GET /api/github/installations — 已安装列表

查询当前管理员关联的所有活跃安装记录。

## 核心逻辑模块

### src/lib/github/installation.ts

```typescript
// 获取 installation access token
export async function getInstallationAccessToken(installationId: number): Promise<string>;

// 列出安装授权的仓库（分页 + 按账户类型分组）
export async function listInstallationRepos(accessToken: string): Promise<{
  personal: GitHubRepo[];
  organization: GitHubRepo[];
}>;

// 获取安装页面 URL
export function getInstallationUrl(state: string): string;
```

## 仪表盘 UI 模式

### 三态展示

| 状态       | 展示                                     |
| ---------- | ---------------------------------------- |
| App 未配置 | 黄色提示卡片（联系管理员配置环境变量）   |
| 未安装     | 安装引导卡片 + "前往 GitHub 安装" 按钮   |
| 已安装     | 账户信息卡片 + 仓库列表（个人/组织分组） |

### 安装结果反馈

从 URL 参数读取安装结果：

```typescript
const params = new URLSearchParams(window.location.search);
const install = params.get('install');
if (install === 'success') {
  /* 显示成功提示 */
}
// 读取后清除参数
window.history.replaceState({}, '', '/dashboard');
```

## 环境变量

| 变量                      | 必需 | 用途                                |
| ------------------------- | ---- | ----------------------------------- |
| `GITHUB_APP_ID`           | 是   | GitHub App ID（JWT 签发）           |
| `GITHUB_PRIVATE_KEY_PATH` | 是   | 私钥文件路径（JWT 签发）            |
| `GITHUB_APP_SLUG`         | 是   | GitHub App URL slug（生成安装链接） |

**降级行为**：未配置 `GITHUB_APP_SLUG` 时，`/api/github/install` 返回 500，仪表盘显示 "GitHub App 未配置" 提示。

### 仓库列表与配置状态

repos API 返回每个仓库的 `enabled` 状态（从 RepoConfig 模型读取）：

```typescript
// repos API 中附加 config 状态
const configMap = new Map<number, boolean>();
for (const cfg of admin.repoConfigs) {
  configMap.set(cfg.repoId, cfg.enabled);
}

allPersonal.push(
  ...repos.personal.map((r) => ({
    ...r,
    enabled: configMap.get(r.id) ?? false,
  }))
);
```

### 仓库开关 Toggle

新增 `/api/github/repos/toggle` 端点：

```typescript
// POST /api/github/repos/toggle
// Body: { repoId, repoFullName, repoOwner, repoName }

const existing = await prisma.repoConfig.findUnique({
  where: { repoId_adminId: { repoId, adminId: admin.id } },
});

if (existing) {
  // 切换状态
  const updated = await prisma.repoConfig.update({
    where: { id: existing.id },
    data: { enabled: !existing.enabled },
  });
  enabled = updated.enabled;
} else {
  // 创建新配置（默认启用）
  await prisma.repoConfig.create({ data: { repoId, repoFullName, ... } });
  enabled = true;
}
```

**UI 交互**：乐观更新 + 失败回滚。开关使用 `role="switch"` + `aria-checked` 无障碍属性。

### 仓库详情页面

`/dashboard/repo?repoId=xxx&name=xxx` — 详情配置页面，当前为 TODO 占位（CI/CD 配置、触发规则、Webhook 设置三个区块）。

## 关键 Bug 修复记录

### Bug 1: Cookie `Secure` 标志导致 HTTP 环境下 state 校验失败（P0）

**现象**：`Invalid state parameter` 错误，OAuth 登录和安装回调均失败。

**根因**：Cookie 设置了 `Secure` 标志，HTTP 环境下浏览器拒绝存储/发送带 `Secure` 的 cookie，导致 `req.cookies.github_install_state` 为 `undefined`。

**修复**：提取 `src/lib/cookie.ts` 工具函数，根据 `APP_URL` 协议动态决定 `Secure` 标志：

```typescript
// src/lib/cookie.ts
function isSecureProtocol(): boolean {
  return process.env.APP_URL?.startsWith('https') ?? false;
}

export function setCookie(name: string, value: string, options?: {...}): string {
  const parts = [`${name}=${value}`, `Path=${path}`, `Max-Age=${maxAge}`, `SameSite=Lax`];
  if (httpOnly) parts.push('HttpOnly');
  if (isSecureProtocol()) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(name: string, options?: {...}): string {
  return setCookie(name, '', { ...options, maxAge: 0 });
}
```

所有 cookie 设置点统一使用 `setCookie()` / `clearCookie()`，禁止硬编码 `Secure`。

### Bug 2: Callback URL 未配置导致安装后永远检测不到（P0）

**现象**：用户安装成功但仪表盘永远显示"未安装"。

**根因**：文档错误指导"Callback URL 留空"。GitHub App 安装完成后依赖 Callback URL 重定向回应用（带 `installation_id` 和 `state` 参数）。留空则重定向到 Homepage URL，`/api/github/callback` 永远不会被调用，`GitHubInstallation` 记录永远不会创建。

**修复**：

- `GITHUB_APP_SETUP.md` 中 Callback URL 必须配置为 `https://your-domain.com/api/github/callback`
- 本地开发时为 `http://localhost:3001/api/github/callback`

### Bug 3: Webhook 签名验证使用了错误的环境变量（P0）

**现象**：所有 Webhook 请求返回 401 `Invalid signature`。

**根因**：`src/pages/api/webhook/github.ts` 使用 `process.env.ENCRYPTION_KEY` 验证 HMAC-SHA256 签名，但 GitHub App 配置的是独立的 Webhook Secret。

**修复**：优先使用 `ENCRYPTION_KEY`，未配置时回退到 `ENCRYPTION_KEY`（兼容只配置了一个密钥的部署环境）：

```typescript
const secret = process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
```

`.env.example` 必须包含 `ENCRYPTION_KEY` 变量说明。

### Bug 4: Webhook 缺少 `installation` 事件处理（P0）

**现象**：GitHub App 安装成功，日志显示 `Unhandled event: installation`，仪表盘永远显示"尚未安装"。

**根因**：Webhook 的 switch-case 只处理了 `pull_request`、`issue_comment`、`workflow_run`，缺少 `installation` 分支。GitHub 在 App 被安装时发送 `installation` 事件，这是创建 `GitHubInstallation` 记录的**主要途径**（Callback URL 回调是次要途径，且依赖正确的 Callback URL 配置）。

**修复**：在 webhook 处理器中添加 `installation` 事件处理：

```typescript
case 'installation': {
  const installPayload = payload as unknown as InstallationPayload;
  const { action, installation } = installPayload;

  if (action === 'created' || action === 'reopened') {
    const admin = await prisma.admin.findFirst();
    if (!admin) break;

    const existing = await prisma.gitHubInstallation.findUnique({
      where: { installationId: installation.id },
    });

    if (existing) {
      await prisma.gitHubInstallation.update({
        where: { installationId: installation.id },
        data: { isActive: true, adminId: admin.id },
      });
    } else {
      await prisma.gitHubInstallation.create({
        data: {
          installationId: installation.id,
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          accountId: installation.account.id,
          avatarUrl: installation.account.avatar_url,
          adminId: admin.id,
        },
      });
    }
  } else if (action === 'deleted' || action === 'suspend') {
    await prisma.gitHubInstallation.updateMany({
      where: { installationId: installation.id },
      data: { isActive: false },
    });
  }
  break;
}
```

**Payload 接口**：

```typescript
interface InstallationPayload {
  action: string; // 'created' | 'deleted' | 'reopened' | 'suspend'
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
      type: string; // 'User' | 'Organization'
      avatar_url: string;
    };
  };
}
```

**关键点**：

- `installation` 事件是安装记录创建的**主路径**，Callback URL 回调是**备用路径**
- 即使 Callback URL 配置错误，只要 Webhook 可达，安装记录就能正确创建
- `deleted`/`suspend` 事件应标记为非活跃而非删除，保留历史数据

### Bug 5: Auth Callback 误接收安装回调参数（P1）

**现象**：GitHub App 的 Callback URL 被错误设置为 `/api/auth/callback`，安装完成后 URL 变为 `/api/auth/callback?installation_id=xxx&setup_action=install&state=xxx`，触发 `Invalid state parameter`。

**根因**：用户在 GitHub App 设置中将 Callback URL 配置为 OAuth 回调地址而非安装回调地址。

**修复**：在 `/api/auth/callback` 中检测 `installation_id` 参数，自动重定向到正确的 `/api/github/callback`：

```typescript
const { code, state, installation_id, setup_action } = req.query;

if (installation_id && setup_action === 'install') {
  const params = new URLSearchParams();
  params.set('installation_id', String(installation_id));
  if (state) params.set('state', String(state));
  return res.redirect(`/api/github/callback?${params.toString()}`);
}
```

**注意**：此重定向依赖 `github_install_state` cookie 的存在。如果 Callback URL 配置错误导致用户从未经过 `/api/github/install`，cookie 不存在，重定向后仍会因 state 校验失败。此时只能通过 webhook `installation` 事件来创建记录。

## 部署兼容性注意事项

### 安装记录创建的两条路径

| 路径                        | 触发条件                     | 依赖                                           |
| --------------------------- | ---------------------------- | ---------------------------------------------- |
| Webhook `installation` 事件 | GitHub App 被安装/卸载       | Webhook URL 可达 + 签名验证通过                |
| Callback URL 回调           | GitHub 重定向到 Callback URL | Callback URL 正确配置 + CSRF state cookie 存在 |

**建议**：优先确保 Webhook 路径可靠，因为 Callback URL 路径容易因配置错误而失败。

### HuggingFace Spaces / Vercel 等平台

1. **Callback URL**：必须设置为 `https://your-domain/api/github/callback`
2. **Webhook URL**：必须可从外网访问
3. **Webhook Secret**：如果只配置了 `ENCRYPTION_KEY`，代码会自动回退使用
4. **HTTPS 环境**：Cookie `Secure` 标志自动启用

## 部署环境关键修复（实战经验）

### 修复 1：Cookie Secure 标志自适应

**问题**：HTTP 环境下浏览器拒绝存储带 `Secure` 标志的 cookie，导致 CSRF state 丢失。

**修复**：提取 `src/lib/cookie.ts` 工具函数，根据 `APP_URL` 协议动态决定：

```typescript
// src/lib/cookie.ts
function isSecureProtocol(): boolean {
  return process.env.APP_URL?.startsWith('https') ?? false;
}

export function setCookie(name: string, value: string, options = {}) {
  const parts = [`${name}=${value}`, `Path=${path}`, `Max-Age=${maxAge}`, `SameSite=Lax`];
  if (httpOnly) parts.push('HttpOnly');
  if (isSecureProtocol()) parts.push('Secure');
  return parts.join('; ');
}
```

**应用点**：所有 `Set-Cookie` 头（`install.ts`、`login.ts`、`callback.ts`）统一使用此函数。

### 修复 2：Webhook 签名回退

**问题**：部署环境可能只配置了 `ENCRYPTION_KEY` 而没有 `ENCRYPTION_KEY`。

**修复**：webhook 处理器优先使用 `ENCRYPTION_KEY`，回退到 `ENCRYPTION_KEY`：

```typescript
const secret = process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
```

### 修复 3：installation 事件处理

**问题**：webhook switch-case 缺少 `installation` 事件分支，安装后 `GitHubInstallation` 记录不创建。

**修复**：在 webhook 处理器中添加：

```typescript
case 'installation': {
  const { action, installation } = payload as InstallationPayload;
  if (action === 'created' || action === 'reopened') {
    const admin = await prisma.admin.findFirst();
    await prisma.gitHubInstallation.upsert({
      where: { installationId: installation.id },
      create: { installationId: installation.id, accountLogin: installation.account.login, ... },
      update: { isActive: true },
    });
  }
  break;
}
```

### 修复 4：安装回调重定向

**问题**：GitHub App 的 Callback URL 被错误设置为 `/api/auth/callback`，安装完成后重定向到错误端点。

**修复**：`/api/auth/callback` 检测 `installation_id` 参数并重定向：

```typescript
if (installation_id && setup_action === 'install') {
  return res.redirect(`/api/github/callback?installation_id=${installation_id}&state=${state}`);
}
```

### 修复 5：私钥数据库存储

**问题**：私钥通过网页上传存储在数据库，但 `generateJWT()` 只从文件读取。

**修复**：统一获取函数，三级回退：

```typescript
// src/lib/github/auth.ts
export async function getPrivateKey(): Promise<string> {
  // 1. 环境变量文件
  if (process.env.GITHUB_PRIVATE_KEY_PATH) {
    try { return fs.readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH, 'utf8'); } catch {}
  }
  // 2. AppConfig 表（网页上传）
  const appKey = await getConfig('github_private_key');
  if (appKey) return appKey;
  // 3. WebhookConfig 表
  const whConfig = await getDecryptedWebhookConfig();
  if (whConfig?.privateKey) return whConfig.privateKey;
  throw new Error('Private key not configured');
}

export async function getAppId(): Promise<string> {
  return process.env.GITHUB_APP_ID
    || await getConfig('github_app_id')
    || (await getDecryptedWebhookConfig())?.appId
    || throw new Error('GITHUB_APP_ID not configured');
}
```

**上传端点**：`/api/github/private-key`（POST 上传 .pem，GET 检查状态）。

## 注意事项

### 常见问题

### 安装后回调 403

- 检查 `/api/github/callback` 是否在 middleware publicPaths 中
- 检查 CSRF state cookie 是否过期（600s TTL）
- 检查 auth_token 是否有效
- **检查 Callback URL 是否正确配置**（必须指向 `/api/github/callback`）

### 安装后检测不到安装状态

- **首先检查 Callback URL**：GitHub App 设置中 Callback URL 必须配置
- 检查 Cookie 的 `Secure` 标志是否与协议匹配（HTTP 环境不能有 Secure）
- 检查 `/api/github/callback` 是否正常执行（查看服务端日志）

### 仓库列表为空

- 检查 GitHub App 的权限设置（需要 `repository` 权限）
- 检查 installation access token 是否过期
- 检查 GitHub API 分页是否完整

### 安装详情获取失败

- GitHub App 的 private key 可能无效
- `GITHUB_APP_ID` 可能不匹配
- 网络问题导致 API 调用失败（降级存储 installation，账户信息为 "unknown"）

### Webhook 签名验证失败

- 确认使用 `ENCRYPTION_KEY` 而非 `ENCRYPTION_KEY`
- 确认 `.env` 中的 `ENCRYPTION_KEY` 与 GitHub App 设置中的 Webhook secret 一致
- **部署环境**：代码会自动回退到 `ENCRYPTION_KEY`（如果 `ENCRYPTION_KEY` 未配置）
- 使用连通性测试页面 `/github-test` 验证配置

### 仓库列表为空（安装成功后）

- **首先检查**：webhook 是否处理了 `installation` 事件（查看服务端日志）
- 检查 `GitHubInstallation` 表是否有记录
- 检查私钥是否已上传（仪表盘 → 设置）
- 检查 `GITHUB_APP_ID` 是否配置（环境变量或数据库）

---

## Webhook 事件完整处理模式

### 事件类型一览

| 事件            | 处理方式                                 | 阻塞响应                  |
| --------------- | ---------------------------------------- | ------------------------- |
| `installation`  | 创建/更新/删除 `GitHubInstallation` 记录 | 否（直接处理）            |
| `pull_request`  | CI 流程 + 安全审计                       | **否**（fire-and-forget） |
| `issue_comment` | Issue 自动修复 + 重试逻辑                | 否（fire-and-forget）     |
| `workflow_run`  | 构建状态跟踪                             | 否                        |
| `push`          | 记录日志（分支、commit SHA）             | 否                        |
| `workflow_job`  | 记录日志（job 名称、状态）               | 否                        |
| `issues`        | Issue 自动修复                           | 否（fire-and-forget）     |

### Fire-and-Forget 模式（关键）

**问题**：GitHub webhook 有 10 秒超时限制。如果 `await handlePullRequest()` 同步等待 CI 流程完成（可能耗时数分钟），GitHub 会重发 webhook，导致重复触发。

**修复**：所有耗时操作使用 `.catch()` fire-and-forget 模式：

```typescript
// ✅ 正确：不阻塞响应
handlePullRequest(prPayload as unknown as PRPayload).catch((err) => {
  console.error(`CI pipeline failed:`, err);
});

// ❌ 错误：阻塞响应
await handlePullRequest(prPayload as unknown as PRPayload);
```

### Webhook Payload 类型定义

```typescript
interface InstallationPayload {
  action: string; // 'created' | 'deleted' | 'reopened' | 'suspend'
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
      type: string; // 'User' | 'Organization'
      avatar_url: string;
    };
  };
}

interface PushPayload {
  ref: string;
  head_commit: { id: string; message: string } | null;
  repository: { full_name: string };
}

interface WorkflowJobPayload {
  action: string;
  workflow_job: { id: number; name: string; status: string; conclusion: string | null };
  repository: { full_name: string };
}
```

### 签名验证安全加固

**问题**：`crypto.timingSafeEqual` 在两个 Buffer 长度不同时抛出 `RangeError`，导致返回 500 而非 401，破坏时序安全设计。

**修复**：先检查 buffer 长度：

```typescript
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  // 长度不一致时直接返回 false，避免 RangeError
  if (sigBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}
```

### 私钥数据库存储与三级回退

**问题**：私钥通过网页上传存储在数据库，但 `generateJWT()` 只从文件读取。

**修复**：统一获取函数，三级回退：

```typescript
// src/lib/github/auth.ts
export async function getPrivateKey(): Promise<string> {
  // 1. 环境变量文件（GITHUB_PRIVATE_KEY_PATH）
  const keyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (keyPath) {
    try {
      return fs.readFileSync(keyPath, 'utf8');
    } catch {}
  }
  // 2. AppConfig 表（网页上传的私钥）
  const appKey = await getConfig('github_private_key');
  if (appKey) return appKey;
  // 3. WebhookConfig 表（旧版存储）
  const whConfig = await getDecryptedWebhookConfig();
  if (whConfig?.privateKey) return whConfig.privateKey;
  throw new Error('Private key not configured');
}

export async function getAppId(): Promise<string> {
  return (
    process.env.GITHUB_APP_ID ||
    (await getConfig('github_app_id')) ||
    (await getDecryptedWebhookConfig())?.appId ||
    (() => {
      throw new Error('GITHUB_APP_ID not configured');
    })()
  );
}
```

**上传端点**：`/api/github/private-key`

- GET：检查私钥配置状态（`configured` + `source`）
- POST：上传 .pem 文件（PEM 格式验证 + JWT 生成测试）

### CSRF State 生成安全

**问题**：OAuth state 使用 `Math.random()` 生成（可预测），安装 state 使用 `crypto.randomUUID()`（加密安全）。

**修复**：统一使用 `crypto.randomUUID()`：

```typescript
// ✅ 加密安全
const state = crypto.randomUUID();

// ❌ 可预测
const state = Buffer.from(
  JSON.stringify({
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2),
  })
).toString('base64');
```
