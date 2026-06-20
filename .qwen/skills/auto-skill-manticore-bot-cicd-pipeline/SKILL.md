---
name: manticore-bot-cicd-pipeline
description: Pure deterministic CI/CD bot implementation with Next.js API Routes, GitHub webhooks, CI checks, PR reporting, and GitHub OAuth authentication
source: auto-skill
extracted_at: '2026-06-20T04:00:00.000Z'
---

# Manticore Bot CI/CD Pipeline Implementation

## Overview

Building a pure deterministic CI/CD bot (no AI/LLM) as an independent Express server that receives GitHub webhooks, executes CI checks, posts Vercel-style PR reports, and supports GitHub OAuth authentication.

## Architecture Decision: Express → Next.js API Routes

**Key learning**: Consolidate Express server into Next.js API Routes for unified single-port deployment.

- Initial approach: Standalone Express server on separate port
- Problem: Users expected unified service, two ports confusing
- Solution: Migrate all Express routes to Next.js API Routes
- Benefit: Single `npm run dev` starts everything, one port, one process

### Express → Next.js Migration

```typescript
// ❌ Express route (src/routes/webhook.ts)
import { Router } from 'express';
export const webhookRouter = Router();
webhookRouter.post('/github', async (req, res) => { ... });

// ✅ Next.js API Route (src/pages/api/webhook/github.ts)
import { NextApiRequest, NextApiResponse } from 'next';
export const config = { api: { bodyParser: false } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Parse raw body for signature verification
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks);
  // ... rest of handler
}
```

### Webhook Body Parsing

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

### GitHub API Without Octokit

Avoid octokit ESM compatibility issues by using native fetch:

```typescript
// ❌ octokit has ESM/CJS compatibility issues
import { Octokit } from 'octokit';
const octokit = new Octokit({ auth: jwt });

// ✅ Use native fetch API
const response = await fetch('https://api.github.com/repos/...', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Standalone Docker Output

```javascript
// next.config.js
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Required for Docker deployment
};
module.exports = nextConfig;
```

### Dockerfile for Next.js Standalone

```dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY prisma/ ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

RUN npm prune --omit=dev

EXPOSE 3001
ENV PORT=3001

CMD ["npm", "start"]
```

## Project Structure (Unified Next.js)

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
│   ├── git/
│   │   └── workspace.ts         # Git workspace coordination
│   ├── crypto.ts                # AES-256-GCM encryption
│   ├── db.ts                    # Database operations (Prisma)
│   └── prisma.ts                # Prisma client
├── types/
│   └── express.d.ts             # Express type extensions
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.ts         # GitHub OAuth login
│   │   │   ├── callback.ts      # OAuth callback
│   │   │   ├── logout.ts        # Logout
│   │   │   ├── me.ts            # Get current user
│   │   │   └── status.ts        # Check app status
│   │   ├── setup.ts             # Initial setup API
│   │   └── init.ts              # Database initialization
│   ├── setup.tsx                # Setup page
│   └── index.tsx                # Home page
└── proxy.ts                     # Next.js 16 proxy (middleware)
```

## GitHub OAuth Authentication Flow

### 1. First User Becomes Admin

```typescript
// src/pages/api/auth/callback.ts
const isNew = await isNewApplication();
let admin = await getAdmin(userData.id);

if (isNew && !admin) {
  // First user becomes admin
  admin = await createAdmin(userData.id, userData.login, userData.avatar_url);
} else if (!admin) {
  // Non-admin rejected, data discarded
  await discardNonAdminData(userData.id);
  return res.status(403).json({ error: '只有管理员可以访问此应用' });
}
```

### 2. Encrypted Private Key Storage

```typescript
// src/lib/crypto.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

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

### 3. Setup Page Flow

```typescript
// src/pages/setup.tsx
// 1. Check if new application
// 2. If new, show setup form
// 3. Upload private key file
// 4. Configure GitHub App ID, Webhook Secret, Repo info
// 5. Save to database (encrypted)
// 6. Redirect to GitHub OAuth login
```

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma
model Admin {
  id          Int      @id @default(autoincrement())
  githubId    Int      @unique
  githubLogin String   @unique @map("github_login")
  avatarUrl   String?  @map("avatar_url")
  createdAt   DateTime @default(now()) @map("created_at")
  lastLogin   DateTime @default(now()) @map("last_login")
  builds      Build[]
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

## Git Hooks Configuration

### pre-commit Hook

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run lint-staged (check staged files)
npx lint-staged

# TypeScript type check
npx tsc --noEmit

# Run tests
npm test
```

### pre-push Hook

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Full build
npm run build

# Server build
npm run server:build

# Full test suite
npm test
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

### 5. Mantine v7 spacing → gap

**Problem**: `spacing` prop no longer exists in Mantine v7
**Fix**: Use `gap` prop instead: `<Stack gap="md">`

### 6. Next.js 16 middleware → proxy

**Problem**: `middleware` function export is deprecated in Next.js 16
**Fix**: Rename file to `proxy.ts` and export function named `proxy`

## Environment Variables

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/callback

# JWT
JWT_SECRET=your_jwt_secret

# Encryption
ENCRYPTION_KEY=your_encryption_key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/manticore

# Bot Server
BOT_PORT=3001
WORKSPACE_DIR=/app/workspace
```

## Test Coverage

- **Crypto module**: 8 test cases (encrypt/decrypt, special characters, format validation)
- **JWT authentication**: 4 test cases (token generation, verification, expiration)
- **PR reporter**: 3 test cases (report format, all-pass, output truncation)
- **Database operations**: 4 test cases (isNewApplication, getAdmin, createAdmin, updateAdminLogin)
- **Auth flow**: 6 test cases (JWT validation, OAuth flow, admin binding)
- **Encryption storage**: 8 test cases (private key, webhook secret, security features)

**Total: 33 test cases, all passing**

## Verification Commands

```bash
# Run tests
npm test

# Build application
npm run build

# Build server
npm run server:build

# Check types
npx tsc --noEmit

# Lint code
npm run lint
```
