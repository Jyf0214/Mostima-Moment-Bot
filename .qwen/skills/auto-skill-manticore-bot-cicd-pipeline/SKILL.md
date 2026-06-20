---
name: manticore-bot-cicd-pipeline
description: Pure deterministic CI/CD bot implementation with Express, GitHub webhooks, CI checks, and PR reporting
source: auto-skill
extracted_at: '2026-06-20T01:28:58.122Z'
---

# Manticore Bot CI/CD Pipeline Implementation

## Overview
Building a pure deterministic CI/CD bot (no AI/LLM) as an independent Express server that receives GitHub webhooks, executes CI checks, and posts Vercel-style PR reports.

## Architecture Decision: Express vs Next.js API Routes

**Key learning**: For a standalone Docker deployment, use Express server, NOT Next.js API routes.

- Next.js API routes only execute within Next.js runtime
- Standalone Docker requires explicit server entry point
- Express provides clearer separation between frontend (Vercel) and bot (Docker)

## Project Structure

```
src/
├── server.ts                    # Express server entry point
├── routes/
│   └── webhook.ts               # Webhook route handler
├── lib/
│   ├── github/
│   │   ├── webhook.ts           # HMAC-SHA256 signature verification
│   │   ├── auth.ts              # JWT authentication
│   │   └── api.ts               # GitHub API wrapper
│   ├── ci/
│   │   ├── runner.ts            # CI pipeline executor
│   │   ├── checks.ts            # Quality gate checks
│   │   └── reporter.ts          # PR report generator
│   └── git/
│       └── workspace.ts         # Git workspace coordination
├── types/
│   └── express.d.ts             # Express type extensions
└── pages/                       # Next.js frontend (Vercel deployment)
```

## Key Implementation Patterns

### 1. Express Server Entry Point
```typescript
// src/server.ts
import express from 'express';
import { webhookRouter } from './routes/webhook';

const app = express();
const PORT = process.env.BOT_PORT || 3001;

// Middleware: parse JSON and preserve raw body for signature verification
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use('/api/webhook', webhookRouter);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Manticore Bot running on port ${PORT}`);
});
```

### 2. GitHub Webhook Signature Verification (Node.js built-in crypto)
```typescript
// src/lib/github/webhook.ts
import crypto from 'crypto';

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Important**: Use Node.js built-in `crypto`, NOT `crypto-js` (minimal dependencies principle).

### 3. Express Type Extension for rawBody
```typescript
// src/types/express.d.ts
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export {};
```

### 4. CI Check Execution with Fail-Fast
```typescript
// src/lib/ci/runner.ts
export async function runCIChecks(): Promise<CheckResult[]> {
  const steps = [
    { name: 'Dependencies', command: 'npm ci' },
    { name: 'Lint', command: 'npm run lint' },
    { name: 'TypeScript', command: 'npx tsc --noEmit' },
    { name: 'Build', command: 'npm run build' },
  ];

  const results: CheckResult[] = [];
  
  for (const step of steps) {
    const result = executeCheckStep(step.name, step.command, workspaceDir);
    results.push(result);

    // Fail-fast: mark remaining steps as SKIP
    if (result.status === 'FAIL') {
      const remaining = steps.slice(steps.indexOf(step) + 1);
      for (const r of remaining) {
        results.push({ step: r.name, status: 'SKIP', duration: 0, exitCode: -1 });
      }
      break;
    }
  }
  return results;
}
```

### 5. Vercel-Style PR Report
```typescript
// src/lib/ci/reporter.ts
export function generatePRReport(prNumber: number, results: CheckResult[]): string {
  const rows = results.map(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '➖';
    return `| **${r.step}** | ${icon} ${r.status} | ${r.output || '-'} |`;
  }).join('\n');

  return `
### 🔍 Manticore Build & Check Report (PR #${prNumber})

| Check Category | Status | Details |
| :--- | :---: | :--- |
${rows}

---
*Generated automatically by Manticore Bot.*
`.trim();
}
```

## TypeScript Configuration

### Server TypeScript Config (tsconfig.server.json)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/server.ts", "src/routes/**/*", "src/lib/**/*", "src/types/**/*"],
  "exclude": ["node_modules", "dist", "src/pages/**/*"]
}
```

### package.json Scripts
```json
{
  "scripts": {
    "server:dev": "tsx watch src/server.ts",
    "server:build": "tsc --project tsconfig.server.json",
    "server:start": "node dist/server.js"
  }
}
```

## Docker Configuration

### Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY src/ ./src/
COPY tsconfig.server.json ./
RUN npx tsc --project tsconfig.server.json

RUN mkdir -p /app/workspace
EXPOSE 3001

CMD ["node", "dist/server.js"]
```

### Environment Variables
```env
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY_PATH=/app/private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret
REPO_OWNER=your_username
REPO_NAME=your_repo
WEBHOOK_SECRET=your_webhook_secret
BOT_PORT=3001
WORKSPACE_DIR=/app/workspace
PUBLIC_URL=https://your-domain.com
COLLABORATORS=user1,user2
```

## Common Pitfalls and Fixes

### 1. rawBody Type Error
**Problem**: `Property 'rawBody' does not exist on type 'Request'`
**Fix**: Create `src/types/express.d.ts` to extend Express Request type.

### 2. Buffer undefined Check
**Problem**: `Argument of type 'Buffer | undefined' is not assignable to parameter of type 'Buffer'`
**Fix**: Add null check: `if (!req.rawBody || !verifyWebhookSignature(...))`

### 3. Next.js API Routes vs Express
**Problem**: Next.js API routes only work within Next.js runtime
**Fix**: Use standalone Express server for Docker deployment, keep Next.js for frontend only.

### 4. Crypto Library Choice
**Problem**: Using `crypto-js` adds unnecessary dependency
**Fix**: Use Node.js built-in `crypto` module for HMAC-SHA256.

## Docker 自动构建工作流

### GitHub Actions 配置
```yaml
# .github/workflows/docker-build.yml
name: Docker 构建与推送

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3

      - name: 登录 GitHub Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: 提取元数据
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha

      - name: 构建并推送
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          platforms: linux/amd64,linux/arm64
```

### 使用方式
```bash
# 拉取镜像
docker pull ghcr.io/jyf0214/mostima-moment-bot:main

# 运行容器
docker run -d -p 3001:3001 \
  -e GITHUB_APP_ID=xxx \
  -e GITHUB_WEBHOOK_SECRET=xxx \
  ghcr.io/jyf0214/mostima-moment-bot:main
```

## Verification Checklist

### Signature Verification
```bash
PAYLOAD='{"action":"opened"}'
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "test_secret" | awk '{print $2}')"

curl -X POST http://localhost:3001/api/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$PAYLOAD"
# Expected: 200 OK
```

### Invalid Signature Rejection
```bash
curl -X POST http://localhost:3001/api/webhook/github \
  -H "Content-Type: application/json" \
  -d '{"action":"opened"}'
# Expected: 401 Unauthorized
```

### Health Check
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"manticore-bot"}
```
