import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';
import { runScheduledScan } from '@/lib/ci/scheduled-scanner';

/**
 * 定时扫描触发端点
 * POST /api/ci/scan
 *
 * 可通过 GitHub Actions schedule、外部 cron 或手动触发
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 验证请求来源（简单 token 验证，使用 timing-safe 比较）
  const authHeader = req.headers.authorization;
  const scanToken = process.env.SCAN_TRIGGER_TOKEN;

  if (!scanToken) {
    return res
      .status(500)
      .json({ error: 'Server configuration error: SCAN_TRIGGER_TOKEN not set' });
  }

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader || '';
  const tokenBuf = Buffer.from(token, 'utf-8');
  const expectedBuf = Buffer.from(scanToken, 'utf-8');

  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const workspaceDir = process.env.WORKSPACE_DIR || '.';

  logger.info('[API] Scheduled scan triggered');

  // 异步执行扫描（不阻塞响应）
  runScheduledScan(workspaceDir).catch((err) => {
    logger.error('[API] Scheduled scan failed:', err);
  });

  return res.status(202).json({
    accepted: true,
    message: 'Scheduled scan started',
  });
}
