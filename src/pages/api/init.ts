import { logger } from '@/lib/logger';
import { NextApiRequest, NextApiResponse } from 'next';
import i18n from '@/i18n';
import { prisma } from '@/lib/prisma';
import { loadEnvVarsFromDatabase } from '@/lib/bootstrap';

/**
 * Database initialization API
 * POST /api/init
 *
 * Tables are created by prisma db push at startup (package.json scripts).
 * This endpoint checks connection, loads env vars from database if enabled, and checks admin count.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    await prisma.$connect();

    // 从数据库加载环境变量（如果启用了数据库运行模式）
    const envLoaded = await loadEnvVarsFromDatabase();

    const adminCount = await prisma.admin.count();
    const elapsed = Date.now() - startTime;
    logger.info(
      `[DB Init] Done in ${elapsed}ms, admin count: ${adminCount}, env loaded: ${envLoaded}`
    );

    return res.status(200).json({
      success: true,
      isNew: adminCount === 0,
      envLoaded,
      message: i18n.t('api.dbInitComplete'),
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[DB Init] Failed after ${elapsed}ms:`, message);
    return res.status(500).json({
      error: i18n.t('api.dbInitFailed'),
      // 仅返回通用错误消息，不泄露数据库连接字符串等内部细节
    });
  }
}
