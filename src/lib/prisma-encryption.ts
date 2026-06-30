import { logger } from './logger';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from './crypto';

/**
 * 加密中间件
 *
 * 加密始终开启，所有 AppConfig 的敏感字段自动加解密。
 *
 * ENCRYPTION_KEY 来源优先级：
 *   1. 环境变量 ENCRYPTION_KEY
 *   2. 数据库 AppConfig.encryption_key（用户在设置页面选择存储密钥后写入）
 *
 * 如果两者都不存在，系统无法启动（无法解密已有数据）。
 */

// 需要加密的字段配置
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  AppConfig: ['configValue'],
};

let cachedEncryptionKey: string | null = null;
let encryptionKeyLoaded = false;

/**
 * 获取加密密钥（必须存在）
 * 优先级：缓存 → 环境变量 → 数据库 AppConfig
 */
async function getEncryptionKey(): Promise<string> {
  if (encryptionKeyLoaded && cachedEncryptionKey) return cachedEncryptionKey;

  // 1. 环境变量
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    cachedEncryptionKey = envKey;
    encryptionKeyLoaded = true;
    return envKey;
  }

  // 2. 数据库 AppConfig（用户在设置页面存储的密钥，明文）
  // 注意：这是有意为之的设计。加密中间件需要密钥才能解密数据库中的数据，
  // 但密钥本身可能存储在数据库中（鸡生蛋问题）。此处创建独立 PrismaClient
  // 绕过加密中间件直接读取明文密钥，读取后立即断开连接。
  // 生产环境中优先使用 ENCRYPTION_KEY 环境变量以避免此路径。
  try {
    const rawClient = new PrismaClient();
    const config = await rawClient.appConfig.findUnique({
      where: { configKey: 'encryption_key' },
    });
    await rawClient.$disconnect();

    if (config?.configValue) {
      cachedEncryptionKey = config.configValue;
      encryptionKeyLoaded = true;
      return config.configValue;
    }
  } catch (err) {
    // 数据库不可用，降级为仅环境变量模式
    logger.warn('[Encryption] Failed to read key from database:', err);
  }

  throw new Error(
    'ENCRYPTION_KEY not configured. Set it as environment variable or store it in database via Settings page.'
  );
}

/** 重置加密密钥缓存（用户存储/移除密钥时调用） */
export function resetEncryptionKeyCache(): void {
  cachedEncryptionKey = null;
  encryptionKeyLoaded = false;
}

/** 检查是否为加密字段 */
function isEncryptedField(model: string, field: string): boolean {
  return ENCRYPTED_FIELDS[model]?.includes(field) ?? false;
}

/** 加密对象中的指定字段 */
function encryptObject(
  obj: Record<string, unknown>,
  model: string,
  key: string
): Record<string, unknown> {
  const result = { ...obj };
  for (const [k, value] of Object.entries(result)) {
    if (isEncryptedField(model, k) && typeof value === 'string') {
      result[k] = encrypt(value, key);
    }
  }
  return result;
}

/** 解密对象中的指定字段 */
function decryptObject(
  obj: Record<string, unknown>,
  model: string,
  key: string
): Record<string, unknown> {
  const result = { ...obj };
  for (const [k, value] of Object.entries(result)) {
    if (isEncryptedField(model, k) && typeof value === 'string') {
      try {
        result[k] = decrypt(value, key);
      } catch {
        logger.error(`Failed to decrypt ${model}.${k}`);
      }
    }
  }
  return result;
}

/** 递归处理查询结果 */
function processResult(result: unknown, model: string, key: string | null): unknown {
  if (result === null || result === undefined) return result;
  if (Array.isArray(result)) return result.map((item) => processResult(item, model, key));
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if ('id' in obj || 'configKey' in obj) {
      if (key) return decryptObject(obj, model, key);
      return obj;
    }
  }
  return result;
}

/**
 * 创建带加密中间件的 Prisma 客户端
 * 加密始终开启，密钥懒加载
 */
export function createEncryptedPrismaClient(): PrismaClient {
  const client = new PrismaClient();

  const extended = client.$extends({
    query: {
      $allModels: {
        async $allOperations({
          operation,
          args,
          query,
        }: {
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          const model = (args.model as string) || '';
          const encKey = await getEncryptionKey();

          // 写入操作：加密
          if (['create', 'createMany', 'update', 'updateMany', 'upsert'].includes(operation)) {
            if (args.data && typeof args.data === 'object') {
              args.data = encryptObject(args.data as Record<string, unknown>, model, encKey);
            }
            if (args.create && typeof args.create === 'object') {
              args.create = encryptObject(args.create as Record<string, unknown>, model, encKey);
            }
            if (args.update && typeof args.update === 'object') {
              args.update = encryptObject(args.update as Record<string, unknown>, model, encKey);
            }
          }

          const result = await query(args);

          // 读取操作：解密
          return processResult(result, model, encKey);
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}
