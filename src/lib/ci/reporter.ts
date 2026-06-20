import { CheckResult } from './runner';

/**
 * 生成 Vercel 风格的 PR 构建报告
 */
export function generatePRReport(prNumber: number, results: CheckResult[]): string {
  const rows = results.map(r => {
    const statusIcon = r.status === 'PASS' ? '✅' :
                       r.status === 'FAIL' ? '❌' : '➖';
    const details = r.output ? r.output.substring(0, 200) : '-';
    return `| **${r.step}** | ${statusIcon} ${r.status} | ${details} |`;
  }).join('\n');

  return `
### 🔍 Manticore Build & Check Report (PR #${prNumber})

| Check Category | Status | Details |
| :--- | :---: | :--- |
${rows}

---
*Generated automatically by Manticore Bot.*
`.trim();
}
