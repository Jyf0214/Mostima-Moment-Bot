import { execSync } from 'child_process';
import { getOctokit } from '../github/api';

/**
 * 切换到 PR 对应的分支
 */
export async function checkoutPRBranch(prNumber: number): Promise<void> {
  const octokit = await getOctokit();
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;
  const workspaceDir = process.env.WORKSPACE_DIR || '.';

  if (!owner || !repo) {
    throw new Error('REPO_OWNER and REPO_NAME must be set');
  }

  // 1. 反查 PR 源头分支
  const pr = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  const branchName = pr.data.head.ref;

  console.log(`Checking out branch: ${branchName}`);

  // 2. 清理工作区
  execSync('git checkout .', { cwd: workspaceDir, stdio: 'pipe' });
  execSync('git clean -fd', { cwd: workspaceDir, stdio: 'pipe' });

  // 3. 切换分支
  execSync(`git fetch origin ${branchName}`, { cwd: workspaceDir, stdio: 'pipe' });
  execSync(`git checkout ${branchName}`, { cwd: workspaceDir, stdio: 'pipe' });
  execSync(`git pull origin ${branchName}`, { cwd: workspaceDir, stdio: 'pipe' });

  // 4. 同步主分支
  try {
    execSync('git merge origin/main --no-edit', { cwd: workspaceDir, stdio: 'pipe' });
    console.log('Successfully merged with main branch');
  } catch (error) {
    throw new Error('Merge conflict detected');
  }
}
