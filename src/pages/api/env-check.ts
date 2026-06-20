import { NextApiRequest, NextApiResponse } from 'next';
import i18n from '@/i18n';

// 环境变量键名 + i18n 描述键 + i18n 生成提示键
const REQUIRED_ENV_VARS: {
  key: string;
  descriptionKey: string;
  generateHintKey: string;
}[] = [
  {
    key: 'GITHUB_CLIENT_ID',
    descriptionKey: 'envVarDescriptions.githubClientId',
    generateHintKey: 'envVarHints.githubClientId',
  },
  {
    key: 'GITHUB_CLIENT_SECRET',
    descriptionKey: 'envVarDescriptions.githubClientSecret',
    generateHintKey: 'envVarHints.githubClientSecret',
  },
  {
    key: 'JWT_SECRET',
    descriptionKey: 'envVarDescriptions.jwtSecret',
    generateHintKey: 'envVarHints.jwtSecret',
  },
  {
    key: 'ENCRYPTION_KEY',
    descriptionKey: 'envVarDescriptions.encryptionKey',
    generateHintKey: 'envVarHints.encryptionKey',
  },
  {
    key: 'DATABASE_URL',
    descriptionKey: 'envVarDescriptions.databaseUrl',
    generateHintKey: 'envVarHints.databaseUrl',
  },
];

/**
 * 检查环境变量状态
 * GET /api/env-check
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing: {
    key: string;
    description: string;
    generateHint: string;
  }[] = [];
  const present: {
    key: string;
    description: string;
    generateHint: string;
  }[] = [];

  for (const item of REQUIRED_ENV_VARS) {
    const entry = {
      key: item.key,
      description: i18n.t(item.descriptionKey),
      generateHint: i18n.t(item.generateHintKey),
    };
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
