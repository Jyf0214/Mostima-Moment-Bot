import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getInstallationAccessToken, listInstallationRepos } from '@/lib/github/installation';

const JWT_SECRET = process.env.JWT_SECRET;

interface JwtPayload {
  githubId: number;
}

interface RepoConfig {
  repoId: number;
  enabled: boolean;
}

/**
 * 列出当前管理员关联的 GitHub App 安装授权仓库
 * GET /api/github/repos
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let adminGithubId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    adminGithubId = decoded.githubId;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const admin = await prisma.admin.findUnique({
    where: { githubId: adminGithubId },
    include: {
      installations: { where: { isActive: true } },
      repoConfigs: true,
    },
  });

  if (!admin || admin.installations.length === 0) {
    return res.status(200).json({ personal: [], organization: [], installations: [] });
  }

  // 构建 repoId -> enabled 映射
  const configMap = new Map<number, boolean>();
  for (const cfg of admin.repoConfigs) {
    configMap.set(cfg.repoId, cfg.enabled);
  }

  const allPersonal: unknown[] = [];
  const allOrganization: unknown[] = [];

  for (const installation of admin.installations) {
    try {
      const accessToken = await getInstallationAccessToken(installation.installationId);
      const repos = await listInstallationRepos(accessToken);

      // 附加 config 状态
      allPersonal.push(
        ...repos.personal.map((r) => ({
          ...r,
          enabled: configMap.get(r.id) ?? false,
        }))
      );
      allOrganization.push(
        ...repos.organization.map((r) => ({
          ...r,
          enabled: configMap.get(r.id) ?? false,
        }))
      );
    } catch (error) {
      console.error(`Failed to list repos for installation ${installation.installationId}:`, error);
    }
  }

  return res.status(200).json({
    personal: allPersonal,
    organization: allOrganization,
    installations: admin.installations.map((i) => ({
      installationId: i.installationId,
      accountLogin: i.accountLogin,
      accountType: i.accountType,
      avatarUrl: i.avatarUrl,
    })),
  });
}
