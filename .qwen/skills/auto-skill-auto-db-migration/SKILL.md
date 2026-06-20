---
name: auto-db-migration
description: Auto-sync database schema via prisma db push in package.json scripts and Dockerfile CMD
source: auto-skill
extracted_at: '2026-06-20T08:49:46.360Z'
---

# Auto Database Migration — prisma db push Pattern

## Problem

Tables may not exist on first deployment, causing `PrismaClientKnownRequestError: The table does not exist`.

## Solution

Use `prisma db push --skip-generate` in startup scripts. The `schema.prisma` file is the single source of truth for table structure.

### package.json scripts

```json
{
  "dev": "prisma db push --skip-generate && next dev",
  "start": "prisma db push --skip-generate && next start"
}
```

### Dockerfile (docker/Dockerfile)

```dockerfile
# npm start = prisma db push --skip-generate && next start
CMD ["npm", "start"]
```

### Key Rules

1. **Never use raw SQL** (`$executeRawUnsafe`, `$queryRaw` with DDL) to create tables
2. **Never use `execSync`** to call prisma CLI in runtime code
3. **Schema changes**: modify `prisma/schema.prisma`, then `prisma db push` handles the rest
4. **Docker uses `npm start`** — no standalone mode, no redundant prisma db push in CMD
5. **Enforcement test** (`prisma-enforcement.test.ts`) blocks raw SQL and execSync prisma CLI in `src/`

### What NOT to do

| Approach                                    | Why it's wrong                               |
| ------------------------------------------- | -------------------------------------------- |
| Raw SQL in `db.ts` or `init.ts`             | Duplicates schema.prisma, maintenance burden |
| `execSync('npx prisma db push')` in runtime | Blocked by enforcement test, fragile         |
| `ensureTables()` with raw SQL               | User explicitly forbids raw SQL              |
| Standalone mode + separate CMD prisma push  | Redundant, npm start already handles it      |

### Testing

The `prisma-enforcement.test.ts` scans `src/` for:

- `$executeRawUnsafe` usage
- `$queryRaw` with CREATE/ALTER/DROP
- `execSync('npx prisma...')` calls

If found → test fails with instructions to use Prisma Client API or prisma db push.
