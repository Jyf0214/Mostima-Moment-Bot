import { NextApiRequest, NextApiResponse } from 'next';

/**
 * GitHub OAuth 登录
 * GET /api/auth/login
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

  if (!clientId) {
    return res.status(500).json({ error: 'GitHub Client ID not configured' });
  }

  // 生成 state 参数防止 CSRF
  const state = Buffer.from(JSON.stringify({
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2)
  })).toString('base64');

  // 存储 state 到 cookie
  res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

  // 构建 GitHub OAuth URL
  const scope = 'read:user user:email';
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

  return res.redirect(githubAuthUrl);
}
