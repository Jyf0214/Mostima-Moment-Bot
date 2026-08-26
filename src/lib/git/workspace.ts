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
 * 将目标仓库克隆到 ~/owner__repo/ 下。若目录已存在则重置到默认分支。
 * 返回工作区绝对路径。
 *
 * 此前目录名只取仓库名（忽略 owner），不同账号的同名仓库会映射到同一目录，
 * 造成跨仓库代码污染；且并发 webhook 会同时对同一目录克隆/重置。
 */
/** 每个目录的互斥锁：并发到达的 webhook 串行化初始化，避免双克隆与半成品目录 */
const workspaceLocks = new Map<string, Promise<void>>();

function withWorkspaceLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = workspaceLocks.get(dir) ?? Promise.resolve();
  // 前一个任务无论成败都不阻塞后续；对外保留原始结果
  const run = prev.then(fn, fn);
  const stored = run.then(
    () => undefined,
    () => undefined
  );
  workspaceLocks.set(dir, stored);
  void stored.finally(() => {
    if (workspaceLocks.get(dir) === stored) {
      workspaceLocks.delete(dir);
    }
  });
  return run;
}

/** 探测远端默认分支（origin/HEAD），失败时回落 main */
async function detectDefaultBranch(cwd: string): Promise<string> {
  const r = await spawnAsync('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], {
    cwd,
  });
  const out = (r.stdout || '').trim();
  if (r.exitCode === 0 && out.startsWith('origin/')) {
    return out.slice('origin/'.length);
  }
  return 'main';
}

/** 切回默认分支并硬重置；任一步失败即抛错，由调用方决定是否重新克隆 */
async function resetToDefaultBranch(cwd: string, defaultBranch: string): Promise<void> {
  const steps: string[][] = [
    ['checkout', defaultBranch],
    ['reset', '--hard', `origin/${defaultBranch}`],
    ['clean', '-fd'],
  ];
  for (const args of steps) {
    const r = await spawnAsync('git', args, { cwd });
    if (r.exitCode !== 0) {
      throw new Error(
        `git ${args.join(' ')} failed (exit ${r.exitCode}): ${(r.stderr || r.stdout || '').slice(0, 300)}`
      );
    }
  }
}

export async function getOrCreateWorkspace(repoFullName: string): Promise<string> {
  if (!repoFullName || !repoFullName.includes('/')) {
    throw new Error(`Invalid repo full name: ${repoFullName}`);
  }

  const [owner, repoName] = repoFullName.split('/');
  // 目录名进入用户主目录，必须防路径穿越（如 "a/../../etc"）
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repoName)) {
    throw new Error(`Unsafe repo full name: ${repoFullName}`);
  }
  const workspaceDir = join(homedir(), `${owner}__${repoName}`);

  return withWorkspaceLock(workspaceDir, async () => {
    if (existsSync(workspaceDir)) {
      logger.info(`[Workspace] Repo exists, fetching latest: ${workspaceDir}`);
      const fetchResult = await spawnAsync('git', ['fetch', 'origin'], { cwd: workspaceDir });
      let needClone = fetchResult.exitCode !== 0;

      if (!needClone) {
        // 切回默认分支并重置；默认分支可能是 master 而非 main
        try {
          const defaultBranch = await detectDefaultBranch(workspaceDir);
          await resetToDefaultBranch(workspaceDir, defaultBranch);
        } catch (err) {
          logger.warn('[Workspace] Reset to default branch failed, re-cloning', err);
          needClone = true;
        }
      }

      if (needClone) {
        logger.warn(`[Workspace] Re-cloning ${repoFullName}`);
        await spawnAsync('rm', ['-rf', workspaceDir]);
        await cloneRepo(repoFullName, workspaceDir);
      }
    } else {
      // 不存在：克隆仓库
      await cloneRepo(repoFullName, workspaceDir);
    }

    logger.info(`[Workspace] Workspace ready: ${workspaceDir}`);
    return workspaceDir;
  });
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

  // 2. 清理工作区（失败即抛，避免带着脏状态切分支）
  const cleanResult = await spawnAsync('git', ['checkout', '.'], { cwd });
  if (cleanResult.exitCode !== 0) {
    throw new Error(`git checkout . failed: ${(cleanResult.stderr || '').slice(0, 300)}`);
  }
  await spawnAsync('git', ['clean', '-fd'], { cwd });

  // 3. 切换分支
  const fetchBranch = await spawnAsync('git', ['fetch', 'origin', branchName], { cwd });
  if (fetchBranch.exitCode !== 0) {
    throw new Error(
      `git fetch ${branchName} failed (exit ${fetchBranch.exitCode}): ${(fetchBranch.stderr || '').slice(0, 300)}`
    );
  }
  const coResult = await spawnAsync('git', ['checkout', branchName], { cwd });
  if (coResult.exitCode !== 0) {
    throw new Error(
      `git checkout ${branchName} failed (exit ${coResult.exitCode}): ${(coResult.stderr || '').slice(0, 300)}`
    );
  }
  const pullResult = await spawnAsync('git', ['pull', 'origin', branchName], { cwd });
  if (pullResult.exitCode !== 0) {
    throw new Error(
      `git pull ${branchName} failed (exit ${pullResult.exitCode}): ${(pullResult.stderr || '').slice(0, 300)}`
    );
  }

  // 4. 同步主分支（默认分支可能是 master 而非 main）
  const defaultBranch = await detectDefaultBranch(cwd);
  const mergeResult = await spawnAsync('git', ['merge', `origin/${defaultBranch}`, '--no-edit'], {
    cwd,
  });
  if (mergeResult.exitCode !== 0) {
    throw new Error('Merge conflict detected');
  }
  logger.info(`Successfully merged with ${defaultBranch} branch`);
}
