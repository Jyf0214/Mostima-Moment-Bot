---
name: auto-db-migration
description: Auto-create database tables on app startup with per-table logging, used when Prisma migrate deploy is not available at runtime
source: auto-skill
extracted_at: '2026-06-20T06:42:03.050Z'
---

# Auto Database Migration on Startup

## Problem

When deploying to serverless platforms (Vercel, Hugging Face Spaces, etc.), `prisma migrate deploy` cannot be run as a build step or startup command. Tables may not exist, causing `PrismaClientKnownRequestError: The table does not exist` on first request.

## Solution

Create an init API endpoint that auto-creates missing tables using `CREATE TABLE IF NOT EXISTS` with raw SQL derived from the Prisma schema. Call it with `await` before rendering the first page.

## Implementation

### 1. Define table SQL constants from Prisma schema

```ts
const TABLES = [
  {
    name: 'admins',
    sql: `CREATE TABLE IF NOT EXISTS "admins" (
      "id" SERIAL PRIMARY KEY,
      "githubId" INTEGER NOT NULL UNIQUE,
      "github_login" TEXT NOT NULL UNIQUE,
      ...
    )`,
  },
  // ... one entry per model
];

const INDEXES = [`CREATE INDEX IF NOT EXISTS "idx_name" ON "table"("column")`];
```

### 2. Init endpoint checks each table, creates if missing

```ts
export default async function handler(req, res) {
  console.log('[DB Init] Starting...');
  await prisma.$connect();

  for (const table of TABLES) {
    const check = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${table.name}
      ) as exists
    `;
    if (!(check as any[])[0]?.exists) {
      console.log(`[DB Init] Creating table: ${table.name}...`);
      await prisma.$executeRawUnsafe(table.sql);
      console.log(`[DB Init] Table ${table.name} created`);
    } else {
      console.log(`[DB Init] Table ${table.name} exists, skipping`);
    }
  }

  // Create indexes after tables
  for (const idxSql of INDEXES) {
    await prisma.$executeRawUnsafe(idxSql);
  }

  const adminCount = await prisma.admin.count();
  console.log(`[DB Init] Done, admin count: ${adminCount}`);
}
```

### 3. Await init before rendering pages

```tsx
// _app.tsx
useEffect(() => {
  const init = async () => {
    const envRes = await fetch('/api/env-check');
    const envData = await envRes.json();
    if (envData.isConfigured) {
      await fetch('/api/init', { method: 'POST' }); // await, not fire-and-forget
    }
    setChecking(false);
  };
  init();
}, []);
```

### 4. Log format

Use consistent prefix `[DB Init]` for all log lines. Use English to avoid i18n compliance test failures.

## Key Points

- **CREATE TABLE IF NOT EXISTS** is idempotent — safe to run on every startup
- **await** the init call in `_app.tsx` — don't fire-and-forget, otherwise subsequent API calls may hit missing tables
- **Log every step**: connecting → each table check → each table creation → indexes → final status
- **Derive SQL from Prisma schema** — keep it in sync when schema changes
- **Single admin enforcement** is application-level (in callback.ts), not schema-level
