import { logger } from '@/lib/logger';
import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { generateJWT, getAppId, getPrivateKey } from '@/lib/github/auth';
import i18n from '@/i18n';
import { verifyAuthToken } from '@/lib/auth-utils';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  detail?: string;
}

/**
 * GitHub 连通性测试
 * GET /api/github/test
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authToken = req.cookies.auth_token;
  if (!authToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    verifyAuthToken(authToken);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const t = i18n.t.bind(i18n);
  const results: TestResult[] = [];

  // ── 1. 环境变量检查 ──
  const envVars = [
    { key: 'GITHUB_APP_ID', required: true },
    { key: 'GITHUB_APP_SLUG', required: false },
    { key: 'GITHUB_PRIVATE_KEY_PATH', required: false },
    { key: 'GITHUB_CLIENT_ID', required: true },
    { key: 'GITHUB_CLIENT_SECRET', required: true },
    { key: 'APP_URL', required: true },
    { key: 'ENCRYPTION_KEY', required: true },
    { key: 'JWT_SECRET', required: true },
  ] as const;

  const missing = envVars.filter((v) => !process.env[v.key]);
  const present = envVars.filter((v) => !!process.env[v.key]);

  if (missing.length === 0) {
    results.push({
      name: t('githubTest.envVars'),
      status: 'pass',
      message: t('githubTest.envVarsPass', { count: envVars.length }),
    });
  } else {
    results.push({
      name: t('githubTest.envVars'),
      status: 'fail',
      message: t('githubTest.envVarsFail', { count: missing.length }),
      detail: missing.map((v) => v.key).join(', '),
    });
  }

  // ── 2. 私钥可用性检查 ──
  let privateKeyAvailable = false;
  const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (privateKeyPath) {
    try {
      const fs = await import('fs');
      const stat = fs.statSync(privateKeyPath);
      if (stat.isFile()) {
        const content = fs.readFileSync(privateKeyPath, 'utf8');
        const hasBEGIN = content.includes('BEGIN');
        const hasEND = content.includes('END');
        if (hasBEGIN && hasEND) {
          results.push({
            name: t('githubTest.privateKey'),
            status: 'pass',
            message: t('githubTest.privateKeyPass', { path: privateKeyPath }),
          });
          privateKeyAvailable = true;
        } else {
          results.push({
            name: t('githubTest.privateKey'),
            status: 'fail',
            message: t('githubTest.privateKeyFormatFail'),
            detail: privateKeyPath,
          });
        }
      } else {
        results.push({
          name: t('githubTest.privateKey'),
          status: 'fail',
          message: t('githubTest.privateKeyPathFail'),
          detail: privateKeyPath,
        });
      }
    } catch {
      // 文件不存在，尝试数据库
    }
  }

  // 如果文件不可用，尝试从数据库读取
  if (!privateKeyAvailable) {
    try {
      const dbKey = await getPrivateKey();
      if (dbKey) {
        results.push({
          name: t('githubTest.privateKey'),
          status: 'pass',
          message: t('githubTest.privateKeyPass', { path: 'database' }),
        });
        privateKeyAvailable = true;
      }
    } catch {
      if (!privateKeyAvailable) {
        results.push({
          name: t('githubTest.privateKey'),
          status: 'fail',
          message: t('githubTest.privateKeyReadFail'),
          detail: 'No file or database key available',
        });
      }
    }
  }

  // ── 3. JWT 生成测试 ──
  try {
    const appId = await getAppId();
    const privateKey = await getPrivateKey();
    const token = generateJWT(appId, privateKey);
    const decoded = jwt.decode(token) as { iss?: string; exp?: number; iat?: number } | null;
    if (decoded && decoded.iss === appId && decoded.exp && decoded.iat) {
      const expiresIn = decoded.exp - decoded.iat;
      results.push({
        name: t('githubTest.jwtGenerate'),
        status: 'pass',
        message: t('githubTest.jwtPass', { appId: decoded.iss, expiresIn: String(expiresIn) }),
      });
    } else {
      results.push({
        name: t('githubTest.jwtGenerate'),
        status: 'fail',
        message: t('githubTest.jwtDecodeFail'),
      });
    }
  } catch (err) {
    logger.error('[GitHub Test] JWT generate failed:', err);
    results.push({
      name: t('githubTest.jwtGenerate'),
      status: 'fail',
      message: t('githubTest.jwtError', {
        error: 'JWT generation failed',
      }),
    });
  }

  // ── 4. GitHub API 通信测试 ──
  try {
    const apiAppId = await getAppId();
    const privateKey = await getPrivateKey();
    const appJwt = generateJWT(apiAppId, privateKey);
    const response = await fetch('https://api.github.com/app', {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (response.ok) {
      const app = (await response.json()) as {
        name: string;
        slug: string;
        created_at: string;
        html_url: string;
      };
      results.push({
        name: t('githubTest.apiComm'),
        status: 'pass',
        message: t('githubTest.apiCommPass', { name: app.name, slug: app.slug }),
        detail: t('githubTest.apiCommDetail', {
          date: new Date(app.created_at).toLocaleDateString('zh-CN'),
        }),
      });
    } else {
      const body = await response.text();
      logger.error(`[GitHub Test] API responded with ${response.status}:`, body.slice(0, 500));
      results.push({
        name: t('githubTest.apiComm'),
        status: 'fail',
        message: t('githubTest.apiCommFail', {
          status: String(response.status),
          statusText: response.statusText,
        }),
      });
    }
  } catch (err) {
    logger.error('[GitHub Test] API communication failed:', err);
    results.push({
      name: t('githubTest.apiComm'),
      status: 'fail',
      message: t('githubTest.apiCommError', {
        error: 'API communication failed',
      }),
    });
  }

  // ── 5. Installation 状态检查 ──
  try {
    const installations = await prisma.gitHubInstallation.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (installations.length > 0) {
      const details = installations
        .map((i) => `@${i.accountLogin} (${i.accountType}, ID: ${i.installationId})`)
        .join(', ');
      results.push({
        name: t('githubTest.installation'),
        status: 'pass',
        message: t('githubTest.installationPass', { count: String(installations.length) }),
        detail: details,
      });

      // ── 6. 访问令牌测试 ──
      try {
        const { getInstallationAccessToken } = await import('@/lib/github/installation');
        const testInst = installations[0];
        const token = await getInstallationAccessToken(testInst.installationId);
        if (token) {
          results.push({
            name: t('githubTest.accessToken'),
            status: 'pass',
            message: t('githubTest.accessTokenPass', { login: testInst.accountLogin }),
            detail: t('githubTest.accessTokenDetail', { prefix: token.slice(0, 8) }),
          });

          // ── 7. 仓库列表测试 ──
          try {
            const { listInstallationRepos } = await import('@/lib/github/installation');
            const repos = await listInstallationRepos(token);
            const totalCount = repos.personal.length + repos.organization.length;
            results.push({
              name: t('githubTest.repoList'),
              status: 'pass',
              message: t('githubTest.repoListPass', {
                total: String(totalCount),
                personal: String(repos.personal.length),
                org: String(repos.organization.length),
              }),
            });
          } catch (err) {
            logger.error('[GitHub Test] Repo list failed:', err);
            results.push({
              name: t('githubTest.repoList'),
              status: 'warn',
              message: t('githubTest.repoListWarn', {
                error: 'Failed to list repositories',
              }),
              detail: t('githubTest.repoListWarnDetail'),
            });
          }
        }
      } catch (err) {
        logger.error('[GitHub Test] Access token failed:', err);
        results.push({
          name: t('githubTest.accessToken'),
          status: 'fail',
          message: t('githubTest.accessTokenFail', {
            error: 'Failed to obtain access token',
          }),
          detail: t('githubTest.accessTokenFailDetail'),
        });
      }
    } else {
      results.push({
        name: t('githubTest.installation'),
        status: 'warn',
        message: t('githubTest.installationWarn'),
        detail: t('githubTest.installationWarnDetail'),
      });
    }
  } catch (err) {
    logger.error('[GitHub Test] Installation check failed:', err);
    results.push({
      name: t('githubTest.installation'),
      status: 'fail',
      message: t('githubTest.installationError', {
        error: 'Installation check failed',
      }),
    });
  }

  // ── 8. ENCRYPTION_KEY 强度检查 ──
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (encryptionKey) {
    const strength =
      encryptionKey.length >= 32 ? 'strong' : encryptionKey.length >= 16 ? 'medium' : 'weak';
    results.push({
      name: t('githubTest.webhookSecretLabel'),
      status: strength === 'weak' ? 'warn' : 'pass',
      message: t('githubTest.webhookSecretPass', {
        strength,
        length: String(encryptionKey.length),
      }),
      detail: strength === 'weak' ? t('githubTest.webhookSecretWeak') : undefined,
    });
  }

  // ── 9. APP_URL 协议检查 ──
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    const isHttps = appUrl.startsWith('https');
    const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
    if (isHttps || isLocalhost) {
      results.push({
        name: t('githubTest.appUrlLabel'),
        status: 'pass',
        message: t('githubTest.appUrlPass', {
          url: appUrl,
          protocol: isHttps ? 'HTTPS' : 'HTTP',
        }),
      });
    } else {
      results.push({
        name: t('githubTest.appUrlLabel'),
        status: 'warn',
        message: t('githubTest.appUrlWarn', { url: appUrl }),
        detail: t('githubTest.appUrlWarnDetail'),
      });
    }
  }

  return res.status(200).json({ results });
}
