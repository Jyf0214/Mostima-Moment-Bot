import { NextApiRequest, NextApiResponse } from 'next';
import { isNewApplication } from '@/lib/db';

/**
 * 检查应用状态 API
 * GET /api/auth/status
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const isNew = await isNewApplication();
    return res.status(200).json({ isNew });
  } catch (error: any) {
    console.error('检查应用状态失败:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
