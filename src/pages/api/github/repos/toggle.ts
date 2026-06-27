import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

/**
 * 切换仓库 CI/CD 启用状态
 * POST /api/github/repos/toggle
 * Body: { repoId, repoFullName, repoOwner, repoName }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = await requireAuth(req, res);
  if (!payload) return;

  const adminGithubId = payload.githubId!;

  const admin = await prisma.admin.findUnique({
    where: { githubId: adminGithubId },
  });

  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }

  const { repoId, repoFullName, repoOwner, repoName } = req.body;

  if (!repoId || !repoFullName || !repoOwner || !repoName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 查找现有配置
  const existing = await prisma.repoConfig.findUnique({
    where: { repoId_adminId: { repoId, adminId: admin.id } },
  });

  let enabled: boolean;

  if (existing) {
    // 切换状态
    const updated = await prisma.repoConfig.update({
      where: { id: existing.id },
      data: { enabled: !existing.enabled },
    });
    enabled = updated.enabled;
  } else {
    // 创建新配置（默认启用，因为用户主动点击开启）
    await prisma.repoConfig.create({
      data: {
        repoId,
        repoFullName,
        repoOwner,
        repoName,
        enabled: true,
        adminId: admin.id,
      },
    });
    enabled = true;
  }

  return res.status(200).json({ enabled });
}
