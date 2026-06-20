import { NextApiRequest, NextApiResponse } from 'next';
import i18n from '@/i18n';
import { prisma } from '@/lib/prisma';

/**
 * Database initialization API
 * POST /api/init
 *
 * Tables are created by prisma db push at startup (package.json scripts).
 * This endpoint only checks connection and admin count.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    await prisma.$connect();

    const adminCount = await prisma.admin.count();
    const elapsed = Date.now() - startTime;
    console.log(`[DB Init] Done in ${elapsed}ms, admin count: ${adminCount}`);

    return res.status(200).json({
      success: true,
      isNew: adminCount === 0,
      message: i18n.t('api.dbInitComplete'),
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[DB Init] Failed after ${elapsed}ms:`, error.message);
    return res.status(500).json({
      error: i18n.t('api.dbInitFailed'),
      message: error.message,
    });
  }
}
