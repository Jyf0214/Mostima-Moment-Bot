---
name: nextjs-mantine-setup
description: Next.js 14 with Mantine v7 project setup including common pitfalls and fixes
source: auto-skill
extracted_at: '2026-06-20T01:12:00.006Z'
---

# Next.js 14 + Mantine v7 Project Setup

## Overview
Setting up a Next.js 14 application with Mantine UI v7, i18next, and Chart.js.

## Key Dependencies
- `@mantine/core`, `@mantine/hooks`, `@mantine/ds` (all `^7.1.3`)
- `@tabler/icons-react` (`^2.39.0`)
- `next` (`^14.2.28`), `react` (`^18.3.1`)
- `i18next`, `react-i18next`, `i18next-browser-languagedetector`
- `chart.js`, `react-chartjs-2`, `chartjs-adapter-moment`
- `moment`, `moment-precise-range-plugin`

## Common Pitfalls and Fixes

### 1. Mantine v7: `spacing` → `gap` on Stack
Mantine v7 renamed the `spacing` prop to `gap` on layout components like `Stack`, `Group`, `SimpleGrid`.

```tsx
// ❌ Mantine v6
<Stack spacing="md">

// ✅ Mantine v7
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

## Project Structure Template
```
src/
├── pages/
│   ├── _app.tsx      # MantineProvider + i18n
│   ├── _document.tsx # HTML document
│   └── index.tsx
├── i18n/
│   ├── index.ts
│   └── locales/
│       ├── en.json
│       └── zh.json
└── theme.ts
```
