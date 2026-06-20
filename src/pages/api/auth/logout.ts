import { NextApiRequest, NextApiResponse } from 'next';

/**
 * 登出
 * POST /api/auth/logout
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 清除 JWT cookie
  res.setHeader('Set-Cookie', 'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

  return res.status(200).json({ success: true });
}
