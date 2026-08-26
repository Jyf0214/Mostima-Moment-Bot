import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { setCookie } from '@/lib/cookie';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * GitHub OAuth 登录
 * GET /api/auth/login
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // IP 级别速率限制：每 IP 每分钟最多 20 次登录请求
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(`auth-login:${clientIp}`, 20, 60_000)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const appUrl = process.env.APP_URL;

  if (!clientId) {
    return res.status(500).json({ error: 'GitHub Client ID not configured' });
  }

  // 与 Client ID 同级校验：APP_URL 缺失时 redirect_uri 会变成
  // "undefined/api/auth/callback"，OAuth 必然失败，必须显式报错而非静默拼坏链接
  if (!appUrl) {
    return res.status(500).json({ error: 'APP_URL not configured' });
  }

  const redirectUri = `${appUrl}/api/auth/callback`;

  // 生成加密安全的 state 参数防止 CSRF
  const state = crypto.randomUUID();

  // 存储 state 到 cookie，根据协议自动决定 Secure 标志
  res.setHeader('Set-Cookie', setCookie('oauth_state', state));

  // 构建 GitHub OAuth URL
  const scope = 'read:user user:email';
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

  return res.redirect(githubAuthUrl);
}
