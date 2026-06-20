import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from './crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

// 需要加密的字段配置
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  AppConfig: ['configValue'],
  WebhookConfig: ['webhookSecretEncrypted', 'privateKeyEncrypted'],
};

/**
 * 检查是否为加密字段
 */
function isEncryptedField(model: string, field: string): boolean {
  return ENCRYPTED_FIELDS[model]?.includes(field) ?? false;
}

/**
 * 加密对象中的指定字段
 */
function encryptObject(obj: Record<string, unknown>, model: string): Record<string, unknown> {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (isEncryptedField(model, key) && typeof value === 'string') {
      result[key] = encrypt(value, ENCRYPTION_KEY);
    }
  }
  return result;
}

/**
 * 解密对象中的指定字段
 */
function decryptObject(obj: Record<string, unknown>, model: string): Record<string, unknown> {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (isEncryptedField(model, key) && typeof value === 'string') {
      try {
        result[key] = decrypt(value, ENCRYPTION_KEY);
      } catch {
        console.error(`Failed to decrypt ${model}.${key}`);
      }
    }
  }
  return result;
}

/**
 * 递归处理查询结果
 */
function processResult(result: unknown, model: string): unknown {
  if (result === null || result === undefined) return result;
  if (Array.isArray(result)) return result.map((item) => processResult(item, model));
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if ('id' in obj || 'configKey' in obj || 'appId' in obj) {
      return decryptObject(obj, model);
    }
  }
  return result;
}

/**
 * 创建带加密中间件的 Prisma 客户端
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

          // 写入操作：加密
          if (['create', 'createMany', 'update', 'updateMany', 'upsert'].includes(operation)) {
            if (args.data && typeof args.data === 'object') {
              args.data = encryptObject(args.data as Record<string, unknown>, model);
            }
            if (args.create && typeof args.create === 'object') {
              args.create = encryptObject(args.create as Record<string, unknown>, model);
            }
            if (args.update && typeof args.update === 'object') {
              args.update = encryptObject(args.update as Record<string, unknown>, model);
            }
          }

          const result = await query(args);

          // 读取操作：解密
          return processResult(result, model);
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}
