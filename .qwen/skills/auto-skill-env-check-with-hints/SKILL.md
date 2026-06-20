---
name: env-check-with-hints
description: Environment variable check API that returns structured status with descriptions and generation hints for each variable
source: auto-skill
extracted_at: '2026-06-20T05:21:52.183Z'
---

# Env Check with Hints

## Overview

A pattern for environment variable validation that returns structured metadata per variable: key name, human-readable description, and step-by-step generation instructions. Used to power error pages that tell users exactly how to fix missing configuration.

## Architecture

```
Proxy (middleware) → checks env vars → redirects to /env-error?missing=...
                                           ↓
env-error page → fetches /api/env-check → renders missing/present sections
                                           ↓
env-check API → checks process.env → returns { missing[], present[] } with hints
```

## API Design

### Response Schema

```typescript
interface EnvVar {
  key: string; // e.g. "JWT_SECRET"
  description: string; // i18n-localized purpose description
  generateHint: string; // i18n-localized step-by-step instructions
}

interface EnvCheckResponse {
  isConfigured: boolean;
  missing: EnvVar[];
  present: EnvVar[];
  message: string;
}
```

### Variable Registry Pattern

Store variable definitions as an array of `{ key, descriptionKey, generateHintKey }` — never hardcode user-facing strings:

```typescript
// src/pages/api/env-check.ts
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
    key: 'JWT_SECRET',
    descriptionKey: 'envVarDescriptions.jwtSecret',
    generateHintKey: 'envVarHints.jwtSecret',
  },
  // ... more variables
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const missing: EnvVar[] = [];
  const present: EnvVar[] = [];

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

## Frontend Display

### Missing Variable Card with Hint

Each missing variable gets its own card showing description + Code block with generation instructions:

```tsx
<Paper key={envVar.key} p="sm" radius="sm" bg="red.1" withBorder>
  <Group gap="sm" mb={4}>
    <Badge color="red" variant="light" leftSection={<IconX size={10} />} flex="0 0 auto">
      {envVar.key}
    </Badge>
  </Group>
  <Text size="xs" c="dimmed" mb={4}>
    {envVar.description}
  </Text>
  <Group gap="xs" align="flex-start">
    <Text size="xs" fw={600} c="dark" flex="0 0 auto">
      {t('envError.howToGet')}:
    </Text>
    <Code block p={6} fz="xs" style={{ flex: 1, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
      {envVar.generateHint}
    </Code>
  </Group>
</Paper>
```

### Present Variable Display

Simpler — just badge + description, no hint needed:

```tsx
<Group key={envVar.key} gap="sm" align="flex-start">
  <Badge color="green" variant="light" leftSection={<IconCheck size={10} />} flex="0 0 auto">
    {envVar.key}
  </Badge>
  <Text size="xs" c="dimmed">
    {envVar.description}
  </Text>
</Group>
```

## i18n Structure

Organize hints under dedicated namespaces in locale files:

```json
{
  "envVarDescriptions": {
    "githubClientId": "GitHub OAuth App Client ID, used for one-click login",
    "jwtSecret": "JWT token signing secret, used for authentication session management"
  },
  "envVarHints": {
    "githubClientId": "1. Go to https://github.com/settings/developers\n2. Click \"New OAuth App\"\n3. Fill in form fields\n4. Copy Client ID",
    "jwtSecret": "Run in terminal:\nopenssl rand -hex 32\n\nThen copy the 64-character hex string to .env.local"
  }
}
```

### Hint Content Guidelines

- Use `\n` for multi-line — the Code block renders with `whiteSpace: 'pre-wrap'`
- For CLI commands: show the exact command + what to do with the output
- For web UIs: show numbered step-by-step with the exact URL
- For generated secrets: include both the command and the expected output format
- For services: provide Docker one-liner as primary option, manual install as fallback

### Example Hints

| Variable Type     | Hint Pattern                                                   |
| ----------------- | -------------------------------------------------------------- |
| GitHub OAuth      | Step-by-step with URL, form field names, which button to click |
| Generated secret  | `openssl rand -hex 32` + "copy the 64-character hex string"    |
| Connection string | Docker command + resulting URL format                          |
| File path         | Expected file format + how to obtain/upload                    |

## Proxy Integration

The proxy middleware should check the same variable list and redirect to the error page:

```typescript
// src/proxy.ts
const REQUIRED_ENV_VARS = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
];

function checkEnvironmentVariables(): string[] {
  return REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
}

// In proxy handler:
const missing = checkEnvironmentVariables();
if (missing.length > 0) {
  const errorUrl = new URL('/env-error', request.url);
  errorUrl.searchParams.set('missing', missing.join(','));
  return NextResponse.redirect(errorUrl);
}
```

## Key Design Decisions

### 1. Why separate description + generateHint?

- **Description**: what the variable does (always shown, for both present and missing)
- **GenerateHint**: how to obtain it (only shown for missing, actionable)

### 2. Why Code block for hints?

- Terminal commands need monospace font
- Multi-line instructions need line breaks preserved
- `Code` with `block` + `pre-wrap` handles both

### 3. Why per-variable Paper cards?

- Visually separates each variable's instructions
- Clearer than a single list when hints are multi-line
- Red background reinforces "this needs attention"

### 4. Why i18n for hints?

- Hints contain user-facing instructions
- Chinese users need Chinese hints, English users need English
- The i18n compliance test would catch hardcoded strings

## Common Pitfalls

### 1. Hardcoded strings in API routes

```typescript
// ❌ Fails i18n test
description: 'GitHub OAuth Client ID';

// ✅ Use i18n key
description: i18n.t('envVarDescriptions.githubClientId');
```

### 2. Missing newlines in hints

```typescript
// ❌ Renders as one long line
generateHint: 'Run openssl rand -hex 32 then copy the result';

// ✅ Uses \n for line breaks
generateHint: 'Run in terminal:\nopenssl rand -hex 32\n\nThen copy the result';
```

### 3. Not checking the same variables in proxy and API

The proxy and env-check API must use the same variable list. If they diverge, the proxy might redirect to the error page while the API says everything is fine (or vice versa).

## Verification

```bash
# Test env-check API locally
curl http://localhost:3000/api/env-check | jq .

# Expected when all configured:
# { "isConfigured": true, "missing": [], "present": [...], "message": "..." }

# Expected when some missing:
# { "isConfigured": false, "missing": [...], "present": [...], "message": "..." }
```
