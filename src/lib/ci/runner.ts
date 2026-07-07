import { logger } from '../logger';
import { checkoutPRBranch } from '../git/workspace';
import { generatePRReport } from './reporter';
import { postPRComment } from '../github/api';
import { executeCheckStep, createSkipResult } from './checks';
import type { PRPayload, CommentPayload, WorkflowPayload, CheckResult } from './types';
import type { LogCollector } from './log-collector';

export type { PRPayload, CommentPayload, WorkflowPayload, CheckResult };

/**
 * 执行完整的 CI 检查流程
 */
export async function runCIChecks(logCollector?: LogCollector): Promise<CheckResult[]> {
  const steps = [
    { name: 'Dependencies', command: 'npm ci' },
    { name: 'Lint', command: 'npm run lint' },
    { name: 'TypeScript', command: 'npx tsc --noEmit' },
    { name: 'Build', command: 'npm run build' },
  ];

  const results: CheckResult[] = [];
  const workspaceDir = process.env.WORKSPACE_DIR || '.';

  for (const step of steps) {
    const result = await executeCheckStep(step.name, step.command, workspaceDir, logCollector);
    results.push(result);

    // 如果失败，后续步骤标记为 SKIP
    if (result.status === 'FAIL') {
      const remainingSteps = steps.slice(steps.indexOf(step) + 1);
      for (const remaining of remainingSteps) {
        results.push(createSkipResult(remaining.name, logCollector));
      }
      break;
    }
  }

  return results;
}

/**
 * 处理 pull_request 事件
 */
export async function handlePullRequest(
  payload: PRPayload,
  logCollector?: LogCollector
): Promise<void> {
  const prNumber = payload.pull_request?.number;
  if (typeof prNumber !== 'number') {
    logger.error('[CI Runner] handlePullRequest: missing pull_request.number');
    return;
  }
  logger.info(`Triggering CI checks for PR #${prNumber}`);

  logCollector?.addMessage(`Starting CI pipeline for PR #${prNumber}`);

  try {
    // 1. 切换分支
    logCollector?.startStep('Checkout', `git fetch & checkout PR #${prNumber}`);
    try {
      await checkoutPRBranch(prNumber);
      logCollector?.finishStep('Checkout', { conclusion: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logCollector?.finishStep('Checkout', { conclusion: 'failure', output: msg });
      throw err;
    }

    // 2. 执行 CI 检查
    logCollector?.addMessage('Running CI checks...');
    const results = await runCIChecks(logCollector);

    // 3. 生成报告
    const report = generatePRReport(prNumber, results);

    // 4. 发送 PR 评论
    logCollector?.startStep('Comment', `Post PR #${prNumber} comment`);
    await postPRComment(prNumber, report);
    logCollector?.finishStep('Comment', { conclusion: 'success' });

    logger.info(`CI checks completed for PR #${prNumber}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`CI failed for PR #${prNumber}:`, message);

    // 发送失败报告
    const failReport = generatePRReport(prNumber, [
      {
        step: 'CI Pipeline',
        status: 'FAIL',
        duration: 0,
        output: message,
        exitCode: 1,
      },
    ]);
    await postPRComment(prNumber, failReport);
  }
}

/**
 * 处理 issue_comment 事件（手动重试）
 */
export async function handleIssueComment(
  payload: CommentPayload,
  logCollector?: LogCollector
): Promise<void> {
  const commentBody = payload.comment?.body;
  const issueNumber = payload.issue?.number;
  const commenter = payload.comment?.user?.login;

  if (!commentBody || typeof issueNumber !== 'number' || !commenter) {
    logger.error('[CI Runner] handleIssueComment: missing required fields');
    return;
  }

  // 检查是否为合作者
  const isCollaborator = await checkCollaborator(commenter);
  if (!isCollaborator) {
    logger.info(`Unauthorized: ${commenter} is not a collaborator`);
    return;
  }

  // 检查是否为重试命令（前缀匹配，避免 "DO NOT /rebuild" 等误触发）
  const trimmedBody = commentBody.trimStart();
  if (trimmedBody.startsWith('/rebuild') || trimmedBody.startsWith('/retry')) {
    logger.info(`Manual rebuild triggered for PR #${issueNumber} by ${commenter}`);
    await handlePullRequest({ pull_request: { number: issueNumber } }, logCollector);
  }
}

/**
 * 处理 workflow_run 事件
 */
export async function handleWorkflowRun(payload: WorkflowPayload): Promise<void> {
  const workflowName = payload.workflow_run?.name || 'unknown';
  const conclusion = payload.workflow_run?.conclusion || 'unknown';
  logger.info(`Workflow ${workflowName} completed with conclusion: ${conclusion}`);
}

/**
 * 检查用户是否为仓库合作者
 *
 * [安全说明] 当前实现仅检查环境变量中的合作者列表。
 * 这存在安全风险：任何能修改环境变量的人都可以绕过权限检查。
 * 生产环境建议通过 GitHub API 实时验证用户权限。
 *
 * TODO: 考虑使用 GitHub API 验证：
 *   GET /repos/{owner}/{repo}/collaborators/{username}
 *   或使用 octokit.rest.repos.checkCollaborator()
 */
async function checkCollaborator(username: string): Promise<boolean> {
  // 简单实现：检查环境变量中的合作者列表
  const collaboratorsRaw = process.env.COLLABORATORS || '';
  if (!collaboratorsRaw) {
    logger.warn(
      '[CI Runner] ⚠️ SECURITY WARNING: COLLABORATORS env var not set. ' +
        'All rebuild requests will be denied.'
    );
    return false;
  }

  const collaborators = collaboratorsRaw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const isCollab = collaborators.includes(username);

  if (!isCollab) {
    logger.info(`[CI Runner] User "${username}" is not in COLLABORATORS list`);
  }

  return isCollab;
}
