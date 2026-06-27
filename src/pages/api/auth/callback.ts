import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import i18n from '@/i18n';
import { logger } from '@/lib/logger';
import {
  isNewApplication,
  getAdmin,
  createAdmin,
  updateAdminLogin,
  discardNonAdminData,
} from '@/lib/db';
import { setCookie, clearCookie } from '@/lib/cookie';
import { autoSaveEnvVars } from '@/lib/bootstrap';
import { getJwtSecret } from '@/lib/auth-utils';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id?: number;
  login?: string;
  avatar_url?: string;
}

/**
 * GitHub OAuth 回调
 * GET /api/auth/callback
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, installation_id, setup_action } = req.query;

  if (installation_id && setup_action === 'install') {
    const params = new URLSearchParams();
    params.set('installation_id', String(installation_id));
    if (state) params.set('state', String(state));
    return res.redirect(`/api/github/callback?${params.toString()}`);
  }

  const cookieState = req.cookies.oauth_state;
  if (!cookieState || cookieState !== state) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }

  res.setHeader('Set-Cookie', clearCookie('oauth_state'));

  if (!code) {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData: GitHubTokenResponse = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description });
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });

    const userData: GitHubUser = await userResponse.json();

    if (!userData.id || !userData.login || !userData.avatar_url) {
      return res.status(400).json({ error: 'Failed to fetch user data' });
    }

    const isNew = await isNewApplication();
    let admin = await getAdmin(userData.id);

    if (isNew && !admin) {
      admin = await createAdmin(userData.id, userData.login, userData.avatar_url);
      logger.info(`New admin created: ${userData.login}`);
      await autoSaveEnvVars();
    } else if (!admin) {
      await discardNonAdminData(userData.id, userData.login);
      return res.status(403).json({ error: i18n.t('api.unauthorized') });
    } else {
      await updateAdminLogin(userData.id);
    }

    let JWT_SECRET: string;
    try {
      JWT_SECRET = getJwtSecret();
    } catch {
      return res.status(500).json({ error: 'Server configuration error' });
    }

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

    res.setHeader('Set-Cookie', setCookie('auth_token', token, { maxAge: 7 * 24 * 60 * 60 }));

    return res.redirect('/');
  } catch (error) {
    logger.error('GitHub OAuth callback failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
