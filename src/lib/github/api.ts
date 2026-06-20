import { generateJWT, getAppId, getPrivateKey } from './auth';

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
 * 在 PR 下发表评论
 */
export async function postPRComment(prNumber: number, body: string): Promise<void> {
  const token = await getAccessToken();
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;

  if (!owner || !repo) {
    throw new Error('REPO_OWNER and REPO_NAME must be set');
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    }
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
  const token = await getAccessToken();
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;

  if (!owner || !repo) {
    throw new Error('REPO_OWNER and REPO_NAME must be set');
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get PR info: ${response.statusText}`);
  }

  return response.json();
}
