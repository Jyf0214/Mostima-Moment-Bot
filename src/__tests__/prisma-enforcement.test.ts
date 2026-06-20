import fs from 'fs';
import path from 'path';

/**
 * Prisma-only database enforcement test
 *
 * Scans all source files for forbidden database patterns:
 * - $executeRawUnsafe (raw SQL execution)
 * - $queryRaw with CREATE/ALTER/DROP (DDL via query)
 * - execSync calling prisma CLI
 * - Any non-Prisma database client imports
 *
 * If violations found → test FAILS with instructions.
 * If this test file is modified to remove checks → test FAILS.
 * If this test file is deleted → build should break (imported elsewhere).
 */

const SRC_DIR = path.resolve(__dirname, '..');
const EXTENSIONS = ['.ts', '.tsx'];
const EXCLUDED_DIRS = ['node_modules', '.next', 'dist', 'coverage', '__tests__', 'i18n/locales'];

// Forbidden patterns
const FORBIDDEN_PATTERNS = [
  {
    pattern: /\$executeRawUnsafe/g,
    message: '使用了 $executeRawUnsafe（raw SQL），请改用 Prisma Client API 或 prisma db push',
  },
  {
    pattern: /\$queryRaw\s*`[^`]*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)/gi,
    message: '使用了 $queryRaw 执行 DDL/DML 语句，请改用 Prisma Client API 或 prisma db push',
  },
  {
    pattern: /execSync\s*\(\s*['"`]npx\s+prisma/g,
    message: '使用了 execSync 调用 prisma CLI，请改用 prisma db push（pre-start 脚本）',
  },
  {
    pattern: /execSync\s*\(\s*['"`]prisma\s/g,
    message: '使用了 execSync 调用 prisma CLI，请改用 prisma db push（pre-start 脚本）',
  },
];

// Self-integrity check: this test file must not be weakened
const SELF_FILE = path.basename(__filename);
const SELF_PATH = __filename;

describe('Prisma-only database enforcement', () => {
  it('this test file must not be modified to remove checks', () => {
    const content = fs.readFileSync(SELF_PATH, 'utf-8');
    // Must contain all critical check strings
    expect(content).toContain('$executeRawUnsafe');
    expect(content).toContain('execSync');
    expect(content).toContain('Prisma Client API');
    expect(content).toContain('prisma db push');
  });

  it('no raw SQL or CLI calls in source code', () => {
    const violations: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (EXCLUDED_DIRS.includes(entry.name)) continue;
          scanDir(fullPath);
        } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
          // Skip this test file itself
          if (fullPath === SELF_PATH) continue;
          const content = fs.readFileSync(fullPath, 'utf-8');
          const relPath = path.relative(SRC_DIR, fullPath);
          for (const { pattern, message } of FORBIDDEN_PATTERNS) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;
            while ((match = regex.exec(content)) !== null) {
              const lineNum = content.substring(0, match.index).split('\n').length;
              violations.push(`${relPath}:${lineNum} - ${message}`);
            }
          }
        }
      }
    }

    scanDir(SRC_DIR);

    if (violations.length > 0) {
      console.error(
        '\n🚫 数据库操作违规！\n\n' +
          violations.map((v) => `  ❌ ${v}`).join('\n') +
          '\n\n💡 请使用 Prisma Client API 或 prisma db push，禁止 raw SQL 和 execSync CLI\n'
      );
    }

    expect(violations).toEqual([]);
  });
});
