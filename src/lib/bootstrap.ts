import { logger } from './logger';
import { prisma } from '@/lib/prisma';

/**
 * 首次启动自动保存环境变量到数据库
 *
 * 当数据库为空（无管理员）时，将环境变量中的配置保存到 AppConfig。
 * 后续启动从数据库读取，不再依赖环境变量。
 *
 * 注意：此时加密已通过环境变量 ENCRYPTION_KEY 开启，
 * 所以通过 Prisma 中间件保存的数据会自动加密。
 * ENCRYPTION_KEY 本身也明文保存（供后续从数据库读取使用）。
 */
export async function autoSaveEnvVars(): Promise<void> {
  try {
    const adminCount = await prisma.admin.count();
    if (adminCount > 0) {
      return;
    }

    logger.info('[Bootstrap] Empty database detected, auto-saving env vars...');

    const varsToSave: Array<{ key: string; value: string; encrypted: boolean }> = [];

    const envMap: Record<string, string | undefined> = {
      // 敏感数据（通过 Prisma 中间件自动加密存储）
      github_client_id: process.env.GITHUB_CLIENT_ID,
      github_client_secret: process.env.GITHUB_CLIENT_SECRET,
      jwt_secret: process.env.JWT_SECRET,
      github_app_id: process.env.GITHUB_APP_ID,
      github_private_key_path: process.env.GITHUB_PRIVATE_KEY_PATH,
    };

    for (const [key, value] of Object.entries(envMap)) {
      if (value) {
        varsToSave.push({ key, value, encrypted: true });
      }
    }

    // 加密密钥本身明文存储（供后续从数据库读取）
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (encryptionKey) {
      varsToSave.push({ key: 'encryption_key', value: encryptionKey, encrypted: false });
    }

    for (const { key, value, encrypted } of varsToSave) {
      if (encrypted) {
        // 通过 Prisma 中间件自动加密
        await prisma.appConfig.upsert({
          where: { configKey: key },
          update: { configValue: value, encrypted: true },
          create: { configKey: key, configValue: value, encrypted: true },
        });
      } else {
        // 明文存储（encryption_key 等）
        // 绕过加密中间件，直接操作数据库
        const rawClient = new (await import('@prisma/client')).PrismaClient();
        await rawClient.appConfig.upsert({
          where: { configKey: key },
          update: { configValue: value, encrypted: false },
          create: { configKey: key, configValue: value, encrypted: false },
        });
        await rawClient.$disconnect();
      }
    }

    logger.info(`[Bootstrap] Saved ${varsToSave.length} env vars to database`);
  } catch (error) {
    logger.error('[Bootstrap] Failed to auto-save env vars:', error);
  }
}
