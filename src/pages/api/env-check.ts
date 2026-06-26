import { NextApiRequest, NextApiResponse } from 'next';
import i18n from '@/i18n';
import { prisma } from '@/lib/prisma';

/**
 * 分级环境变量检查
 *
 * Tier 1（始终必需）：DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
 * Tier 2（数据库为空时必需）：GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 *
 * GET /api/env-check
 * GET /api/env-check?tier=1  — 只检查 Tier 1
 * GET /api/env-check?tier=2  — 检查 Tier 1 + Tier 2
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 检查数据库是否有数据
  let dbHasData = false;
  try {
    const adminCount = await prisma.admin.count();
    const configCount = await prisma.appConfig.count();
    dbHasData = adminCount > 0 || configCount > 0;
  } catch {
    // 数据库连接失败
  }

  // 根据数据库状态决定 Tier 2 是否必需
  const tier2Required = !dbHasData;

  const ALL_VARS = [
    {
      key: 'DATABASE_URL',
      tier: 1 as const,
      descriptionKey: 'envVarDescriptions.databaseUrl',
      generateHintKey: 'envVarHints.databaseUrl',
    },
    {
      key: 'JWT_SECRET',
      tier: 1 as const,
      descriptionKey: 'envVarDescriptions.jwtSecret',
      generateHintKey: 'envVarHints.jwtSecret',
    },
    {
      key: 'ENCRYPTION_KEY',
      tier: 1 as const,
      descriptionKey: 'envVarDescriptions.encryptionKey',
      generateHintKey: 'envVarHints.encryptionKey',
    },
    {
      key: 'GITHUB_CLIENT_ID',
      tier: 2 as const,
      descriptionKey: 'envVarDescriptions.githubClientId',
      generateHintKey: 'envVarHints.githubClientId',
    },
    {
      key: 'GITHUB_CLIENT_SECRET',
      tier: 2 as const,
      descriptionKey: 'envVarDescriptions.githubClientSecret',
      generateHintKey: 'envVarHints.githubClientSecret',
    },
  ];

  const missing: {
    key: string;
    tier: number;
    required: boolean;
    description: string;
    generateHint: string;
  }[] = [];
  const present: {
    key: string;
    tier: number;
    description: string;
    generateHint: string;
  }[] = [];

  for (const item of ALL_VARS) {
    const entry = {
      key: item.key,
      tier: item.tier,
      description: i18n.t(item.descriptionKey),
      generateHint: i18n.t(item.generateHintKey),
    };

    if (process.env[item.key]) {
      present.push(entry);
    } else {
      const required = item.tier === 1 || tier2Required;
      missing.push({ ...entry, required });
    }
  }

  // 只检查真正必需的缺失变量
  const trulyMissing = missing.filter((m) => m.required);
  const isConfigured = trulyMissing.length === 0;

  return res.status(200).json({
    isConfigured,
    dbHasData,
    missing,
    present,
    message: isConfigured
      ? i18n.t('api.envConfigured')
      : i18n.t('api.envMissing', { count: trulyMissing.length }),
  });
}
