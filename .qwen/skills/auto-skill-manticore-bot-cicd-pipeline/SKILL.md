---
name: manticore-bot-cicd-pipeline
description: Pure deterministic CI/CD bot implementation with Next.js API Routes, GitHub webhooks, CI checks, PR reporting, and GitHub OAuth authentication
source: auto-skill
extracted_at: '2026-06-20T04:12:34.951Z'
---

# Manticore Bot CI/CD Pipeline Implementation

## Overview

Building a pure deterministic CI/CD bot (no AI/LLM) as a unified Next.js application that receives GitHub webhooks, executes CI checks, posts Vercel-style PR reports, and supports GitHub OAuth authentication.

## Architecture: Unified Next.js

All functionality runs in a single Next.js process on one port. No Express server.

```
Next.js 16 (Pages Router)
├── API Routes (Webhook / Auth / Health / Setup)
├── Proxy Middleware (认证检查)
├── Frontend Pages (Setup / Dashboard / Error)
└── i18n (中英文翻译)
```

## Key Files

```
src/pages/api/webhook/github.ts  # Webhook 接收端
src/pages/api/auth/login.ts      # GitHub OAuth 登录
src/pages/api/auth/callback.ts   # OAuth 回调
src/pages/api/auth/me.ts         # 获取当前用户
src/pages/api/auth/logout.ts     # 登出
src/pages/api/auth/status.ts     # 检查应用状态
src/pages/api/setup.ts           # 初始设置 API
src/pages/api/init.ts            # 数据库初始化
src/pages/api/env-check.ts       # 环境变量检查
src/pages/api/health.ts          # 健康检查
src/proxy.ts                     # Next.js 16 proxy (middleware)
src/lib/github/webhook.ts        # HMAC-SHA256 签名验证
src/lib/github/auth.ts           # JWT 认证
src/lib/github/api.ts            # GitHub API (原生 fetch)
src/lib/ci/runner.ts             # CI 流程执行器
src/lib/ci/checks.ts             # 质量卡口校验
src/lib/ci/reporter.ts           # PR 报告生成
src/lib/git/workspace.ts         # Git 工作区协调
src/lib/crypto.ts                # AES-256-GCM 加密
src/lib/db.ts                    # 数据库操作 (Prisma)
src/lib/prisma.ts                # Prisma 客户端
```

## Webhook Body Parsing

Next.js API Routes require manual raw body parsing for webhook signature verification:

```typescript
export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks);
  // Use rawBody for HMAC-SHA256 verification
}
```

## GitHub API Without Octokit

Avoid octokit ESM compatibility issues by using native fetch:

```typescript
// ✅ Use native fetch API
const response = await fetch('https://api.github.com/repos/...', {
  headers: { Authorization: `Bearer ${token}` },
});
```

## Standalone Docker Output

```javascript
// next.config.js
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@tabler/icons-react', '@mantine/core', '@mantine/hooks'],
  },
};
module.exports = nextConfig;
```

## Dockerfile (Next.js Standalone)

```dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY prisma/ ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# Copy static files to standalone
RUN cp -r .next/static .next/standalone/.next/static
RUN if [ -d "public" ]; then cp -r public .next/standalone/public; fi

RUN npm prune --omit=dev

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
EXPOSE ${PORT}

CMD ["sh", "-c", "node .next/standalone/server.js"]
```

**Key**: Use `node .next/standalone/server.js` instead of `npm start` for standalone mode. `npm start` doesn't support `-p` flag with standalone output.

## GitHub OAuth Authentication Flow

### 1. First User Becomes Admin

```typescript
const isNew = await isNewApplication();
let admin = await getAdmin(userData.id);

if (isNew && !admin) {
  admin = await createAdmin(userData.id, userData.login, userData.avatar_url);
} else if (!admin) {
  await discardNonAdminData(userData.id);
  return res.status(403).json({ error: i18n.t('api.unauthorized') });
}
```

### 2. Encrypted Private Key Storage

```typescript
// AES-256-GCM encryption
export function encrypt(data: string, password: string): string {
  const salt = crypto.randomBytes(64);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}
```

## Database Schema (Prisma)

```prisma
model Admin {
  id          Int      @id @default(autoincrement())
  githubId    Int      @unique
  githubLogin String   @unique @map("github_login")
  avatarUrl   String?  @map("avatar_url")
  createdAt   DateTime @default(now()) @map("created_at")
  lastLogin   DateTime @default(now()) @map("last_login")
}

model WebhookConfig {
  id                    Int      @id @default(autoincrement())
  appId                 String   @map("app_id")
  webhookSecretEncrypted String @map("webhook_secret_encrypted")
  privateKeyEncrypted   String   @map("private_key_encrypted")
  repoOwner             String   @map("repo_owner")
  repoName              String   @map("repo_name")
  isActive              Boolean  @default(true) @map("is_active")
}
```

## Test Coverage

- **Crypto module**: 8 test cases
- **JWT authentication**: 4 test cases
- **PR reporter**: 3 test cases
- **Database operations**: 6 test cases
- **Auth flow**: 7 test cases
- **Encryption storage**: 5 test cases
- **i18n compliance**: 3 test cases
- **UI compliance**: 26 test cases
- **Prisma enforcement**: 2 test cases
- **Cookie utilities**: 16 test cases
- **GitHub auth (getAppId/getPrivateKey/generateJWT)**: 12 test cases
- **Webhook installation events**: 7 test cases
- **Private key API**: 9 test cases

**Total: 108 test cases, all passing**

## Environment Variables

```env
# Required
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
DATABASE_URL=postgresql://user:pass@localhost:5432/manticore

# Optional
PORT=3001
GITHUB_APP_ID=your_app_id
GITHUB_WEBHOOK_SECRET=your_webhook_secret
REPO_OWNER=your_username
REPO_NAME=your_repo
WEBHOOK_SECRET=your_webhook_secret
PUBLIC_URL=https://your-domain.com
COLLABORATORS=user1,user2
```
