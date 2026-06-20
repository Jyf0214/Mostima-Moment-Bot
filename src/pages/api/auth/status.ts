import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

/**
 * Check application status API
 * GET /api/auth/status
 *
 * Returns isNew=true when table does not exist (treat as fresh install)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const count = await prisma.admin.count();
    return res.status(200).json({ isNew: count === 0 });
  } catch (error: any) {
    // P2021 = table does not exist → treat as new application
    if (error.code === 'P2021') {
      console.log('[Auth Status] admins table not found, treating as new application');
      return res.status(200).json({ isNew: true });
    }
    console.error('[Auth Status] Failed:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
