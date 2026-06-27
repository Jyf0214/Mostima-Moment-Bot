import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getInstallationAccessToken, listInstallationRepos } from '@/lib/github/installation';
import { requireAuth } from '@/lib/auth-utils';

/**
 * 列出当前管理员关联的 GitHub App 安装授权仓库
 * GET /api/github/repos
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = await requireAuth(req, res);
  if (!payload) return;

  const adminGithubId = payload.githubId!;

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
      logger.error(`Failed to list repos for installation ${installation.installationId}:`, error);
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
