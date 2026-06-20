import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return res.status(200).json({
      githubId: decoded.githubId,
      githubLogin: decoded.githubLogin,
      avatarUrl: decoded.avatarUrl,
      isAdmin: decoded.isAdmin,
    });
  } catch (error: any) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
