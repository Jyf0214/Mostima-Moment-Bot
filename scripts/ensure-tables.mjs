/**
 * Pre-start script: sync database schema before Next.js server starts.
 * Uses `prisma db push` to create/update tables from schema.prisma.
 */
import { execSync } from 'child_process';

const start = Date.now();
console.log('[ensure-tables] Starting prisma db push...');

if (!process.env.DATABASE_URL) {
  console.log('[ensure-tables] No DATABASE_URL, skipping');
  process.exit(0);
}

try {
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  console.log(`[ensure-tables] Done in ${Date.now() - start}ms`);
} catch (e) {
  console.error('[ensure-tables] Failed:', e.message);
  process.exit(1);
}
