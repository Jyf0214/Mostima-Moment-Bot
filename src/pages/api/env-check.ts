import { NextApiRequest, NextApiResponse } from 'next';
import i18n from '@/i18n';

// 环境变量键名 + i18n 描述键
const REQUIRED_ENV_VARS: { key: string; descriptionKey: string }[] = [
  {
    key: 'GITHUB_CLIENT_ID',
    descriptionKey: 'envVarDescriptions.githubClientId',
  },
  {
    key: 'GITHUB_CLIENT_SECRET',
    descriptionKey: 'envVarDescriptions.githubClientSecret',
  },
  { key: 'JWT_SECRET', descriptionKey: 'envVarDescriptions.jwtSecret' },
  {
    key: 'ENCRYPTION_KEY',
    descriptionKey: 'envVarDescriptions.encryptionKey',
  },
  { key: 'DATABASE_URL', descriptionKey: 'envVarDescriptions.databaseUrl' },
];

/**
 * 检查环境变量状态
 * GET /api/env-check
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing: { key: string; description: string }[] = [];
  const present: { key: string; description: string }[] = [];

  for (const item of REQUIRED_ENV_VARS) {
    const entry = { key: item.key, description: i18n.t(item.descriptionKey) };
    if (process.env[item.key]) {
      present.push(entry);
    } else {
      missing.push(entry);
    }
  }

  const isConfigured = missing.length === 0;

  return res.status(200).json({
    isConfigured,
    missing,
    present,
    message: isConfigured
      ? i18n.t('api.envConfigured')
      : i18n.t('api.envMissing', { count: missing.length }),
  });
}
