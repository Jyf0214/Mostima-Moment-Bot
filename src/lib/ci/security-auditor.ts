import { execFileSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  runQwen,
  getOrCreateSessionId,
  injectBranchProtection,
  createLspConfig,
} from '../qwen/runner';
import { postPRComment } from '../github/api';
import {
  buildAuditPrompt,
  buildAuditFailComment,
  buildAuditCircuitBreakComment,
} from '../qwen/prompts';
import { validateBranchName, validatePRNumber } from '../git/workspace';

/**
 * PR 安全审计服务
 *
 * 完整复原 ZhouZBoss-Web qwen-security-auditor.yml 规则：
 * - PR 创建或新推送时触发
 * - 通过 git diff 锁定变动文件
 * - 跨文件深度追踪（路由路径、文件访问、输入安全）
 * - 只关注本次 PR 新引入或恶化的漏洞
 * - 发现漏洞时生成 audit_report.txt
 * - 自动修复循环（最多 5 转，超限触发熔断）
 * - 审计报告作为 PR 评论发布
 *
 * 安全措施：
 * - 所有 git 命令使用 execFileSync（不经过 shell）
 * - baseBranch 通过 validateBranchName 校验，防止 shell 注入
 * - prNumber 通过 validatePRNumber 校验
 * - mkdir 使用 Node.js fs.mkdirSync 替代 shell 命令
 */
export async function auditPR(
  prNumber: number,
  baseBranch: string,
  headSha: string,
  workspaceDir: string
): Promise<void> {
  // 校验来自 webhook payload 的输入，防止命令注入
  const safePRNumber = validatePRNumber(prNumber);
  const safeBranch = validateBranchName(baseBranch);

  console.log(`[Security Auditor] Auditing PR #${safePRNumber} (base: ${safeBranch})`);

  // 1. 分支保护 + LSP
  injectBranchProtection(workspaceDir);
  createLspConfig(workspaceDir);

  // 2. 会话持久化
  const { sessionId, isResume } = getOrCreateSessionId(`audit-pr-${safePRNumber}`);

  // 3. 获取最新代码
  try {
    execFileSync('git', ['fetch', 'origin', safeBranch], { cwd: workspaceDir, stdio: 'pipe' });
    execFileSync('git', ['fetch', 'origin', `pull/${safePRNumber}/head:pr-${safePRNumber}`], {
      cwd: workspaceDir,
      stdio: 'pipe',
    });
    execFileSync('git', ['checkout', `pr-${safePRNumber}`], { cwd: workspaceDir, stdio: 'pipe' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Security Auditor] Failed to checkout PR: ${msg}`);
    return;
  }

  // 4. 防死循环判定
  let cycleCount = 0;
  const cycleFile = join(workspaceDir, '.qwen', 'audit_count.txt');
  try {
    const lastAuthor = execFileSync('git', ['log', '-1', '--pretty=format:%an'], {
      cwd: workspaceDir,
      encoding: 'utf-8',
    });

    if (existsSync(cycleFile)) {
      cycleCount = parseInt(readFileSync(cycleFile, 'utf-8').trim(), 10) || 0;
    }

    if (/bot|github-actions|qwen/i.test(lastAuthor)) {
      cycleCount++;
    } else {
      cycleCount = 0;
    }

    // 使用 Node.js fs 替代 shell mkdir -p，避免命令注入
    const qwenDir = join(workspaceDir, '.qwen');
    if (!existsSync(qwenDir)) {
      mkdirSync(qwenDir, { recursive: true });
    }
    writeFileSync(cycleFile, String(cycleCount), 'utf-8');
  } catch (error) {
    console.warn('[SecurityAuditor] 读写循环计数文件失败:', error);
  }

  // 5. 构建审计 Prompt
  const prompt = buildAuditPrompt(safeBranch, safePRNumber);

  // 6. 执行审计
  const result = await runQwen(prompt, {
    sessionId,
    maxSessionTurns: 100,
    resume: isResume,
  });

  // 7. 判定结果
  const reportFile = join(workspaceDir, 'audit_report.txt');
  if (result.success && existsSync(reportFile)) {
    console.error(`[Security Auditor] Security vulnerabilities detected in PR #${safePRNumber}!`);
    const reportContent = readFileSync(reportFile, 'utf-8');

    if (cycleCount < 5) {
      const commentBody = buildAuditFailComment(cycleCount, reportContent);
      await postPRComment(safePRNumber, commentBody);
    } else {
      const commentBody = buildAuditCircuitBreakComment(reportContent);
      await postPRComment(safePRNumber, commentBody);
    }
  } else {
    console.log(`[Security Auditor] PR #${safePRNumber} security audit passed.`);
  }
}
