import { NextApiRequest, NextApiResponse } from 'next';
import { resetEncryptionKeyCache } from '@/lib/prisma-encryption';
import { logger } from '@/lib/logger';
import { verifyTokenWithSecret } from '@/lib/auth-utils';

/**
 * 加密密钥存储管理
 * GET  /api/admin/encryption  — 获取当前状态
 * POST /api/admin/encryption  — 存储密钥到数据库
 * DELETE /api/admin/encryption — 从数据库移除密钥
 *
 * 加密始终开启。此 API 管理的是密钥是否存储到数据库。
 * - 存储：密钥明文存在 AppConfig，后续启动从 DB 读取，不再需要环境变量
 * - 移除：删除 DB 中的密钥，后续启动必须通过环境变量提供
 *
 * 注意：此端点需要在 JWT_SECRET 未配置时仍可工作（从数据库读取密钥），
 * 因此不能使用 requireAdmin 中间件，必须自行处理 JWT_SECRET 的获取逻辑。
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
    } catch (err) {
      logger.warn('[Admin Encryption] Failed to read JWT_SECRET from database:', err);
      return res.status(500).json({ error: 'Server configuration error' });
    }
  }

  if (!jwtSecret) {
    return res.status(500).json({ error: 'JWT_SECRET not configured' });
  }

  // 验证身份（使用 verifyTokenWithSecret 以支持自定义密钥来源）
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = verifyTokenWithSecret(token, jwtSecret);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Admin only' });
    }
  } catch (err) {
    logger.warn('[Admin Encryption] JWT verification failed:', err);
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

    // 密钥格式校验：必须为 64 位十六进制字符串（32 字节 = 256 位）
    const trimmedKey = encryptionKey.trim();
    if (!/^[0-9a-f]{64}$/i.test(trimmedKey)) {
      return res.status(400).json({
        error: 'Encryption key must be a 64-character hexadecimal string (32 bytes)',
      });
    }

    // 安全性验证：尝试用新密钥解密一条已有加密数据，确保密钥有效
    // 防止错误密钥写入后导致所有加密数据永久不可读
    const rawClient = new (await import('@prisma/client')).PrismaClient();
    try {
      const encryptedConfig = await rawClient.appConfig.findFirst({
        where: { encrypted: true },
      });
      if (encryptedConfig?.configValue) {
        const { decrypt } = await import('@/lib/crypto');
        try {
          decrypt(encryptedConfig.configValue, trimmedKey);
        } catch {
          return res.status(400).json({
            error:
              'The provided key cannot decrypt existing encrypted data. Please verify the key is correct.',
          });
        }
      }

      // 验证通过，写入数据库
      await rawClient.appConfig.upsert({
        where: { configKey: 'encryption_key' },
        update: { configValue: trimmedKey, encrypted: false },
        create: { configKey: 'encryption_key', configValue: trimmedKey, encrypted: false },
      });
    } finally {
      await rawClient.$disconnect();
    }

    // 重置密钥缓存
    resetEncryptionKeyCache();

    return res.status(200).json({
      success: true,
      warning:
        'Encryption key stored in database. You can now start without ENCRYPTION_KEY environment variable.',
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
    try {
      await rawClient.appConfig.deleteMany({
        where: { configKey: 'encryption_key' },
      });
    } finally {
      await rawClient.$disconnect();
    }

    // 重置密钥缓存，下次使用环境变量
    resetEncryptionKeyCache();

    return res.status(200).json({
      success: true,
      message: 'Stored encryption key removed. Using ENCRYPTION_KEY environment variable.',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
