import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from './crypto';

/**
 * 加密中间件
 *
 * ENCRYPTION_KEY 可从以下来源获取：
 * 1. 环境变量 ENCRYPTION_KEY
 * 2. 数据库 AppConfig 中的 encryption_key（用户在设置页面开启加密后存储）
 *
 * 当加密关闭时（无 ENCRYPTION_KEY），所有字段以明文存储和读取。
 * 当加密开启时，敏感字段自动加解密。
 */

// 需要加密的字段配置
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  AppConfig: ['configValue'],
  WebhookConfig: ['webhookSecretEncrypted', 'privateKeyEncrypted'],
};

let cachedEncryptionKey: string | null = null;
let encryptionKeyLoaded = false;

/**
 * 尝试获取加密密钥
 * 优先级：缓存 → 环境变量 → 数据库 AppConfig
 */
async function getEncryptionKey(): Promise<string | null> {
  if (encryptionKeyLoaded) return cachedEncryptionKey;

  // 1. 环境变量
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    cachedEncryptionKey = envKey;
    encryptionKeyLoaded = true;
    return envKey;
  }

  // 2. 数据库 AppConfig
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
  } catch {
    // 数据库不可用，继续无加密模式
  }

  encryptionKeyLoaded = true;
  cachedEncryptionKey = null;
  return null;
}

/** 重置加密密钥缓存（用户开关加密时调用） */
export function resetEncryptionKeyCache(): void {
  cachedEncryptionKey = null;
  encryptionKeyLoaded = false;
}

/**
 * 检查是否为加密字段
 */
function isEncryptedField(model: string, field: string): boolean {
  return ENCRYPTED_FIELDS[model]?.includes(field) ?? false;
}

/**
 * 加密对象中的指定字段
 */
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

/**
 * 解密对象中的指定字段
 */
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
        console.error(`Failed to decrypt ${model}.${k}`);
      }
    }
  }
  return result;
}

/**
 * 递归处理查询结果
 */
function processResult(result: unknown, model: string, key: string | null): unknown {
  if (result === null || result === undefined) return result;
  if (Array.isArray(result)) return result.map((item) => processResult(item, model, key));
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if ('id' in obj || 'configKey' in obj || 'appId' in obj) {
      if (key) {
        return decryptObject(obj, model, key);
      }
      // 无加密密钥，明文返回
      return obj;
    }
  }
  return result;
}

/**
 * 创建带加密中间件的 Prisma 客户端
 *
 * 加密密钥懒加载：首次查询时获取，支持无加密模式
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

          // 获取加密密钥（懒加载）
          const encKey = await getEncryptionKey();

          // 写入操作：加密
          if (['create', 'createMany', 'update', 'updateMany', 'upsert'].includes(operation)) {
            if (args.data && typeof args.data === 'object') {
              if (encKey) {
                args.data = encryptObject(args.data as Record<string, unknown>, model, encKey);
              }
            }
            if (args.create && typeof args.create === 'object') {
              if (encKey) {
                args.create = encryptObject(args.create as Record<string, unknown>, model, encKey);
              }
            }
            if (args.update && typeof args.update === 'object') {
              if (encKey) {
                args.update = encryptObject(args.update as Record<string, unknown>, model, encKey);
              }
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
