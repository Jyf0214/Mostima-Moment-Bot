import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

interface JwtPayload {
  githubId: number;
}

/**
 * 查询当前管理员的 GitHub App 安装列表
 * GET /api/github/installations
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
