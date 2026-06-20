---
name: env-validation-block
description: Environment variable validation with blocking UI, including generate hints for each missing var
source: auto-skill
extracted_at: '2026-06-20T05:07:15.385Z'
---

# Environment Variable Validation and Blocking

## Overview

Environment variable validation that blocks application access when required variables are missing, showing a dedicated error page with **per-variable descriptions and generate hints** (how to create/obtain each value).

## Architecture

```
Request → Proxy/Middleware → Check Env Vars → Redirect to /env-error (if missing)
                ↓
        All Pages Blocked (except /env-error, /api/env-check)
```

## Required Environment Variables

Define which variables are mandatory. Keep `proxy.ts` and `env-check.ts` in sync:

```typescript
// src/proxy.ts and src/pages/api/env-check.ts — must match
const REQUIRED_ENV_VARS = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
];
```

## Implementation

### 1. Environment Check API (with description + generateHint)

The API returns each variable's **description** (what it does) and **generateHint** (how to create/obtain it). All strings go through i18n.

```typescript
// src/pages/api/env-check.ts
import { NextApiRequest, NextApiResponse } from 'next';
import i18n from '@/i18n';

const REQUIRED_ENV_VARS: {
  key: string;
  descriptionKey: string;
  generateHintKey: string;
}[] = [
  {
    key: 'GITHUB_CLIENT_ID',
    descriptionKey: 'envVarDescriptions.githubClientId',
    generateHintKey: 'envVarHints.githubClientId',
  },
  {
    key: 'GITHUB_CLIENT_SECRET',
    descriptionKey: 'envVarDescriptions.githubClientSecret',
    generateHintKey: 'envVarHints.githubClientSecret',
  },
  {
    key: 'JWT_SECRET',
    descriptionKey: 'envVarDescriptions.jwtSecret',
    generateHintKey: 'envVarHints.jwtSecret',
  },
  {
    key: 'ENCRYPTION_KEY',
    descriptionKey: 'envVarDescriptions.encryptionKey',
    generateHintKey: 'envVarHints.encryptionKey',
  },
  {
    key: 'DATABASE_URL',
    descriptionKey: 'envVarDescriptions.databaseUrl',
    generateHintKey: 'envVarHints.databaseUrl',
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing: { key: string; description: string; generateHint: string }[] = [];
  const present: { key: string; description: string; generateHint: string }[] = [];

  for (const item of REQUIRED_ENV_VARS) {
    const entry = {
      key: item.key,
      description: i18n.t(item.descriptionKey),
      generateHint: i18n.t(item.generateHintKey),
    };
    if (process.env[item.key]) {
      present.push(entry);
    } else {
      missing.push(entry);
    }
  }

  return res.status(200).json({
    isConfigured: missing.length === 0,
    missing,
    present,
    message:
      missing.length === 0
        ? i18n.t('api.envConfigured')
        : i18n.t('api.envMissing', { count: missing.length }),
  });
}
```

### 2. i18n Keys (descriptions + hints)

```json
// src/i18n/locales/en.json
{
  "envVarDescriptions": {
    "githubClientId": "GitHub OAuth App Client ID, used for one-click login",
    "jwtSecret": "JWT token signing secret, used for authentication session management",
    "databaseUrl": "PostgreSQL database connection string, used to store application data"
  },
  "envVarHints": {
    "githubClientId": "GitHub → Settings → Developer settings → OAuth Apps → create new App → copy Client ID",
    "jwtSecret": "Run: openssl rand -hex 32",
    "databaseUrl": "Format: postgresql://user:password@host:port/dbname\nDocker: docker run -d --name postgres -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=manticore -p 5432:5432 postgres:16-alpine"
  }
}
```

**Hint format conventions:**

| Variable type      | Hint pattern                                             |
| ------------------ | -------------------------------------------------------- |
| GitHub credentials | `GitHub → Settings → ... → copy value`                   |
| Generated secrets  | `Run: openssl rand -hex 32` or `openssl rand -base64 32` |
| Connection strings | Format description + Docker one-liner                    |

### 3. Error Page Component (with per-var hints)

Each missing variable shows in its own card: name badge, description, and a `Code` block with the generate hint.

```tsx
// src/pages/env-error.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Badge,
  Loader,
  Center,
  Group,
  ThemeIcon,
  Button,
  Code,
} from '@mantine/core';
import { IconAlertTriangle, IconX, IconCheck, IconRefresh } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface EnvVar {
  key: string;
  description: string;
  generateHint: string;
}

interface EnvStatus {
  isConfigured: boolean;
  missing: EnvVar[];
  present: EnvVar[];
  message: string;
}

export default function EnvErrorPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);

  useEffect(() => {
    checkEnvStatus();
  }, []);

  const checkEnvStatus = async () => {
    try {
      const res = await fetch('/api/env-check');
      setEnvStatus(await res.json());
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="xl" color="red" />
          <Text c="dimmed" size="sm">
            Loading...
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <Container size="sm" w="100%">
        <Paper shadow="xl" p="xl" radius="lg">
          <Stack gap="lg" align="center">
            <ThemeIcon size={72} radius="xl" variant="light" color="red">
              <IconAlertTriangle size={36} />
            </ThemeIcon>
            <Title order={2} ta="center">
              {t('envError.title')}
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              {t('envError.description')}
            </Text>

            {envStatus && (
              <Stack gap="md" w="100%">
                {/* Missing Variables — each with generateHint */}
                {envStatus.missing.length > 0 && (
                  <Paper p="md" radius="md" bg="red.0" withBorder>
                    <Group gap="xs" mb="sm">
                      <ThemeIcon size={20} radius="xl" variant="light" color="red">
                        <IconX size={12} />
                      </ThemeIcon>
                      <Text fw={600} size="sm" c="red.7">
                        {t('envError.missingVars')}
                      </Text>
                      <Badge color="red" variant="filled" size="sm" circle>
                        {envStatus.missing.length}
                      </Badge>
                    </Group>
                    <Stack gap="sm">
                      {envStatus.missing.map((envVar) => (
                        <Paper key={envVar.key} p="sm" radius="sm" bg="red.1" withBorder>
                          <Badge
                            color="red"
                            variant="light"
                            leftSection={<IconX size={10} />}
                            flex="0 0 auto"
                          >
                            {envVar.key}
                          </Badge>
                          <Text size="xs" c="dimmed" mb={4}>
                            {envVar.description}
                          </Text>
                          <Group gap="xs" align="flex-start">
                            <Text size="xs" fw={600} c="dark" flex="0 0 auto">
                              {t('envError.howToGet')}:
                            </Text>
                            <Code
                              block
                              p={6}
                              fz="xs"
                              style={{ flex: 1, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
                            >
                              {envVar.generateHint}
                            </Code>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  </Paper>
                )}

                {/* Present Variables — simple badge list */}
                {envStatus.present.length > 0 && (
                  <Paper p="md" radius="md" bg="green.0" withBorder>
                    <Group gap="xs" mb="sm">
                      <ThemeIcon size={20} radius="xl" variant="light" color="green">
                        <IconCheck size={12} />
                      </ThemeIcon>
                      <Text fw={600} size="sm" c="green.7">
                        {t('envError.presentVars')}
                      </Text>
                      <Badge color="green" variant="filled" size="sm" circle>
                        {envStatus.present.length}
                      </Badge>
                    </Group>
                    <Stack gap="xs">
                      {envStatus.present.map((envVar) => (
                        <Group key={envVar.key} gap="sm" align="flex-start">
                          <Badge
                            color="green"
                            variant="light"
                            leftSection={<IconCheck size={10} />}
                            flex="0 0 auto"
                          >
                            {envVar.key}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {envVar.description}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                )}

                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconRefresh size={16} />}
                  onClick={checkEnvStatus}
                  fullWidth
                  size="md"
                >
                  {t('envError.retry')}
                </Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
```

### 4. Next.js Proxy/Middleware

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

const ENV_CHECK_EXEMPT_PATHS = ['/api/env-check', '/env-error', '/_next', '/favicon.ico'];

function checkEnvironmentVariables(): string[] {
  const missing: string[] = [];
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) missing.push(envVar);
  }
  return missing;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (ENV_CHECK_EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const missingEnvVars = checkEnvironmentVariables();
  if (missingEnvVars.length > 0) {
    const errorUrl = new URL('/env-error', request.url);
    errorUrl.searchParams.set('missing', missingEnvVars.join(','));
    return NextResponse.redirect(errorUrl);
  }
  return NextResponse.next();
}
```

## Key Design Decisions

### 1. Per-Variable Cards with Generate Hints

Each missing variable gets its own card showing:

- **Variable name** (Badge)
- **Description** — what it does (dimmed text)
- **How to get** — command or path (Code block)

This eliminates guesswork for users who don't know how to create each value.

### 2. i18n for All Strings

All descriptions, hints, and labels go through `i18n.t()` in the API and `useTranslation()` in the frontend. The i18n compliance test scans all `.ts`/`.tsx` files for hardcoded Chinese, so any hardcoded string will fail the test.

### 3. Proxy-Level vs App-Level Check

- **Proxy-level**: Faster, blocks before React renders
- **App-level**: Fallback for client-side navigation
- **Both recommended**: Defense in depth

### 4. Exempt Paths

Always exempt: `/env-error`, `/api/env-check`, `/_next`, `/favicon.ico`

## Common Issues and Fixes

### 1. Infinite Redirect Loop

**Problem**: `/env-error` triggers env check, which redirects to `/env-error`

**Fix**: Add `/env-error` to exempt paths list

### 2. i18n Test Fails on API Routes

**Problem**: Hardcoded Chinese in env-check API

**Fix**: Store i18n keys (not strings) in the config array, call `i18n.t()` at runtime:

```typescript
// ✅ Correct — key reference, not hardcoded string
{ key: 'JWT_SECRET', descriptionKey: 'envVarDescriptions.jwtSecret' }

// ❌ Wrong — hardcoded Chinese
{ key: 'JWT_SECRET', description: 'JWT 令牌签名密钥' }
```

### 3. Missing generateHint in Response

**Problem**: Frontend shows variable name but not how to create it

**Fix**: Add `generateHintKey` to the env config array and `generateHint` to the response interface

## Verification

```bash
# Test with missing env vars
unset GITHUB_CLIENT_ID
npm run dev
# Should redirect to /env-error with hints

# Test API response
curl http://localhost:3000/api/env-check
# Should return { isConfigured: false, missing: [{ key, description, generateHint }] }

# Test i18n compliance
npx jest src/__tests__/i18n.test.ts --verbose
# Should pass (no hardcoded Chinese in .ts/.tsx files)
```
