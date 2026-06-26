import { PrismaClient } from '@prisma/client';
import { createEncryptedPrismaClient } from './middleware';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma 客户端（加密始终开启）
 *
 * ENCRYPTION_KEY 来源优先级：
 *   1. 环境变量 ENCRYPTION_KEY
 *   2. 数据库 AppConfig.encryption_key（用户在设置页面选择存储密钥后写入）
 *
 * 如果两者都不存在，系统无法启动。
 */
function createPrismaClient() {
  return createEncryptedPrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
