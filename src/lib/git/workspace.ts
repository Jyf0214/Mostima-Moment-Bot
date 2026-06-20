import { execSync } from 'child_process';
import { getPRInfo } from '../github/api';

/**
 * 验证分支名是否安全（仅允许 Git refname 合法字符）
 */
function validateBranchName(name: string): void {
  // Git refname 规则：不允许空格、~^:?*[\\、连续的 ..、以 - 开头、以 .lock 结尾
  if (
    !name ||
    name.includes(' ') ||
    name.includes('..') ||
    /[~^:?*[\]\\]/.test(name) ||
    name.startsWith('-') ||
    name.endsWith('.lock')
  ) {
    throw new Error(`Unsafe branch name: ${name}`);
  }
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
  const branchName = pr.head.ref as string;

  validateBranchName(branchName);
  console.log(`Checking out branch: ${branchName}`);

  // 2. 清理工作区
  execSync('git checkout .', { cwd: workspaceDir, stdio: 'pipe' });
  execSync('git clean -fd', { cwd: workspaceDir, stdio: 'pipe' });

  // 3. 切换分支（使用 -- 作为 ref 分隔符防止注入）
  execSync(`git fetch origin -- ${branchName}`, { cwd: workspaceDir, stdio: 'pipe' });
  execSync(`git checkout -- ${branchName}`, { cwd: workspaceDir, stdio: 'pipe' });
  execSync(`git pull origin -- ${branchName}`, { cwd: workspaceDir, stdio: 'pipe' });

  // 4. 同步主分支
  try {
    execSync('git merge origin/main --no-edit', { cwd: workspaceDir, stdio: 'pipe' });
    console.log('Successfully merged with main branch');
  } catch (error) {
    throw new Error('Merge conflict detected');
  }
}
