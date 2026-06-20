import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
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
import { getFixCommand, getBotMention } from './config';

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
 * 2. 评论以 `@{BOT_NAME} /fix` 开头，且评论者是 OWNER/MEMBER/COLLABORATOR
 */
export function shouldTriggerIssueFix(eventName: string, payload: IssuePayload): boolean {
  if (eventName === 'issues' && payload.label?.name === 'auto-fix') {
    return true;
  }

  if (eventName === 'issue_comment') {
    const body = payload.comment?.body || '';
    const assoc = payload.comment?.author_association || '';
    const fixCmd = getFixCommand();
    const isFixCommand = body.startsWith(fixCmd);
    const isAuthorized = ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(assoc);
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
 */
export async function solveIssue(
  eventName: string,
  payload: IssuePayload,
  workspaceDir: string
): Promise<void> {
  const issueNumber = payload.issue.number;
  const issueTitle = payload.issue.title;
  const issueBody = payload.issue.body || '';
  const commentBody = payload.comment?.body || '';

  console.log(`[Issue Solver] Processing Issue #${issueNumber}: ${issueTitle}`);

  // 1. 分支保护
  injectBranchProtection(workspaceDir);
  createLspConfig(workspaceDir);

  // 2. 会话持久化
  const { sessionId, isResume } = getOrCreateSessionId(`issue-${issueNumber}`);

  // 3. 分支管理
  let prBranch = `fix/issue-${issueNumber}`;

  if (eventName === 'issue_comment') {
    try {
      const prView = execSync(`gh pr view ${issueNumber} --json headRefName --jq .headRefName`, {
        cwd: workspaceDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      if (prView) prBranch = prView;
    } catch {
      // 使用默认分支名
    }

    try {
      execSync(`git fetch origin ${prBranch}`, { cwd: workspaceDir, stdio: 'pipe' });
      execSync(`git checkout ${prBranch}`, { cwd: workspaceDir, stdio: 'pipe' });
      execSync('git fetch origin main', { cwd: workspaceDir, stdio: 'pipe' });
      execSync('git merge origin/main --no-edit', { cwd: workspaceDir, stdio: 'pipe' });
    } catch {
      console.warn('[Issue Solver] Merge conflict detected, leaving for Qwen to resolve');
    }
  } else {
    try {
      execSync(`git checkout -b ${prBranch}`, { cwd: workspaceDir, stdio: 'pipe' });
    } catch {
      execSync(`git checkout ${prBranch}`, { cwd: workspaceDir, stdio: 'pipe' });
    }
  }

  // 4. 写入 Issue 详情文件
  const issueFile = join(workspaceDir, 'issue_details.md');
  writeFileSync(issueFile, `# Issue #${issueNumber}: ${issueTitle}\n\n${issueBody}`);

  // 5. 构建 Prompt
  let prompt = '';

  if (isResume && eventName === 'issue_comment') {
    const userFeedback = commentBody
      .replace(new RegExp(`^${getBotMention()}\\s*\\/fix\\s*`, 'i'), '')
      .trim();
    prompt = buildIssueFixResumePrompt(prBranch, userFeedback);
  } else {
    prompt = buildIssueFixInitialPrompt(prBranch, issueNumber);
  }

  // 6. 执行 Qwen Code
  const result = await runQwen(prompt, {
    sessionId,
    maxSessionTurns: 100,
    resume: isResume,
  });

  if (!result.success) {
    console.error(`[Issue Solver] Failed after ${result.attempts} attempts`);
    return;
  }

  // 7. 提交并推送
  try {
    execSync('git add -A', { cwd: workspaceDir, stdio: 'pipe' });
    execSync(`git commit -m "fix: auto-fix Issue #${issueNumber}"`, {
      cwd: workspaceDir,
      stdio: 'pipe',
    });
    execSync(`git push origin ${prBranch}`, { cwd: workspaceDir, stdio: 'pipe' });

    // 8. 创建或更新 PR
    if (!isResume || eventName === 'issues') {
      try {
        execSync(
          `gh pr create --title "fix: Issue #${issueNumber}" --body "Automated fix for Issue #${issueNumber}" --head ${prBranch} --base main`,
          { cwd: workspaceDir, stdio: 'pipe' }
        );
      } catch {
        // PR 已存在
      }
    }

    // 9. 回复 Issue
    const replyBody = buildIssueFixReply(issueNumber, prBranch);
    try {
      execSync(`gh issue comment ${issueNumber} --body "${replyBody.replace(/"/g, '\\"')}"`, {
        cwd: workspaceDir,
        stdio: 'pipe',
      });
    } catch {
      console.warn('[Issue Solver] Failed to post issue comment');
    }

    console.log(`[Issue Solver] Issue #${issueNumber} fixed successfully.`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Issue Solver] Git push failed: ${msg}`);
  }
}
