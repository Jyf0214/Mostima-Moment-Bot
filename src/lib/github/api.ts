import { Octokit } from 'octokit';
import { generateJWT } from './auth';

let octokitInstance: Octokit | null = null;

/**
 * 获取认证后的 Octokit 实例
 */
export async function getOctokit(): Promise<Octokit> {
  if (octokitInstance) {
    return octokitInstance;
  }

  const appId = process.env.GITHUB_APP_ID;
  const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;

  if (!appId || !privateKeyPath) {
    throw new Error('GITHUB_APP_ID and GITHUB_PRIVATE_KEY_PATH must be set');
  }

  const jwt = generateJWT(appId, privateKeyPath);

  octokitInstance = new Octokit({
    auth: jwt,
  });

  return octokitInstance;
}

/**
 * 在 PR 下发表评论
 */
export async function postPRComment(prNumber: number, body: string): Promise<void> {
  const octokit = await getOctokit();
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;

  if (!owner || !repo) {
    throw new Error('REPO_OWNER and REPO_NAME must be set');
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}
