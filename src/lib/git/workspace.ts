import { logger } from '../logger';
import { spawnAsync } from '../exec';
import { getPRInfo } from '../github/api';

/**
 * 验证分支名是否安全（仅允许 Git refname 合法字符）
 *
 * 防御命令注入：恶意分支名可能包含 shell 元字符（; | & ` $() 等），
 * 即使使用 spawnAsync 不经过 shell，分支名仍必须符合 Git 规范。
 */
export function validateBranchName(name: string): string {
  if (
    !name ||
    typeof name !== 'string' ||
    name.includes(' ') ||
    name.includes('..') ||
    /[~^:?*[\]\\]/.test(name) ||
    name.startsWith('-') ||
    name.endsWith('.lock') ||
    name.includes('\n') ||
    name.includes('\r') ||
    name.includes('\0')
  ) {
    throw new Error(`Unsafe branch name: ${JSON.stringify(name)}`);
  }
  return name;
}

/**
 * 校验 PR 编号（必须为正整数）
 */
export function validatePRNumber(prNumber: number): number {
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(`Unsafe PR number: ${prNumber}`);
  }
  return prNumber;
}

/**
 * 校验 Issue 编号（必须为正整数）
 */
export function validateIssueNumber(issueNumber: number): number {
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new Error(`Unsafe issue number: ${issueNumber}`);
  }
  return issueNumber;
}

/**
 * 切换到 PR 对应的分支
 */
export async function checkoutPRBranch(prNumber: number): Promise<void> {
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;
  const workspaceDir = process.env.WORKSPACE_DIR || '.';

  if (!owner || !repo) {
    throw new Error('REPO_OWNER and REPO_NAME must be set');
  }

  // 1. 反查 PR 源头分支
  const pr = await getPRInfo(prNumber);
  const branchName = validateBranchName(pr.head.ref as string);
  logger.info(`Checking out branch: ${branchName}`);

  // 2. 清理工作区
  await spawnAsync('git', ['checkout', '.'], { cwd: workspaceDir });
  await spawnAsync('git', ['clean', '-fd'], { cwd: workspaceDir });

  // 3. 切换分支
  await spawnAsync('git', ['fetch', 'origin', branchName], { cwd: workspaceDir });
  await spawnAsync('git', ['checkout', branchName], { cwd: workspaceDir });
  await spawnAsync('git', ['pull', 'origin', branchName], { cwd: workspaceDir });

  // 4. 同步主分支
  const mergeResult = await spawnAsync('git', ['merge', 'origin/main', '--no-edit'], {
    cwd: workspaceDir,
  });
  if (mergeResult.exitCode !== 0) {
    throw new Error('Merge conflict detected');
  }
  logger.info('Successfully merged with main branch');
}
