import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth-utils';

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = await requireAuth(req, res);
  if (!payload) return;

  return res.status(200).json({
    githubId: payload.githubId,
    githubLogin: payload.githubLogin,
    avatarUrl: payload.avatarUrl,
    isAdmin: payload.isAdmin,
  });
}
