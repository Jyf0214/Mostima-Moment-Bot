import { generateJWT, getAppId, getPrivateKey } from './auth';

/**
 * 获取 GitHub App Installation 的访问令牌
 */
export async function getInstallationAccessToken(installationId: number): Promise<string> {
  const appId = await getAppId();
  const privateKey = await getPrivateKey();

  const jwt = generateJWT(appId, privateKey);

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get installation access token: ${response.statusText}`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  updated_at: string;
  owner: {
    login: string;
    type: string;
    avatar_url: string;
  };
}

interface ListReposResponse {
  total_count: number;
  repositories: GitHubRepo[];
}

/**
 * 列出 GitHub App 安装授权的仓库
 */
export async function listInstallationRepos(
  accessToken: string
): Promise<{ personal: GitHubRepo[]; organization: GitHubRepo[] }> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  // 分页获取所有仓库
  while (true) {
    const response = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list repositories: ${response.statusText}`);
    }

    const data: ListReposResponse = await response.json();
    repos.push(...data.repositories);

    if (repos.length >= data.total_count || data.repositories.length < 100) {
      break;
    }
    page++;
  }

  // 按账户类型分组
  const personal: GitHubRepo[] = [];
  const organization: GitHubRepo[] = [];

  for (const repo of repos) {
    if (repo.owner.type === 'Organization') {
      organization.push(repo);
    } else {
      personal.push(repo);
    }
  }

  // 按最后更新时间排序（最新的在前）
  personal.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  organization.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return { personal, organization };
}

/**
 * 获取 GitHub App 安装页面 URL
 */
export async function getInstallationUrl(state: string): Promise<string> {
  const { resolveBotSlug } = await import('@/lib/ci/config');
  const slug = await resolveBotSlug();
  if (!slug) {
    throw new Error(
      'GitHub App slug not available (configure GITHUB_APP_SLUG or ensure App is set up)'
    );
  }
  return `https://github.com/apps/${slug}/installations/new?state=${state}`;
}
