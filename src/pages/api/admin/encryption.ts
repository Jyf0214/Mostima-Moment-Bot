import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { resetEncryptionKeyCache } from '@/lib/middleware';

const JWT_SECRET = process.env.JWT_SECRET;

interface JwtPayload {
  githubId: number;
  isAdmin: boolean;
}

/**
 * 加密密钥管理
 * GET  /api/admin/encryption  — 获取加密状态
 * PUT  /api/admin/encryption  — 开启/关闭加密
 *
 * 开启加密时：
 * - 需要用户提供 ENCRYPTION_KEY
 * - 密钥以明文存储在 AppConfig 中
 * - 显示警告：启用后必须始终提供密钥
 *
 * 关闭加密时：
 * - 清除存储的密钥
 * - 重新加载 Prisma 客户端（明文模式）
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 验证身份
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Admin only' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // GET - 获取加密状态
  if (req.method === 'GET') {
    const keyConfig = await prisma.appConfig.findUnique({
      where: { configKey: 'encryption_key' },
    });

    const enabledConfig = await prisma.appConfig.findUnique({
      where: { configKey: 'encryption_enabled' },
    });

    const enabled = enabledConfig?.configValue === 'true';
    const hasStoredKey = !!keyConfig?.configValue;

    return res.status(200).json({
      enabled,
      hasStoredKey,
      hasEnvKey: !!process.env.ENCRYPTION_KEY,
    });
  }

  // PUT - 开启/关闭加密
  if (req.method === 'PUT') {
    const { enabled, encryptionKey } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }

    if (enabled) {
      // 开启加密
      if (!encryptionKey || typeof encryptionKey !== 'string') {
        return res.status(400).json({
          error: 'encryptionKey is required to enable encryption',
        });
      }

      // 存储加密密钥（明文）和启用状态
      await prisma.appConfig.upsert({
        where: { configKey: 'encryption_key' },
        update: { configValue: encryptionKey },
        create: { configKey: 'encryption_key', configValue: encryptionKey, encrypted: false },
      });

      await prisma.appConfig.upsert({
        where: { configKey: 'encryption_enabled' },
        update: { configValue: 'true' },
        create: { configKey: 'encryption_enabled', configValue: 'true', encrypted: false },
      });

      // 重置加密密钥缓存，下次查询时使用新密钥
      resetEncryptionKeyCache();

      return res.status(200).json({
        success: true,
        enabled: true,
        warning:
          'Encryption enabled. You must always provide ENCRYPTION_KEY or store it in database.',
      });
    } else {
      // 关闭加密
      // 清除加密密钥
      await prisma.appConfig.deleteMany({
        where: { configKey: 'encryption_key' },
      });

      await prisma.appConfig.upsert({
        where: { configKey: 'encryption_enabled' },
        update: { configValue: 'false' },
        create: { configKey: 'encryption_enabled', configValue: 'false', encrypted: false },
      });

      // 重置加密密钥缓存
      resetEncryptionKeyCache();

      return res.status(200).json({
        success: true,
        enabled: false,
        warning: 'Encryption disabled. Stored values are now in plaintext.',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
