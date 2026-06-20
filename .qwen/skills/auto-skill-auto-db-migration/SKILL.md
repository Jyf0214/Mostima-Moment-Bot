---
name: auto-db-migration
description: Auto-create database tables on first query via ensureTables() in db.ts — works on any deployment platform without pre-start scripts
source: auto-skill
extracted_at: '2026-06-20T07:07:07.306Z'
---

# Auto Database Migration — ensureTables() Pattern

## Problem

When deploying to serverless platforms (Vercel, Hugging Face Spaces, etc.), `prisma migrate deploy` and `prisma db push` may not work at startup (missing schema files in standalone output, no shell access, etc.). Tables may not exist, causing `PrismaClientKnownRequestError: The table does not exist` on first request.

## Why NOT These Approaches

| Approach                                 | Why it fails on HF Spaces                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `prisma db push` in pre-start script     | Standalone output doesn't include `schema.prisma`; CLI may not be available                       |
| `prisma migrate deploy`                  | Requires migration files in the output directory                                                  |
| Init API endpoint called from `_app.tsx` | Race condition — other endpoints (auth/status, auth/callback) may be called before init completes |
| Graceful error handling (catch P2021)    | User wants tables to actually exist, not silent fallback                                          |

## Solution: ensureTables() in db.ts

Put table creation logic directly in the database access layer. Every db function calls `ensureTables()` before querying. First call creates tables; subsequent calls are no-ops (cached).

### Implementation

```ts
// src/lib/db.ts
import { prisma } from './prisma';

let tablesReady = false;

export async function ensureTables(): Promise<void> {
  if (tablesReady) return;

  const check = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admins'
    ) as exists
  `;
  if ((check as any[])[0].exists) {
    tablesReady = true;
    return;
  }

  console.log('[DB] Tables missing, creating...');
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "admins" (...)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "app_config" (...)`);
  // ... one per model from schema.prisma
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ...`);

  tablesReady = true;
  console.log('[DB] Tables created');
}

// Every db function calls ensureTables() first:
export async function isNewApplication(): Promise<boolean> {
  await ensureTables();
  const count = await prisma.admin.count();
  return count === 0;
}

export async function getAdmin(githubId: number) {
  await ensureTables();
  return prisma.admin.findUnique({ where: { githubId } });
}

export async function createAdmin(...) {
  await ensureTables();
  return prisma.admin.create({ ... });
}
// etc.
```

### Key Design Decisions

1. **`tablesReady` flag**: Module-level boolean, checked once per process lifetime. Avoids repeated `information_schema` queries.
2. **Raw SQL, not Prisma migrate**: `CREATE TABLE IF NOT EXISTS` is idempotent and doesn't need migration files or CLI tools.
3. **Derive SQL from `schema.prisma`**: Keep the SQL in sync when schema changes. One entry per model.
4. **Log in English**: Avoids i18n compliance test failures (test scans for Chinese in non-comment code).
5. **Indexes created after tables**: `CREATE INDEX IF NOT EXISTS` after all tables exist.

### What About the Init Endpoint?

The `/api/init` endpoint can still exist for explicit initialization (called from `_app.tsx`), but it should NOT be the only line of defense. The `ensureTables()` pattern in db.ts is the primary guarantee.

### What About Pre-Start Scripts?

`scripts/ensure-tables.mjs` running `prisma db push` is a nice-to-have for local dev, but cannot be relied on in production serverless environments. The `ensureTables()` in db.ts works everywhere.

## Testing

Mock `$queryRaw` to return `[{ exists: true }]` in `beforeEach`:

```ts
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ exists: true }]),
    $executeRawUnsafe: jest.fn(),
    admin: { count: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ exists: true }]);
});
```

## Schema Change Checklist

When adding a new model to `schema.prisma`:

1. Add corresponding `CREATE TABLE IF NOT EXISTS` SQL to `ensureTables()` in `db.ts`
2. Add any new indexes
3. Add corresponding `CREATE TABLE IF NOT EXISTS` to `init.ts` (if keeping the init endpoint)
4. Run `npx prisma generate` to update the client
