import { checkoutPRBranch } from '../git/workspace';
import { generatePRReport } from './reporter';
import { postPRComment } from '../github/api';
import { executeCheckStep, createSkipResult } from './checks';

export interface PRPayload {
  pull_request: { number: number };
}

export interface CommentPayload {
  comment: { body: string; user: { login: string } };
  issue: { number: number };
}

export interface WorkflowPayload {
  workflow_run: { name: string; conclusion: string };
}

export interface CheckResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  output?: string;
  exitCode: number;
}

/**
 * 执行完整的 CI 检查流程
 */
export async function runCIChecks(): Promise<CheckResult[]> {
  const steps = [
    { name: 'Dependencies', command: 'npm ci' },
    { name: 'Lint', command: 'npm run lint' },
    { name: 'TypeScript', command: 'npx tsc --noEmit' },
    { name: 'Build', command: 'npm run build' },
  ];

  const results: CheckResult[] = [];
  const workspaceDir = process.env.WORKSPACE_DIR || '.';

  for (const step of steps) {
    const result = executeCheckStep(step.name, step.command, workspaceDir);
    results.push(result);

    // 如果失败，后续步骤标记为 SKIP
    if (result.status === 'FAIL') {
      const remainingSteps = steps.slice(steps.indexOf(step) + 1);
      for (const remaining of remainingSteps) {
        results.push(createSkipResult(remaining.name));
      }
      break;
    }
  }

  return results;
}

/**
 * 处理 pull_request 事件
 */
export async function handlePullRequest(payload: PRPayload): Promise<void> {
  const prNumber = payload.pull_request.number;
  console.log(`Triggering CI checks for PR #${prNumber}`);

  try {
    // 1. 切换分支
    await checkoutPRBranch(prNumber);

    // 2. 执行 CI 检查
    const results = await runCIChecks();

    // 3. 生成报告
    const report = generatePRReport(prNumber, results);

    // 4. 发送 PR 评论
    await postPRComment(prNumber, report);

    console.log(`CI checks completed for PR #${prNumber}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`CI failed for PR #${prNumber}:`, message);

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
export async function handleIssueComment(payload: CommentPayload): Promise<void> {
  const comment = payload.comment.body;
  const issueNumber = payload.issue.number;
  const commenter = payload.comment.user.login;

  // 检查是否为合作者
  const isCollaborator = await checkCollaborator(commenter);
  if (!isCollaborator) {
    console.log(`Unauthorized: ${commenter} is not a collaborator`);
    return;
  }

  // 检查是否为重试命令
  if (comment.includes('/rebuild') || comment.includes('/retry')) {
    console.log(`Manual rebuild triggered for PR #${issueNumber} by ${commenter}`);
    await handlePullRequest({ pull_request: { number: issueNumber } });
  }
}

/**
 * 处理 workflow_run 事件
 */
export async function handleWorkflowRun(payload: WorkflowPayload): Promise<void> {
  const workflowName = payload.workflow_run.name;
  const conclusion = payload.workflow_run.conclusion;
  console.log(`Workflow ${workflowName} completed with conclusion: ${conclusion}`);
}

/**
 * 检查用户是否为仓库合作者
 */
async function checkCollaborator(username: string): Promise<boolean> {
  // 简单实现：检查环境变量中的合作者列表
  const collaborators = process.env.COLLABORATORS?.split(',') || [];
  return collaborators.includes(username);
}
