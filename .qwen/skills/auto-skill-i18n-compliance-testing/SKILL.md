---
name: i18n-compliance-testing
description: Automated i18n compliance test that scans code files for hardcoded Chinese characters outside comments
source: auto-skill
extracted_at: '2026-06-20T03:55:00.000Z'
---

# i18n Compliance Testing

## Overview

Automated test that scans all code files (`.ts`, `.tsx`) for hardcoded Chinese characters outside of comments. If found, the test fails, enforcing the use of i18n translation functions (`useTranslation()` / `t()`).

## Architecture

```
Test → Read all .ts/.tsx files → Strip comments → Check for Chinese → Fail if found
          ↓
    Exclude: __tests__/, i18n/locales/, node_modules/, dist/
```

## Implementation

### Test File

```typescript
// src/__tests__/i18n.test.ts
import fs from 'fs';
import path from 'path';

// Chinese character Unicode range (Basic CJK + Extension A)
const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;

const SRC_DIR = path.resolve(__dirname, '..');

const EXCLUDED_DIRS = ['node_modules', '.next', 'dist', 'coverage', '__tests__', 'i18n/locales'];

const EXTENSIONS = ['.ts', '.tsx'];

function removeSingleLineComments(code: string): string {
  return code.replace(/(?<![:\w])\/\/(?!\/).*$/gm, '');
}

function removeMultiLineComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '');
}

function removeJSXComments(code: string): string {
  return code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

function removeAllComments(code: string): string {
  let result = code;
  result = removeJSXComments(result);
  result = removeMultiLineComments(result);
  result = removeSingleLineComments(result);
  return result;
}

function shouldSkipFile(filePath: string): boolean {
  const relativePath = path.relative(SRC_DIR, filePath);
  if (EXCLUDED_DIRS.some((dir) => relativePath.startsWith(dir))) return true;
  if (!EXTENSIONS.some((ext) => filePath.endsWith(ext))) return true;
  return false;
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name)) {
        files.push(...getAllFiles(fullPath));
      }
    } else if (entry.isFile() && EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function findChineseLines(code: string): { line: number; content: string }[] {
  const lines = code.split('\n');
  const results: { line: number; content: string }[] = [];
  lines.forEach((line, index) => {
    if (CHINESE_REGEX.test(line)) {
      results.push({ line: index + 1, content: line.trim() });
    }
  });
  return results;
}

describe('i18n compliance', () => {
  it('code files should not contain hardcoded Chinese outside comments', () => {
    const files = getAllFiles(SRC_DIR);
    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      if (shouldSkipFile(file)) continue;
      const code = fs.readFileSync(file, 'utf-8');
      const codeWithoutComments = removeAllComments(code);
      const chineseLines = findChineseLines(codeWithoutComments);
      for (const { line, content } of chineseLines) {
        violations.push({
          file: path.relative(SRC_DIR, file),
          line,
          content,
        });
      }
    }

    if (violations.length > 0) {
      const errorMessage = violations
        .map((v) => `  ${v.file}:${v.line}\n     ${v.content}`)
        .join('\n\n');

      console.error(
        '\ni18n compliance check failed!\n\n' +
          'Hardcoded Chinese found in code:\n\n' +
          errorMessage +
          '\n\n' +
          'Fix: use useTranslation() or t() function\n'
      );

      throw new Error(`Found ${violations.length} hardcoded Chinese strings, use i18n`);
    }
  });
});
```

### i18n Translation Files

```json
// src/i18n/locales/en.json
{
  "app": { "title": "Mostima Moment Bot" },
  "home": { "welcome": "Welcome", "loginGithub": "Login with GitHub" }
}

// src/i18n/locales/zh.json
{
  "app": { "title": "Mostima 时刻机器人" },
  "home": { "welcome": "欢迎", "loginGithub": "使用 GitHub 登录" }
}
```

### Usage in Components

```tsx
'use client';
import { useTranslation } from 'react-i18next';

export default function MyComponent() {
  const { t } = useTranslation();
  return <Text>{t('home.welcome')}</Text>;
}
```

### Usage in API Routes

```typescript
import i18n from '@/i18n';

export default function handler(req, res) {
  return res.status(403).json({
    error: i18n.t('api.unauthorized'),
  });
}
```

## Key Design Decisions

### 1. Comment Stripping

Three types of comments are stripped:

- Single-line: `// ...`
- Multi-line: `/* ... */`
- JSX: `{/* ... */}`

### 2. Excluded Directories

- `__tests__/` - Test files can contain Chinese for assertions
- `i18n/locales/` - Translation files ARE the Chinese source
- `node_modules/`, `.next/`, `dist/` - Build artifacts

### 3. Regex Simplicity

Use simple CJK range `[\u4e00-\u9fff\u3400-\u4dbf]` without the `u` flag to avoid TypeScript ES2015+ target requirements. This covers 99.9% of Chinese characters.

## Common Issues and Fixes

### 1. TypeScript Target Error with `u` Flag

**Problem**: `TS1501: This regular expression flag is only available when targeting 'es6' or later`

**Fix**: Remove the `u` flag from the regex:

```typescript
// ❌ Requires ES2015+ target
const CHINESE_REGEX = /[\u4e00-\u9fff]/u;

// ✅ Works with any target
const CHINESE_REGEX = /[\u4e00-\u9fff]/;
```

### 2. JSDoc Comment Containing JSX Syntax

**Problem**: `{/* ... */}` in JSDoc comments breaks TypeScript parsing

**Fix**: Rephrase the comment:

```typescript
// ❌ Breaks TypeScript
/** 移除 JSX 注释（{/* ... */}） */

// ✅ Safe
/** 移除 JSX 注释 */
```

### 3. console.log Messages in Chinese

**Problem**: Server-side log messages contain Chinese

**Fix**: Use English for logs (they're developer-facing, not user-facing):

```typescript
// ❌
console.error('检查环境变量失败:', err);

// ✅
console.error('Failed to check environment variables:', err);
```

## Verification

```bash
# Run i18n test only
npx jest src/__tests__/i18n.test.ts --verbose

# Run full test suite (includes i18n check)
npm test

# Check specific file for Chinese
grep -Pn '[\x{4e00}-\x{9fff}]' src/pages/index.tsx
```
