---
name: env-validation-block
description: Environment variable validation with blocking UI when required vars are missing
source: auto-skill
extracted_at: '2026-06-20T03:10:00.000Z'
---

# Environment Variable Validation and Blocking

## Overview

Implementing environment variable validation that blocks application access when required variables are missing, showing a dedicated error page with clear instructions.

## Architecture

```
Request → Proxy/Middleware → Check Env Vars → Redirect to /env-error (if missing)
                ↓
        All Pages Blocked (except /env-error, /api/env-check)
```

## Required Environment Variables

Define which variables are mandatory:

```typescript
// src/lib/env-config.ts
export const REQUIRED_ENV_VARS = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
];
```

## Implementation

### 1. Environment Check API

```typescript
// src/pages/api/env-check.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { REQUIRED_ENV_VARS } from '@/lib/env-config';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing: string[] = [];
  const present: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (process.env[envVar]) {
      present.push(envVar);
    } else {
      missing.push(envVar);
    }
  }

  return res.status(200).json({
    isConfigured: missing.length === 0,
    missing,
    present,
    message:
      missing.length === 0 ? '所有环境变量已配置' : `缺少 ${missing.length} 个必要的环境变量`,
  });
}
```

### 2. Error Page Component

```tsx
// src/pages/env-error.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Alert,
  Loader,
  Center,
  Code,
  List,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertCircle, IconX, IconCheck } from '@tabler/icons-react';

interface EnvStatus {
  isConfigured: boolean;
  missing: string[];
  present: string[];
  message: string;
}

export default function EnvErrorPage() {
  const [loading, setLoading] = useState(true);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);

  useEffect(() => {
    fetch('/api/env-check')
      .then((res) => res.json())
      .then(setEnvStatus)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Container size="md" py="xl">
      <Paper shadow="md" p="xl" radius="md">
        <Stack gap="md">
          <Title order={2} c="red">
            ⚠️ 环境变量配置缺失
          </Title>

          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            应用无法正常运行，因为缺少必要的环境变量配置。
          </Alert>

          {envStatus?.missing.length > 0 && (
            <List
              size="sm"
              center
              icon={
                <ThemeIcon color="red" size={16} radius="xl">
                  <IconX size={10} />
                </ThemeIcon>
              }
            >
              {envStatus.missing.map((envVar) => (
                <List.Item key={envVar}>
                  <Code>{envVar}</Code>
                </List.Item>
              ))}
            </List>
          )}

          <Paper bg="gray.1" p="md" radius="md">
            <Text fw={500} mb="xs">
              解决方法：
            </Text>
            <Text size="sm">
              1. 在项目根目录创建 <Code>.env.local</Code> 文件
            </Text>
            <Text size="sm">2. 添加缺失的环境变量配置</Text>
            <Text size="sm">3. 重启应用</Text>
          </Paper>
        </Stack>
      </Paper>
    </Container>
  );
}
```

### 3. Next.js Proxy/Middleware

```typescript
// src/proxy.ts (Next.js 16) or src/middleware.ts (Next.js 14/15)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REQUIRED_ENV_VARS = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
];

// Paths exempt from env check
const ENV_CHECK_EXEMPT_PATHS = ['/api/env-check', '/env-error', '/_next', '/favicon.ico'];

function checkEnvironmentVariables(): string[] {
  const missing: string[] = [];
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  return missing;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip check for exempt paths
  if (ENV_CHECK_EXEMPT_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check environment variables
  const missingEnvVars = checkEnvironmentVariables();
  if (missingEnvVars.length > 0) {
    const errorUrl = new URL('/env-error', request.url);
    errorUrl.searchParams.set('missing', missingEnvVars.join(','));
    return NextResponse.redirect(errorUrl);
  }

  // ... other middleware logic
  return NextResponse.next();
}
```

### 4. App-Level Check (Fallback)

```tsx
// src/pages/_app.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Center, Loader, MantineProvider } from '@mantine/core';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Skip check for error page
    if (router.pathname === '/env-error') {
      setChecking(false);
      return;
    }

    fetch('/api/env-check')
      .then((res) => res.json())
      .then((data) => {
        if (!data.isConfigured && router.pathname !== '/env-error') {
          router.push('/env-error');
        }
      })
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <MantineProvider theme={theme}>
        <Center h="100vh">
          <Loader size="xl" />
        </Center>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme}>
      <Component {...pageProps} />
    </MantineProvider>
  );
}
```

## Key Design Decisions

### 1. Proxy-Level vs App-Level Check

- **Proxy-level**: Faster, blocks before React renders
- **App-level**: Fallback for client-side navigation
- **Both recommended**: Defense in depth

### 2. Exempt Paths

Always exempt:

- `/env-error` (the error page itself)
- `/api/env-check` (the check API)
- `/_next` (static assets)
- `/favicon.ico`

### 3. Redirect vs Render

- **Redirect to `/env-error`**: Cleaner URL, consistent UX
- **Inline error**: More complex, harder to maintain

## Common Issues and Fixes

### 1. Infinite Redirect Loop

**Problem**: `/env-error` triggers env check, which redirects to `/env-error`

**Fix**: Add `/env-error` to exempt paths list

### 2. Middleware Runs on Static Assets

**Problem**: Env check runs on `_next/static` files

**Fix**: Exclude static files in matcher config:

```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 3. Server vs Client Environment Variables

**Problem**: `process.env.VAR` only works server-side in Next.js

**Fix**:

- For public vars: Use `NEXT_PUBLIC_` prefix
- For server vars: Only access in API routes, middleware, or server components

## Verification

```bash
# Test with missing env vars
unset GITHUB_CLIENT_ID
npm run dev
# Should redirect to /env-error

# Test API response
curl http://localhost:3000/api/env-check
# Should return { isConfigured: false, missing: [...] }

# Test with all vars present
cp .env.example .env.local
npm run dev
# Should load normally
```

## Environment Variables Template

```env
# ===========================================
# Required (app won't start without these)
# ===========================================
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
JWT_SECRET=
ENCRYPTION_KEY=
DATABASE_URL=

# ===========================================
# Optional
# ===========================================
BOT_PORT=3001
WORKSPACE_DIR=/app/workspace
PUBLIC_URL=https://your-domain.com
```
