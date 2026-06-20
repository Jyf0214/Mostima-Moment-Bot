import { NextApiRequest, NextApiResponse } from 'next';
import i18n from '@/i18n';
import { prisma } from '@/lib/prisma';

const TABLES = [
  {
    name: 'admins',
    sql: `CREATE TABLE IF NOT EXISTS "admins" (
      "id" SERIAL PRIMARY KEY,
      "githubId" INTEGER NOT NULL UNIQUE,
      "github_login" TEXT NOT NULL UNIQUE,
      "avatar_url" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "last_login" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'app_config',
    sql: `CREATE TABLE IF NOT EXISTS "app_config" (
      "id" SERIAL PRIMARY KEY,
      "config_key" TEXT NOT NULL UNIQUE,
      "config_value" TEXT NOT NULL,
      "encrypted" BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'webhook_config',
    sql: `CREATE TABLE IF NOT EXISTS "webhook_config" (
      "id" SERIAL PRIMARY KEY,
      "app_id" TEXT NOT NULL,
      "webhook_secret_encrypted" TEXT NOT NULL,
      "private_key_encrypted" TEXT NOT NULL,
      "repo_owner" TEXT NOT NULL,
      "repo_name" TEXT NOT NULL,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'builds',
    sql: `CREATE TABLE IF NOT EXISTS "builds" (
      "id" SERIAL PRIMARY KEY,
      "pr_number" INTEGER NOT NULL,
      "branch_name" TEXT NOT NULL,
      "trigger_user" TEXT NOT NULL,
      "started_at" TIMESTAMP(3) NOT NULL,
      "completed_at" TIMESTAMP(3),
      "status" TEXT NOT NULL,
      "total_duration" INTEGER,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'build_steps',
    sql: `CREATE TABLE IF NOT EXISTS "build_steps" (
      "id" SERIAL PRIMARY KEY,
      "build_id" INTEGER NOT NULL,
      "step_name" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "duration" INTEGER,
      "exit_code" INTEGER,
      "output" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
];

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "builds_pr_number_idx" ON "builds"("pr_number")`,
  `CREATE INDEX IF NOT EXISTS "builds_created_at_idx" ON "builds"("created_at")`,
  `CREATE INDEX IF NOT EXISTS "build_steps_build_id_idx" ON "build_steps"("build_id")`,
];

/**
 * Database initialization API
 * POST /api/init
 *
 * Auto-creates missing tables and logs each step
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[DB Init] Starting database initialization...');

  try {
    // 1. Connect
    console.log('[DB Init] Connecting to database...');
    await prisma.$connect();
    console.log('[DB Init] Database connected');

    // 2. Check and create tables
    let createdTables: string[] = [];
    for (const table of TABLES) {
      const check = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = ${table.name}
        ) as exists
      `;
      const exists = (check as any[])[0]?.exists;

      if (!exists) {
        console.log(`[DB Init] Creating table: ${table.name}...`);
        await prisma.$executeRawUnsafe(table.sql);
        createdTables.push(table.name);
        console.log(`[DB Init] Table ${table.name} created`);
      } else {
        console.log(`[DB Init] Table ${table.name} exists, skipping`);
      }
    }

    // 3. Create indexes
    if (createdTables.length > 0) {
      console.log('[DB Init] Creating indexes...');
      for (const idxSql of INDEXES) {
        await prisma.$executeRawUnsafe(idxSql);
      }
      console.log('[DB Init] Indexes created');
    }

    // 4. Check admin count
    const adminCount = await prisma.admin.count();
    const elapsed = Date.now() - startTime;
    console.log(`[DB Init] Done in ${elapsed}ms, admin count: ${adminCount}`);

    return res.status(200).json({
      success: true,
      isNew: adminCount === 0,
      createdTables,
      message: i18n.t('api.dbInitComplete'),
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[DB Init] Failed after ${elapsed}ms:`, error.message);
    return res.status(500).json({
      error: i18n.t('api.dbInitFailed'),
      message: error.message,
    });
  }
}
