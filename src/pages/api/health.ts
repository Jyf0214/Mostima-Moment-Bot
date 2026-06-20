import { NextApiRequest, NextApiResponse } from 'next';

/**
 * 健康检查 API
 * GET /api/health
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    status: 'ok',
    service: 'manticore-bot',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
