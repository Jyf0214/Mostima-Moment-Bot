import { PrismaClient } from '@prisma/client';
import { createEncryptedPrismaClient } from './middleware';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma 客户端
 *
 * ENCRYPTION_KEY 不再是启动必需。加密密钥从以下来源获取：
 * 1. 环境变量 ENCRYPTION_KEY
 * 2. 数据库 AppConfig.encryption_key（用户在设置页面开启加密后存储）
 *
 * 无加密密钥时，所有字段以明文存储和读取。
 */
function createPrismaClient() {
  return createEncryptedPrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
