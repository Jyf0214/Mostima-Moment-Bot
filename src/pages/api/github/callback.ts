import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { setCookie, clearCookie } from '@/lib/cookie';

const JWT_SECRET = process.env.JWT_SECRET;

interface JwtPayload {
  githubId: number;
  githubLogin: string;
}

/**
 * GitHub App 安装回调
 * GET /api/github/callback?installation_id=xxx&state=xxx
 *
 * 校验 CSRF state + 管理员身份，存储 installation 记录
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { installation_id, state } = req.query;

  if (!installation_id || !state) {
    return res.redirect('/dashboard?install=error&reason=missing_params');
  }

  // 1. 校验 CSRF state
  const cookieState = req.cookies.github_install_state;
  if (!cookieState || cookieState !== state) {
    return res.redirect('/dashboard?install=error&reason=invalid_state');
  }

  // 清除 state cookie
  res.setHeader('Set-Cookie', clearCookie('github_install_state', { path: '/api/github' }));

  // 2. 校验管理员身份
  if (!JWT_SECRET) {
    return res.redirect('/dashboard?install=error&reason=server_config');
  }

  const authToken = req.cookies.auth_token;
  if (!authToken) {
    return res.redirect('/?install=error&reason=not_authenticated');
  }

  let adminGithubId: number;
  try {
    const decoded = jwt.verify(authToken, JWT_SECRET) as JwtPayload;
    adminGithubId = decoded.githubId;
  } catch {
    return res.redirect('/?install=error&reason=invalid_token');
  }

  // 3. 查找管理员
  const admin = await prisma.admin.findUnique({
    where: { githubId: adminGithubId },
  });

  if (!admin) {
    return res.redirect('/dashboard?install=error&reason=admin_not_found');
  }

  // 4. 检查是否已存在该 installation
  const installId = parseInt(installation_id as string, 10);
  if (isNaN(installId)) {
    return res.redirect('/dashboard?install=error&reason=invalid_installation_id');
  }

  const existing = await prisma.gitHubInstallation.findUnique({
    where: { installationId: installId },
  });

  if (existing) {
    // 已存在，更新为活跃状态
    await prisma.gitHubInstallation.update({
      where: { installationId: installId },
      data: { isActive: true, adminId: admin.id },
    });
  } else {
    // 5. 通过 GitHub API 获取安装详情
    try {
      const { getInstallationAccessToken } = await import('@/lib/github/installation');
      // 用 App JWT 获取 installation 信息
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
          // API 失败，用最小信息存储
          await prisma.gitHubInstallation.create({
            data: {
              installationId: installId,
              accountLogin: 'unknown',
              accountType: 'Unknown',
              accountId: 0,
              adminId: admin.id,
            },
          });
        }
      } catch {
        // JWT 生成失败，用最小信息存储
        await prisma.gitHubInstallation.create({
          data: {
            installationId: installId,
            accountLogin: 'unknown',
            accountType: 'Unknown',
            accountId: 0,
            adminId: admin.id,
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch installation details:', error);
      // 仍然存储 installation，只是没有账户详情
      await prisma.gitHubInstallation.create({
        data: {
          installationId: installId,
          accountLogin: 'unknown',
          accountType: 'Unknown',
          accountId: 0,
          adminId: admin.id,
        },
      });
    }
  }

  return res.redirect('/dashboard?install=success');
}
