import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getInstallationUrl } from '@/lib/github/installation';
import { setCookie } from '@/lib/cookie';

/**
 * GitHub App 安装入口
 * GET /api/github/install
 *
 * 生成 CSRF state cookie 并重定向到 GitHub 安装页面
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 验证用户已登录
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // 生成 CSRF state
  const state = crypto.randomUUID();

  // 存入 cookie（600s 有效期），根据协议自动决定 Secure 标志
  res.setHeader('Set-Cookie', setCookie('github_install_state', state, { path: '/api/github' }));

  // 重定向到 GitHub 安装页面
  try {
    const url = await getInstallationUrl(state);
    return res.redirect(url);
  } catch {
    return res.status(500).json({ error: 'GitHub App is not configured' });
  }
}
