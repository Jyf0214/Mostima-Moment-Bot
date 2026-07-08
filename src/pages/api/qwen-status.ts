import { NextApiRequest, NextApiResponse } from 'next';
import { execFileSync } from 'child_process';
import { requireAuth } from '@/lib/auth-utils';

/**
 * 检查 qwen CLI 是否已安装
 * GET /api/qwen-status
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = await requireAuth(req, res);
  if (!payload) return;

  try {
    const version = execFileSync('qwen', ['--version'], {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    return res.status(200).json({ installed: true, version });
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'ENOENT') {
      return res.status(200).json({ installed: false, version: null });
    }
    return res.status(200).json({ installed: false, version: null });
  }
}
