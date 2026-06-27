import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { setCookie, clearCookie } from '@/lib/cookie';
import { getQueryParam } from '@/lib/api-utils';
import { verifyAuthToken } from '@/lib/auth-utils';

/**
 * GitHub App 安装回调
 * GET /api/github/callback?installation_id=xxx&state=xxx
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const installation_id = getQueryParam(req, 'installation_id');
  const state = getQueryParam(req, 'state');

  if (!installation_id || !state) {
    return res.redirect('/dashboard?install=error&reason=missing_params');
  }

  const cookieState = req.cookies.github_install_state;
  if (!cookieState || cookieState !== state) {
    return res.redirect('/dashboard?install=error&reason=invalid_state');
  }

  res.setHeader('Set-Cookie', clearCookie('github_install_state', { path: '/api/github' }));

  const authToken = req.cookies.auth_token;
  if (!authToken) {
    return res.redirect('/?install=error&reason=not_authenticated');
  }

  let adminGithubId: number;
  try {
    const decoded = verifyAuthToken(authToken);
    if (!decoded.githubId) {
      return res.redirect('/?install=error&reason=invalid_token');
    }
    adminGithubId = decoded.githubId;
  } catch {
    return res.redirect('/?install=error&reason=invalid_token');
  }

  const admin = await prisma.admin.findUnique({
    where: { githubId: adminGithubId },
  });

  if (!admin) {
    return res.redirect('/dashboard?install=error&reason=admin_not_found');
  }

  const installId = parseInt(installation_id, 10);
  if (isNaN(installId)) {
    return res.redirect('/dashboard?install=error&reason=invalid_installation_id');
  }

  const existing = await prisma.gitHubInstallation.findUnique({
    where: { installationId: installId },
  });

  if (existing) {
    await prisma.gitHubInstallation.update({
      where: { installationId: installId },
      data: { isActive: true, adminId: admin.id },
    });
  } else {
    try {
      const { generateJWTAuto } = await import('@/lib/github/auth');
      try {
        const appJwt = await generateJWTAuto();
        const response = await fetch(`https://api.github.com/app/installations/${installId}`, {
          headers: {
            Authorization: `Bearer ${appJwt}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (response.ok) {
          const installation = (await response.json()) as {
            account: { login: string; type: string; id: number; avatar_url: string };
          };
          await prisma.gitHubInstallation.create({
            data: {
              installationId: installId,
              accountLogin: installation.account.login,
              accountType: installation.account.type,
              accountId: installation.account.id,
              avatarUrl: installation.account.avatar_url,
              adminId: admin.id,
            },
          });
        } else {
          await prisma.gitHubInstallation.create({
            data: { installationId: installId, accountLogin: 'unknown', accountType: 'Unknown', accountId: 0, adminId: admin.id },
          });
        }
      } catch {
        await prisma.gitHubInstallation.create({
          data: { installationId: installId, accountLogin: 'unknown', accountType: 'Unknown', accountId: 0, adminId: admin.id },
        });
      }
    } catch (error) {
      logger.error('Failed to fetch installation details:', error);
      await prisma.gitHubInstallation.create({
        data: { installationId: installId, accountLogin: 'unknown', accountType: 'Unknown', accountId: 0, adminId: admin.id },
      });
    }
  }

  return res.redirect('/dashboard?install=success');
}
