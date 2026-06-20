import { generatePRReport } from '@/lib/ci/reporter';
import { CheckResult } from '@/lib/ci/runner';

describe('PR 报告生成器', () => {
  it('应该生成正确的 Vercel 风格报告', () => {
    const prNumber = 42;
    const results: CheckResult[] = [
      { step: 'Dependencies', status: 'PASS', duration: 5000, exitCode: 0 },
      { step: 'Lint', status: 'PASS', duration: 2000, exitCode: 0 },
      { step: 'TypeScript', status: 'FAIL', duration: 3000, output: 'Type error in file.ts', exitCode: 1 },
      { step: 'Build', status: 'SKIP', duration: 0, exitCode: -1 },
    ];

    const report = generatePRReport(prNumber, results);

    expect(report).toContain('PR #42');
    expect(report).toContain('Dependencies');
    expect(report).toContain('✅ PASS');
    expect(report).toContain('TypeScript');
    expect(report).toContain('❌ FAIL');
    expect(report).toContain('Type error in file.ts');
    expect(report).toContain('➖ SKIP');
    expect(report).toContain('Manticore Bot');
  });

  it('应该处理所有通过的情况', () => {
    const prNumber = 1;
    const results: CheckResult[] = [
      { step: 'Dependencies', status: 'PASS', duration: 5000, exitCode: 0 },
      { step: 'Lint', status: 'PASS', duration: 2000, exitCode: 0 },
      { step: 'TypeScript', status: 'PASS', duration: 3000, exitCode: 0 },
      { step: 'Build', status: 'PASS', duration: 10000, exitCode: 0 },
    ];

    const report = generatePRReport(prNumber, results);

    expect(report).toContain('✅ PASS');
    expect(report).not.toContain('❌ FAIL');
    expect(report).not.toContain('➖ SKIP');
  });

  it('应该处理输出被截断的情况', () => {
    const prNumber = 1;
    const longOutput = 'x'.repeat(500);
    const results: CheckResult[] = [
      { step: 'Lint', status: 'FAIL', duration: 2000, output: longOutput, exitCode: 1 },
    ];

    const report = generatePRReport(prNumber, results);

    // 输出应该被截断到 200 字符
    expect(report).toContain('x'.repeat(200));
  });
});
