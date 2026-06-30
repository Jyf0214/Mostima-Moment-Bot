import { generateJWT, getAppId, getPrivateKey } from './auth';
import { logger } from '@/lib/logger';

let accessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * 获取 GitHub App 访问令牌
 */
async function getAccessToken(): Promise<string> {
  // 如果令牌有效，直接返回
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const appId = await getAppId();
  const privateKey = await getPrivateKey();

  // 生成 JWT
  const jwt = generateJWT(appId, privateKey);

  // 获取安装列表
  const installationsResponse = await fetch('https://api.github.com/app/installations', {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!installationsResponse.ok) {
    throw new Error(`Failed to get installations: ${installationsResponse.statusText}`);
  }

  const installations = (await installationsResponse.json()) as Array<{ id: number }>;
  if (installations.length === 0) {
    throw new Error('No installations found for this GitHub App');
  }

  // 使用第一个安装的 ID 获取访问令牌
  const installationId = installations[0].id;
  const tokenResponse = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.statusText}`);
  }

  interface TokenData {
    token: string;
    expires_at?: string;
  }
  const tokenData = (await tokenResponse.json()) as TokenData;
  accessToken = tokenData.token;
  tokenExpiry =
    Date.now() +
    (tokenData.expires_at ? new Date(tokenData.expires_at).getTime() - Date.now() : 3600000);

  return accessToken!;
}

/**
 * 执行 GitHub API 请求，401 时自动清除 token 缓存并重试一次
 *
 * @param requester - 接受 token 参数并返回 Response 的请求函数
 * @returns 最终的 Response（可能是首次或重试的结果）
 */
async function githubRequestWithRetry(
  requester: (token: string) => Promise<Response>
): Promise<Response> {
  const token = await getAccessToken();
  let response = await requester(token);

  if (response.status === 401) {
    logger.warn('[GitHub API] Request returned 401, clearing token cache and retrying');
    accessToken = null;
    tokenExpiry = 0;
    const retryToken = await getAccessToken();
    response = await requester(retryToken);
  }

  return response;
}

/**
 * 在 PR 下发表评论
 */
export async function postPRComment(prNumber: number, body: string): Promise<void> {
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;

  if (!owner || !repo) {
    throw new Error('REPO_OWNER and REPO_NAME must be set');
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

  const response = await githubRequestWithRetry((token) =>
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    })
  );

  if (!response.ok) {
    throw new Error(`Failed to post comment: ${response.statusText}`);
  }
}

interface PRInfo {
  head: { ref: string };
}

/**
 * 获取 PR 信息
 */
export async function getPRInfo(prNumber: number): Promise<PRInfo> {
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;

  if (!owner || !repo) {
    throw new Error('REPO_OWNER and REPO_NAME must be set');
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;

  const response = await githubRequestWithRetry((token) =>
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
  );

  if (!response.ok) {
    throw new Error(`Failed to get PR info: ${response.statusText}`);
  }

  return (await response.json()) as PRInfo;
}
