import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

/**
 * 查询当前管理员的 GitHub App 安装列表
 * GET /api/github/installations
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
      installations: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!admin) {
    return res.status(200).json({ installations: [] });
  }

  return res.status(200).json({
    installations: admin.installations.map((i) => ({
      installationId: i.installationId,
      accountLogin: i.accountLogin,
      accountType: i.accountType,
      avatarUrl: i.avatarUrl,
      createdAt: i.createdAt,
    })),
  });
}
