---
name: nextjs-mantine-setup
description: Next.js 16 project setup with Tailwind CSS v4 + custom UI components, i18next, and Prisma
source: auto-skill
extracted_at: '2026-06-20T06:18:09.260Z'
---

# Next.js 16 Project Setup (Tailwind CSS + Custom UI)

## Overview

Setting up a Next.js 16 application with Tailwind CSS v4, custom UI components, i18next, and Prisma.

## Key Dependencies

- `next` (`^16.2.9`), `react` (`^19.2.7`)
- `tailwindcss` (`^4.2.2`), `@tailwindcss/postcss`, `autoprefixer`
- `clsx`, `tailwind-merge` — `cn()` utility
- `lucide-react` — icon library
- `antd`, `@ant-design/icons` — complex form controls only
- `i18next` (`^26.3.1`), `react-i18next` (`^17.0.8`)
- `prisma`, `@prisma/client` (`^6.19.3`)

## Version Changes (v14 → v16)

### Next.js 16 Changes

1. **Turbopack**: Default build system (faster than Webpack)
2. **middleware → proxy**: Rename `middleware.ts` to `proxy.ts`, export function named `proxy`
3. **ESLint 9**: New flat config format (`eslint.config.mjs`)
4. **Standalone output**: `output: 'standalone'` for Docker deployment
5. **TypeScript target**: Must be ES2017+ (not ES5) for Unicode regex support

## Common Pitfalls and Fixes

### 1. `_document.tsx` Head Import

Use `Head` from `next/document`, not `next/head` in `_document.tsx`.

```tsx
// ❌ Wrong
import Head from 'next/head';

// ✅ Correct
import { Html, Head, Main, NextScript } from 'next/document';
```

### 2. Don't Reference Unlisted Packages

Ensure all imported packages are in `package.json` dependencies.

### 3. Tailwind CSS v4: No config file needed

Tailwind v4 uses CSS-first configuration in `globals.css`. No `tailwind.config.js` file required.

```css
/* src/app/globals.css */
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));
```

### 4. antd transpilePackages

Must add to `next.config.js` for tree-shaking:

```js
transpilePackages: ['antd', '@ant-design/icons'],
```

### 5. lucide-react missing Github icon

lucide-react does NOT export `Github`. Use custom SVG component or `@ant-design/icons`.

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

### 7. FileInput placeholder prop removed (Mantine legacy)

If still using Mantine's FileInput, the `placeholder` prop was removed in v9. Use a label or separate text instead.

### 8. TypeScript target must be ES2017+

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
│   ├── _app.tsx      # globals.css import + env check
│   ├── _document.tsx # HTML document
│   ├── index.tsx     # Landing page (Tailwind)
│   ├── setup.tsx     # Initial setup wizard (Tailwind)
│   └── env-error.tsx # Environment variable error page (Tailwind)
├── components/ui/    # Custom UI components (Button, Input, etc.)
│   ├── Button/       # Button with variants, loading, icon support
│   ├── index.ts      # Barrel exports
│   └── *.tsx         # Input, Textarea, Select, StatusCard, etc.
├── lib/
│   ├── ui.ts         # cn() utility (clsx + tailwind-merge)
│   ├── crypto.ts     # AES-256-GCM encryption
│   ├── db.ts         # Database operations (Prisma)
│   └── prisma.ts     # Prisma client
├── i18n/
│   ├── index.ts
│   └── locales/
│       ├── en.json
│       └── zh.json
├── app/globals.css   # Tailwind v4 base styles
├── pages/api/
│   ├── auth/         # GitHub OAuth
│   ├── init.ts       # Database initialization
│   ├── setup.ts      # Setup API
│   ├── env-check.ts  # Environment variable check
│   └── health.ts     # Health check
└── proxy.ts          # Next.js 16 proxy (middleware)
```

## Environment Variables

```env
# Required (app won't start without these)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_jwt_secret          # Generate: openssl rand -hex 32
ENCRYPTION_KEY=your_encryption_key  # Generate: openssl rand -hex 32
DATABASE_URL=postgresql://user:pass@localhost:5432/manticore
NEXT_PUBLIC_APP_URL=https://your-domain.com  # Used for OAuth redirect_uri

# Optional (CI/CD features)
PORT=3001
GITHUB_APP_ID=your_app_id
ENCRYPTION_KEY=your_webhook_secret
REPO_OWNER=your_username
REPO_NAME=your_repo
```
