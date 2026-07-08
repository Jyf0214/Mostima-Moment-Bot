import { logger } from '../logger';
import { spawnAsync } from '../exec';
import { getPRInfo } from '../github/api';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';

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
 * 获取或创建工作区目录
 *
 * 将目标仓库克隆到 ~/repo-name/ 下。若目录已存在则拉取最新代码。
 * 返回工作区绝对路径。
 *
 * @param repoFullName - GitHub 仓库全名，如 "owner/repo-name"
 */
export async function getOrCreateWorkspace(repoFullName: string): Promise<string> {
  if (!repoFullName || !repoFullName.includes('/')) {
    throw new Error(`Invalid repo full name: ${repoFullName}`);
  }

  const repoName = repoFullName.split('/')[1];
  const workspaceDir = join(homedir(), repoName);

  if (existsSync(workspaceDir)) {
    // 已存在：拉取最新代码，重置到 main 分支
    logger.info(`[Workspace] Repo exists, fetching latest: ${workspaceDir}`);
    const fetchResult = await spawnAsync('git', ['fetch', 'origin'], { cwd: workspaceDir });
    if (fetchResult.exitCode !== 0) {
      logger.warn(`[Workspace] git fetch failed, re-cloning`, fetchResult.stderr);
      await spawnAsync('rm', ['-rf', workspaceDir]);
      await cloneRepo(repoFullName, workspaceDir);
    } else {
      // 切回 main 并重置
      await spawnAsync('git', ['checkout', 'main'], { cwd: workspaceDir });
      await spawnAsync('git', ['reset', '--hard', 'origin/main'], { cwd: workspaceDir });
      await spawnAsync('git', ['clean', '-fd'], { cwd: workspaceDir });
    }
  } else {
    // 不存在：克隆仓库
    await cloneRepo(repoFullName, workspaceDir);
  }

  logger.info(`[Workspace] Workspace ready: ${workspaceDir}`);
  return workspaceDir;
}

/**
 * 使用 gh CLI 克隆仓库
 */
async function cloneRepo(repoFullName: string, targetDir: string): Promise<void> {
  logger.info(`[Workspace] Cloning ${repoFullName} -> ${targetDir}`);
  const result = await spawnAsync('gh', ['repo', 'clone', repoFullName, targetDir], {
    stdio: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to clone ${repoFullName} (exit ${result.exitCode}): ${result.stderr || result.stdout}`
    );
  }
  logger.info(`[Workspace] Clone completed: ${repoFullName}`);
}

/**
 * 切换到 PR 对应的分支
 *
 * @param prNumber - PR 编号
 * @param workspaceDir - 工作区目录（可选，不传则使用环境变量或当前目录）
 */
export async function checkoutPRBranch(prNumber: number, workspaceDir?: string): Promise<void> {
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;
  const cwd = workspaceDir || process.env.WORKSPACE_DIR || '.';

  if (!owner || !repo) {
    throw new Error('REPO_OWNER and REPO_NAME must be set');
  }

  // 1. 反查 PR 源头分支
  const pr = await getPRInfo(prNumber);
  const branchName = validateBranchName(pr.head.ref as string);
  logger.info(`Checking out branch: ${branchName}`);

  // 2. 清理工作区
  await spawnAsync('git', ['checkout', '.'], { cwd });
  await spawnAsync('git', ['clean', '-fd'], { cwd });

  // 3. 切换分支
  await spawnAsync('git', ['fetch', 'origin', branchName], { cwd });
  await spawnAsync('git', ['checkout', branchName], { cwd });
  await spawnAsync('git', ['pull', 'origin', branchName], { cwd });

  // 4. 同步主分支
  const mergeResult = await spawnAsync('git', ['merge', 'origin/main', '--no-edit'], {
    cwd,
  });
  if (mergeResult.exitCode !== 0) {
    throw new Error('Merge conflict detected');
  }
  logger.info('Successfully merged with main branch');
}
