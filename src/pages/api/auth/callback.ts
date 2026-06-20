import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { isNewApplication, getAdmin, createAdmin, updateAdminLogin, discardNonAdminData } from '@/lib/db';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

/**
 * GitHub OAuth 回调
 * GET /api/auth/callback
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state } = req.query;

  // 验证 state 参数
  const cookieState = req.cookies.oauth_state;
  if (!cookieState || cookieState !== state) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }

  // 清除 state cookie
  res.setHeader('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

  if (!code) {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  try {
    // 交换 access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description });
    }

    // 获取用户信息
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
    });

    const userData = await userResponse.json();

    if (!userData.id) {
      return res.status(400).json({ error: 'Failed to fetch user data' });
    }

    // 检查是否为全新应用
    const isNew = await isNewApplication();

    // 检查用户是否为管理员
    let admin = await getAdmin(userData.id);

    if (isNew && !admin) {
      // 全新应用，第一个用户自动成为管理员
      admin = await createAdmin(userData.id, userData.login, userData.avatar_url);
      console.log(`新管理员已创建: ${userData.login}`);
    } else if (!admin) {
      // 非管理员，丢弃数据
      await discardNonAdminData(userData.id);
      return res.status(403).json({ error: '只有管理员可以访问此应用' });
    } else {
      // 已有管理员，更新登录时间
      await updateAdminLogin(userData.id);
    }

    // 生成 JWT
    const token = jwt.sign(
      {
        githubId: userData.id,
        githubLogin: userData.login,
        avatarUrl: userData.avatar_url,
        isAdmin: true,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 设置 JWT cookie
    res.setHeader('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);

    // 重定向到首页
    return res.redirect('/');
  } catch (error: any) {
    console.error('GitHub OAuth 回调失败:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
