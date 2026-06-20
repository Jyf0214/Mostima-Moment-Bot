---
name: vitest-migration
description: Migrate test framework from Jest to Vitest with vi.hoisted for mock hoisting, vitest.config.mts, and src/__tests__/setup.ts
source: auto-skill
extracted_at: '2026-06-20T07:45:45.716Z'
---

## Procedure

### 1. Swap dependencies

```bash
npm uninstall jest ts-jest @types/jest
npm install -D vitest @vitejs/plugin-react
```

### 2. Create config files

**vitest.config.mts** (must be `.mts` to avoid CommonJS/ESM conflicts with `import` syntax):

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

**src/**tests**/setup.ts** (replaces jest.setup.ts):

```ts
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
```

**src/vitest.d.ts** (global type augmentation):

```ts
/// <reference types="vitest/globals" />
```

### 3. Delete old files

```bash
rm jest.config.ts jest.setup.ts
```

### 4. Update package.json scripts

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### 5. Migrate test files

Replace global API calls:

- `jest.fn()` → `vi.fn()`
- `jest.mock()` → `vi.mock()`
- `jest.clearAllMocks()` → `vi.clearAllMocks()`
- Add explicit imports: `import { vi, describe, it, expect, beforeEach } from 'vitest';`

### 6. Fix vi.mock hoisting issue

`vi.mock` is hoisted above variable declarations. If the mock factory references a variable defined outside, use `vi.hoisted()`:

```ts
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    admin: { count: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
```

### 7. Update tsconfig.json

Remove `@types/jest` from `compilerOptions.types` if present. The `src/vitest.d.ts` file provides global types via `/// <reference types="vitest/globals" />`.

### 8. Verify

```bash
npm test           # all tests pass
npx tsc --noEmit   # no type errors
npm run build      # build passes
```
