import { logger } from '@/lib/logger';
import { NextApiRequest, NextApiResponse } from 'next';
import { isNewApplication } from '@/lib/db';

/**
 * Check application status API
 * GET /api/auth/status
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const isNew = await isNewApplication();
    return res.status(200).json({ isNew });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Auth Status] Failed:', message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
