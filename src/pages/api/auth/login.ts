import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { setCookie } from '@/lib/cookie';

/**
 * GitHub OAuth 登录
 * GET /api/auth/login
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.APP_URL}/api/auth/callback`;

  if (!clientId) {
    return res.status(500).json({ error: 'GitHub Client ID not configured' });
  }

  // 生成加密安全的 state 参数防止 CSRF
  const state = crypto.randomUUID();

  // 存储 state 到 cookie，根据协议自动决定 Secure 标志
  res.setHeader('Set-Cookie', setCookie('oauth_state', state));

  // 构建 GitHub OAuth URL
  const scope = 'read:user user:email';
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

  return res.redirect(githubAuthUrl);
}
