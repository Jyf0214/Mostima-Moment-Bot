import { NextApiRequest, NextApiResponse } from 'next';
import { clearCookie } from '@/lib/cookie';

/**
 * 登出
 * POST /api/auth/logout
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 清除 JWT cookie，使用 clearCookie 根据协议自适应 Secure 标志
  res.setHeader('Set-Cookie', clearCookie('auth_token'));

  return res.status(200).json({ success: true });
}
