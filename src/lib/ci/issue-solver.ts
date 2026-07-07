import { logger } from '../logger';
import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  runQwen,
  getOrCreateSessionId,
  injectBranchProtection,
  createLspConfig,
} from '../qwen/runner';
import {
  buildIssueFixInitialPrompt,
  buildIssueFixResumePrompt,
  buildIssueFixReply,
} from '../qwen/prompts';
import { getBotMention } from './config';
import { validateBranchName, validateIssueNumber } from '../git/workspace';
import type { LogCollector } from './log-collector';

interface IssuePayload {
  issue: {
    number: number;
    title: string;
    body: string;
  };
  label?: { name: string };
  comment?: { body: string; author_association: string; user: { login: string } };
}

/**
 * 判断是否应触发 Issue 自动修复
 *
 * 触发条件：
 * 1. Issue 被贴上 `auto-fix` 标签
 * 2. 评论以 `@{botSlug} /fix` 开头，且评论者是 OWNER/MEMBER/COLLABORATOR
 */
export async function shouldTriggerIssueFix(
  eventName: string,
  payload: IssuePayload,
  fixCmdOverride?: string
): Promise<boolean> {
  if (eventName === 'issues' && payload.label?.name === 'auto-fix') {
    logger.info(`[Issue Solver] Triggered by label "auto-fix" on Issue #${payload.issue.number}`);
    return true;
  }

  if (eventName === 'issue_comment') {
    const body = payload.comment?.body || '';
    const assoc = payload.comment?.author_association || '';
    const fixCmd = fixCmdOverride || `${await getBotMention()} /fix`;
    const isFixCommand = body.startsWith(fixCmd);
    const isAuthorized = ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(assoc);

    logger.info(
      `[Issue Solver] issue_comment check: ` +
        `body="${body.slice(0, 80)}", fixCmd="${fixCmd}", ` +
        `isFixCommand=${isFixCommand}, authorAssoc="${assoc}", isAuthorized=${isAuthorized}`
    );

    return isFixCommand && isAuthorized;
  }

  return false;
}

/**
 * Issue 自动修复主流程
 *
 * 完整复原规则：
 * - 物理分支保护（禁止直推 main）
 * - 会话持久化（断点续传）
 * - Prompt 临时文件（避免 Shell 注入）
 * - todo_checklist.md 清单销项
 * - 自愈重试 + 压缩机制
 * - 生动回复 Issue
 *
 * 安全措施：
 * - 所有 git/gh 命令使用 execFileSync（不经过 shell）
 * - 分支名通过 validateBranchName 校验
 * - Issue 编号通过 validateIssueNumber 校验
 * - gh issue comment 的 --body 使用 execFileSync 数组参数传递，避免 shell 注入
 */
export async function solveIssue(
  eventName: string,
  payload: IssuePayload,
  workspaceDir: string,
  logCollector?: LogCollector
): Promise<void> {
  const issueNumber = validateIssueNumber(payload.issue.number);
  const issueTitle = payload.issue.title;
  const issueBody = payload.issue.body || '';
  const commentBody = payload.comment?.body || '';

  logCollector?.addMessage(`Processing Issue #${issueNumber}: ${issueTitle}`);
  logger.info(`[Issue Solver] Processing Issue #${issueNumber}: ${issueTitle}`);

  // 1. 分支保护
  logCollector?.startStep('Setup', 'Branch protection + LSP config');
  injectBranchProtection(workspaceDir);
  createLspConfig(workspaceDir);
  logCollector?.finishStep('Setup', { conclusion: 'success' });

  // 2. 会话持久化
  const { sessionId, isResume } = getOrCreateSessionId(`issue-${issueNumber}`);
  logCollector?.addMessage(`Session: ${sessionId.slice(0, 8)}... (resume: ${isResume})`);

  // 3. 分支管理
  let prBranch = `fix/issue-${issueNumber}`;

  logCollector?.startStep('Branch', `Managing branch for Issue #${issueNumber}`);
  if (eventName === 'issue_comment') {
    try {
      // gh pr view 返回的分支名来自 GitHub API，必须校验
      const prView = execFileSync(
        'gh',
        ['pr', 'view', String(issueNumber), '--json', 'headRefName', '--jq', '.headRefName'],
        {
          cwd: workspaceDir,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      ).trim();
      if (prView) {
        prBranch = validateBranchName(prView);
      }
      logCollector?.appendOutput(`PR branch: ${prBranch}\n`);
    } catch (error) {
      logger.warn(
        `[Issue Solver] Failed to get PR branch (issue #${issueNumber}), using default branch:`,
        error
      );
      logCollector?.appendOutput(`Failed to get PR branch, using default: ${prBranch}\n`);
    }

    try {
      logCollector?.appendOutput(`Fetching ${prBranch}...\n`);
      execFileSync('git', ['fetch', 'origin', prBranch], { cwd: workspaceDir, stdio: 'pipe' });
      logCollector?.appendOutput(`Checking out ${prBranch}...\n`);
      execFileSync('git', ['checkout', prBranch], { cwd: workspaceDir, stdio: 'pipe' });
      logCollector?.appendOutput('Fetching main...\n');
      execFileSync('git', ['fetch', 'origin', 'main'], { cwd: workspaceDir, stdio: 'pipe' });
      logCollector?.appendOutput('Merging origin/main...\n');
      execFileSync('git', ['merge', 'origin/main', '--no-edit'], {
        cwd: workspaceDir,
        stdio: 'pipe',
      });
      logCollector?.appendOutput('Merge completed successfully\n');
    } catch (err) {
      logger.warn(`[Issue Solver] Merge conflict detected, leaving for Qwen to resolve:`, err);
      logCollector?.appendOutput('Merge conflict detected, will be resolved by Qwen\n');
    }
  } else {
    try {
      logCollector?.appendOutput(`Creating branch ${prBranch}...\n`);
      execFileSync('git', ['checkout', '-b', prBranch], { cwd: workspaceDir, stdio: 'pipe' });
    } catch (err) {
      logger.warn(`[Issue Solver] Branch ${prBranch} already exists, checking out:`, err);
      logCollector?.appendOutput(`Branch exists, checking out ${prBranch}...\n`);
      execFileSync('git', ['checkout', prBranch], { cwd: workspaceDir, stdio: 'pipe' });
    }
  }
  logCollector?.finishStep('Branch', { conclusion: 'success' });

  // 4. 写入 Issue 详情文件
  const issueFile = join(workspaceDir, 'issue_details.md');
  writeFileSync(issueFile, `# Issue #${issueNumber}: ${issueTitle}\n\n${issueBody}`);

  // 5. 构建 Prompt
  let prompt = '';

  if (isResume && eventName === 'issue_comment') {
    const botMention = await getBotMention();
    const userFeedback = commentBody
      .replace(new RegExp(`^${botMention}\\s*\\/fix\\s*`, 'i'), '')
      .trim();
    prompt = buildIssueFixResumePrompt(prBranch, userFeedback);
    logCollector?.addMessage('Resuming with user feedback...');
  } else {
    prompt = buildIssueFixInitialPrompt(prBranch, issueNumber);
    logCollector?.addMessage('Starting initial fix...');
  }

  // 6. 执行 Qwen Code
  logCollector?.addMessage('Executing Qwen Code...');
  const result = await runQwen(prompt, {
    sessionId,
    maxSessionTurns: 100,
    resume: isResume,
    logCollector,
  });

  if (!result.success) {
    logger.error(`[Issue Solver] Failed after ${result.attempts} attempts`);
    logCollector?.addMessage(`Failed after ${result.attempts} attempts`);
    return;
  }

  logCollector?.addMessage(`Qwen completed in ${result.duration}ms (${result.attempts} attempts)`);

  // 7. 提交并推送
  logCollector?.startStep('Push', 'Git add, commit & push');
  try {
    logCollector?.appendOutput('git add -A\n');
    execFileSync('git', ['add', '-A'], { cwd: workspaceDir, stdio: 'pipe' });
    logCollector?.appendOutput(`git commit -m "fix: auto-fix Issue #${issueNumber}"\n`);
    execFileSync('git', ['commit', '-m', `fix: auto-fix Issue #${issueNumber}`], {
      cwd: workspaceDir,
      stdio: 'pipe',
    });
    logCollector?.appendOutput(`git push origin ${prBranch}\n`);
    execFileSync('git', ['push', 'origin', prBranch], { cwd: workspaceDir, stdio: 'pipe' });
    logCollector?.appendOutput('Push completed successfully\n');

    // 8. 创建或更新 PR
    if (!isResume || eventName === 'issues') {
      logCollector?.startStep('PR', `Create PR for Issue #${issueNumber}`);
      try {
        logCollector?.appendOutput('gh pr create...\n');
        execFileSync(
          'gh',
          [
            'pr',
            'create',
            '--title',
            `fix: Issue #${issueNumber}`,
            '--body',
            `Automated fix for Issue #${issueNumber}`,
            '--head',
            prBranch,
            '--base',
            'main',
          ],
          { cwd: workspaceDir, stdio: 'pipe' }
        );
        logCollector?.appendOutput('PR created successfully\n');
        logCollector?.finishStep('PR', { conclusion: 'success' });
      } catch (err) {
        logger.info(`[Issue Solver] PR for Issue #${issueNumber} already exists:`, err);
        logCollector?.appendOutput('PR already exists\n');
        logCollector?.finishStep('PR', { conclusion: 'success' });
      }
    }

    // 9. 回复 Issue — 使用 execFileSync 避免 shell 注入
    logCollector?.startStep('Comment', `Reply to Issue #${issueNumber}`);
    const replyBody = buildIssueFixReply(issueNumber, prBranch);
    try {
      logCollector?.appendOutput('gh issue comment...\n');
      execFileSync('gh', ['issue', 'comment', String(issueNumber), '--body', replyBody], {
        cwd: workspaceDir,
        stdio: 'pipe',
      });
      logCollector?.appendOutput('Comment posted successfully\n');
      logCollector?.finishStep('Comment', { conclusion: 'success' });
    } catch (err) {
      logger.warn('[Issue Solver] Failed to post issue comment:', err);
      logCollector?.appendOutput('Failed to post comment\n');
      logCollector?.finishStep('Comment', { conclusion: 'failure' });
    }

    logCollector?.finishStep('Push', { conclusion: 'success' });
    logger.info(`[Issue Solver] Issue #${issueNumber} fixed successfully.`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[Issue Solver] Git push failed: ${msg}`);
    logCollector?.finishStep('Push', { conclusion: 'failure', output: msg });
  }
}
