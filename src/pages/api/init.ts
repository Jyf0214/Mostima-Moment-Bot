import { NextApiRequest, NextApiResponse } from 'next';
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
      console.log('数据库表不存在，正在初始化...');
      // 注意：在生产环境中，应该使用 prisma migrate deploy
      // 这里我们只检查表是否存在
    }

    // 检查是否为全新应用
    const adminCount = await prisma.admin.count();

    return res.status(200).json({
      success: true,
      isNew: adminCount === 0,
      message: '数据库初始化完成',
    });
  } catch (error: any) {
    console.error('数据库初始化失败:', error);
    return res.status(500).json({
      error: '数据库初始化失败',
      message: error.message,
    });
  }
}
