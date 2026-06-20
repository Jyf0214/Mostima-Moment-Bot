/**
 * Pre-start script: sync database schema using prisma db push.
 */
import { execSync } from 'child_process';

const start = Date.now();
console.log('[ensure-tables] Running prisma db push...');

if (!process.env.DATABASE_URL) {
  console.log('[ensure-tables] No DATABASE_URL, skipping');
  process.exit(0);
}

try {
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  console.log(`[ensure-tables] Done in ${Date.now() - start}ms`);
} catch {
  console.error('[ensure-tables] prisma db push failed');
  process.exit(1);
}
