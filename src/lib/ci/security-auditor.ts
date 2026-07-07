import { logger } from '../logger';
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
import type { LogCollector } from './log-collector';

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
  workspaceDir: string,
  logCollector?: LogCollector
): Promise<void> {
  // 校验来自 webhook payload 的输入，防止命令注入
  const safePRNumber = validatePRNumber(prNumber);
  const safeBranch = validateBranchName(baseBranch);

  logCollector?.addMessage(`Auditing PR #${safePRNumber} (base: ${safeBranch})`);
  logger.info(`[Security Auditor] Auditing PR #${safePRNumber} (base: ${safeBranch})`);

  // 1. 分支保护 + LSP
  logCollector?.startStep('Setup', 'Branch protection + LSP config');
  injectBranchProtection(workspaceDir);
  createLspConfig(workspaceDir);
  logCollector?.finishStep('Setup', { conclusion: 'success' });

  // 2. 会话持久化
  const { sessionId, isResume } = getOrCreateSessionId(`audit-pr-${safePRNumber}`);
  logCollector?.addMessage(`Session: ${sessionId.slice(0, 8)}... (resume: ${isResume})`);

  // 3. 获取最新代码
  logCollector?.startStep('Checkout', `Fetch and checkout PR #${safePRNumber}`);
  try {
    logCollector?.appendOutput(`git fetch origin ${safeBranch}\n`);
    execFileSync('git', ['fetch', 'origin', safeBranch], { cwd: workspaceDir, stdio: 'pipe' });
    logCollector?.appendOutput(`git fetch origin pull/${safePRNumber}/head:pr-${safePRNumber}\n`);
    execFileSync('git', ['fetch', 'origin', `pull/${safePRNumber}/head:pr-${safePRNumber}`], {
      cwd: workspaceDir,
      stdio: 'pipe',
    });
    logCollector?.appendOutput(`git checkout pr-${safePRNumber}\n`);
    execFileSync('git', ['checkout', `pr-${safePRNumber}`], { cwd: workspaceDir, stdio: 'pipe' });
    logCollector?.appendOutput('Checkout completed successfully\n');
    logCollector?.finishStep('Checkout', { conclusion: 'success' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[Security Auditor] Failed to checkout PR: ${msg}`);
    logCollector?.finishStep('Checkout', { conclusion: 'failure', output: msg });
    return;
  }

  // 4. 防死循环判定
  logCollector?.startStep('Cycle Check', 'Anti-infinite-loop detection');
  let cycleCount = 0;
  const cycleFile = join(workspaceDir, '.qwen', 'audit_count.txt');
  try {
    const lastAuthor = execFileSync('git', ['log', '-1', '--pretty=format:%an'], {
      cwd: workspaceDir,
      encoding: 'utf-8',
    });
    logCollector?.appendOutput(`Last commit author: ${lastAuthor}\n`);

    if (existsSync(cycleFile)) {
      cycleCount = parseInt(readFileSync(cycleFile, 'utf-8').trim(), 10) || 0;
    }

    if (/bot|github-actions|qwen/i.test(lastAuthor)) {
      cycleCount++;
    } else {
      cycleCount = 0;
    }

    logCollector?.appendOutput(`Cycle count: ${cycleCount}/5\n`);

    // 使用 Node.js fs 替代 shell mkdir -p，避免命令注入
    const qwenDir = join(workspaceDir, '.qwen');
    if (!existsSync(qwenDir)) {
      mkdirSync(qwenDir, { recursive: true });
    }
    writeFileSync(cycleFile, String(cycleCount), 'utf-8');
    logCollector?.finishStep('Cycle Check', { conclusion: 'success' });
  } catch (error) {
    logger.warn('[SecurityAuditor] Failed to read/write cycle count file:', error);
    logCollector?.finishStep('Cycle Check', { conclusion: 'failure' });
  }

  // 5. 构建审计 Prompt
  const prompt = buildAuditPrompt(safeBranch, safePRNumber);
  logCollector?.addMessage('Audit prompt constructed');

  // 6. 执行审计
  logCollector?.addMessage('Executing security audit with Qwen...');
  const result = await runQwen(prompt, {
    sessionId,
    maxSessionTurns: 100,
    resume: isResume,
    logCollector,
  });

  logCollector?.addMessage(`Audit completed in ${result.duration}ms (${result.attempts} attempts)`);

  // 7. 判定结果
  const reportFile = join(workspaceDir, 'audit_report.txt');
  logCollector?.startStep('Report', 'Generate audit report');
  if (result.success && existsSync(reportFile)) {
    logger.error(`[Security Auditor] Security vulnerabilities detected in PR #${safePRNumber}!`);
    const reportContent = readFileSync(reportFile, 'utf-8');
    logCollector?.appendOutput(`Vulnerabilities found:\n${reportContent.slice(-2000)}\n`);

    if (cycleCount < 5) {
      const commentBody = await buildAuditFailComment(cycleCount, reportContent);
      await postPRComment(safePRNumber, commentBody);
      logCollector?.appendOutput('Posted vulnerability report as PR comment\n');
    } else {
      const commentBody = buildAuditCircuitBreakComment(reportContent);
      await postPRComment(safePRNumber, commentBody);
      logCollector?.appendOutput('Circuit breaker triggered, posted final report\n');
    }
    logCollector?.finishStep('Report', { conclusion: 'failure' });
  } else {
    logger.info(`[Security Auditor] PR #${safePRNumber} security audit passed.`);
    logCollector?.appendOutput('No vulnerabilities detected\n');
    logCollector?.finishStep('Report', { conclusion: 'success' });
  }
}
