import { NextApiRequest, NextApiResponse } from 'next';
import i18n from '@/i18n';
import { prisma } from '@/lib/prisma';

/**
 * 数据库初始化 API
 * POST /api/init
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 检查数据库连接
    await prisma.$connect();

    // 检查表是否存在，如果不存在则创建
    const tableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admins'
      ) as exists
    `;

    const tableExists = (tableCheck as any[])[0]?.exists;

    if (!tableExists) {
      // 使用 Prisma migrate 创建表
      console.log('Database tables not found, initializing...');
      // 注意：在生产环境中，应该使用 prisma migrate deploy
      // 这里我们只检查表是否存在
    }

    // 检查是否为全新应用
    const adminCount = await prisma.admin.count();

    return res.status(200).json({
      success: true,
      isNew: adminCount === 0,
      message: i18n.t('api.dbInitComplete'),
    });
  } catch (error: any) {
    console.error('Database initialization failed:', error);
    return res.status(500).json({
      error: i18n.t('api.dbInitFailed'),
      message: error.message,
    });
  }
}
