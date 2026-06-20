import { NextApiRequest, NextApiResponse } from 'next';

// 必要的环境变量列表
const REQUIRED_ENV_VARS = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
];

/**
 * 检查环境变量状态
 * GET /api/env-check
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing: string[] = [];
  const present: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (process.env[envVar]) {
      present.push(envVar);
    } else {
      missing.push(envVar);
    }
  }

  const isConfigured = missing.length === 0;

  return res.status(200).json({
    isConfigured,
    missing,
    present,
    message: isConfigured ? '所有环境变量已配置' : `缺少 ${missing.length} 个必要的环境变量`,
  });
}
