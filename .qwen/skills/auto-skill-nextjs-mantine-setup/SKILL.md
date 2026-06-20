---
name: nextjs-mantine-setup
description: Next.js 16 with Mantine v9 project setup including common pitfalls and fixes
source: auto-skill
extracted_at: '2026-06-20T04:00:00.000Z'
---

# Next.js 16 + Mantine v9 Project Setup

## Overview

Setting up a Next.js 16 application with Mantine UI v9, i18next, and Chart.js.

## Key Dependencies

- `@mantine/core`, `@mantine/hooks` (all `^9.3.2`)
- `@tabler/icons-react` (`^3.44.0`)
- `next` (`^16.2.9`), `react` (`^19.2.7`)
- `i18next` (`^26.3.1`), `react-i18next` (`^17.0.8`)
- `chart.js`, `react-chartjs-2`, `chartjs-adapter-moment`
- `moment`, `moment-precise-range-plugin`
- `prisma`, `@prisma/client` (`^6.19.3`)

## Version Changes (v14 → v16, v7 → v9)

### Next.js 16 Changes

1. **Turbopack**: Default build system (faster than Webpack)
2. **middleware → proxy**: Rename `middleware.ts` to `proxy.ts`, export function named `proxy`
3. **ESLint 9**: New flat config format (`eslint.config.mjs`)
4. **Standalone output**: `output: 'standalone'` for Docker deployment
5. **TypeScript target**: Must be ES2017+ (not ES5) for Unicode regex support

### Mantine 9 Changes

1. **React 19**: Required peer dependency
2. **Removed @mantine/ds**: No longer compatible with v9
3. **Props renamed**: `spacing` → `gap` on layout components
4. **FileInput**: `placeholder` prop removed

## Common Pitfalls and Fixes

### 1. Mantine v9: `spacing` → `gap` on Stack

Mantine v7+ renamed the `spacing` prop to `gap` on layout components like `Stack`, `Group`, `SimpleGrid`.

```tsx
// ❌ Mantine v6
<Stack spacing="md">

// ✅ Mantine v9
<Stack gap="md">
```

### 2. `_document.tsx` Head Import

Use `Head` from `next/document`, not `next/head` in `_document.tsx`.

```tsx
// ❌ Wrong
import Head from 'next/head';

// ✅ Correct
import { Html, Head, Main, NextScript } from 'next/document';
```

### 3. Don't Reference Unlisted Packages

Ensure all imported packages are in `package.json` dependencies. Common mistake: importing `@mantine/notifications` without installing it.

### 4. Mantine CSS Import Pattern

```tsx
// In _app.tsx
import '@mantine/core/styles.css';
```

### 5. Client-Side Only Provider

MantineProvider must be in a `'use client'` component:

```tsx
'use client';
import { MantineProvider } from '@mantine/core';
```

### 6. Next.js 16 middleware → proxy

**Problem**: `middleware` function export is deprecated in Next.js 16
**Fix**: Rename file to `proxy.ts` and export function named `proxy`

```typescript
// ❌ src/middleware.ts
export function middleware(request: NextRequest) { ... }

// ✅ src/proxy.ts
export function proxy(request: NextRequest) { ... }
```

### 7. ESLint 9 Configuration

**Problem**: `.eslintrc.json` no longer works in ESLint 9
**Fix**: Use `eslint.config.mjs` with flat config format

```javascript
// eslint.config.mjs
const eslintConfig = {
  extends: ['next/core-web-vitals'],
};
export default eslintConfig;
```

### 8. FileInput placeholder prop removed

**Problem**: Mantine v9 FileInput no longer has `placeholder` prop
**Fix**: Remove `placeholder` prop

```tsx
// ❌ Mantine v7
<FileInput placeholder="Select file" />

// ✅ Mantine v9
<FileInput />
```

### 9. TypeScript target must be ES2017+

**Problem**: `u` regex flag requires ES6+ target
**Fix**: Set target to ES2017 in tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017"
  }
}
```

### 10. Standalone output for Docker

**Problem**: `next start` doesn't work with `output: 'standalone'`
**Fix**: For Docker, use `node .next/standalone/server.js`. For local dev, remove `output: 'standalone'`.

## Project Structure

```
src/
├── pages/
│   ├── _app.tsx      # MantineProvider + i18n
│   ├── _document.tsx # HTML document
│   ├── index.tsx
│   ├── setup.tsx     # Initial setup page
│   └── env-error.tsx # Environment variable error page
├── i18n/
│   ├── index.ts
│   └── locales/
│       ├── en.json
│       └── zh.json
├── lib/
│   ├── crypto.ts     # AES-256-GCM encryption
│   ├── db.ts         # Database operations (Prisma)
│   └── prisma.ts     # Prisma client
├── pages/api/
│   ├── auth/         # GitHub OAuth
│   ├── init.ts       # Database initialization
│   ├── setup.ts      # Setup API
│   ├── env-check.ts  # Environment variable check
│   └── health.ts     # Health check
├── theme.ts
└── proxy.ts          # Next.js 16 proxy (middleware)
```

## Environment Variables

```env
# Required (app won't start without these)
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
PUBLIC_URL=https://your-domain.com
```
