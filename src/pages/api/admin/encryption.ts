import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { resetEncryptionKeyCache } from '@/lib/middleware';

/**
 * 加密密钥存储管理
 * GET  /api/admin/encryption  — 获取当前状态
 * POST /api/admin/encryption  — 存储密钥到数据库
 * DELETE /api/admin/encryption — 从数据库移除密钥
 *
 * 加密始终开启。此 API 管理的是密钥是否存储到数据库。
 * - 存储：密钥明文存在 AppConfig，后续启动从 DB 读取，不再需要环境变量
 * - 移除：删除 DB 中的密钥，后续启动必须通过环境变量提供
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // JWT_SECRET 从环境变量或数据库获取
  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    try {
      const { prisma } = await import('@/lib/prisma');
      const config = await prisma.appConfig.findUnique({
        where: { configKey: 'jwt_secret' },
      });
      // jwt_secret 已通过加密中间件解密
      jwtSecret = config?.configValue || '';
    } catch {
      return res.status(500).json({ error: 'Server configuration error' });
    }
  }

  if (!jwtSecret) {
    return res.status(500).json({ error: 'JWT_SECRET not configured' });
  }

  // 验证身份
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { githubId: number; isAdmin: boolean };
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Admin only' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { prisma } = await import('@/lib/prisma');

  // GET - 获取状态
  if (req.method === 'GET') {
    const keyConfig = await prisma.appConfig.findUnique({
      where: { configKey: 'encryption_key' },
    });

    const hasStoredKey = !!keyConfig?.configValue;
    const hasEnvKey = !!process.env.ENCRYPTION_KEY;

    return res.status(200).json({
      hasStoredKey,
      hasEnvKey,
      source: hasEnvKey ? 'environment' : hasStoredKey ? 'database' : 'none',
    });
  }

  // POST - 存储密钥到数据库
  if (req.method === 'POST') {
    const { encryptionKey } = req.body;

    if (!encryptionKey || typeof encryptionKey !== 'string') {
      return res.status(400).json({ error: 'encryptionKey is required' });
    }

    // 使用原始 Prisma 客户端明文写入（绕过加密中间件）
    const rawClient = new (await import('@prisma/client')).PrismaClient();
    await rawClient.appConfig.upsert({
      where: { configKey: 'encryption_key' },
      update: { configValue: encryptionKey, encrypted: false },
      create: { configKey: 'encryption_key', configValue: encryptionKey, encrypted: false },
    });
    await rawClient.$disconnect();

    // 重置密钥缓存
    resetEncryptionKeyCache();

    return res.status(200).json({
      success: true,
      warning:
        'Encryption key stored in database as plaintext. You can now start without ENCRYPTION_KEY environment variable.',
    });
  }

  // DELETE - 从数据库移除密钥
  if (req.method === 'DELETE') {
    // 检查是否还有环境变量
    if (!process.env.ENCRYPTION_KEY) {
      return res.status(400).json({
        error:
          'Cannot remove stored key: ENCRYPTION_KEY environment variable is not set. Add it first, then remove the stored key.',
      });
    }

    const rawClient = new (await import('@prisma/client')).PrismaClient();
    await rawClient.appConfig.deleteMany({
      where: { configKey: 'encryption_key' },
    });
    await rawClient.$disconnect();

    // 重置密钥缓存，下次使用环境变量
    resetEncryptionKeyCache();

    return res.status(200).json({
      success: true,
      message: 'Stored encryption key removed. Using ENCRYPTION_KEY environment variable.',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
