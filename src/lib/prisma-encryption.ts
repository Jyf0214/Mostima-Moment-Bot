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

  // 1. 环境变量（推荐方式，安全等级最高）
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    cachedEncryptionKey = envKey;
    encryptionKeyLoaded = true;
    return envKey;
  }

  // 2. 数据库 AppConfig（用户在设置页面存储的密钥，明文）
  // [安全警告] 此路径存在安全风险：加密密钥明文存储在数据库中。
  // 如果数据库被攻破，所有加密数据（github_client_secret、jwt_secret 等）都会泄露。
  // 生产环境强烈建议配置 ENCRYPTION_KEY 环境变量。
  //
  // 设计说明：这是有意为之的降级路径。加密中间件需要密钥才能解密数据库中的数据，
  // 但密钥本身可能存储在数据库中（鸡生蛋问题）。此处创建独立 PrismaClient
  // 绕过加密中间件直接读取明文密钥，读取后立即断开连接。
  //
  // [废弃警告] 此降级路径已在 v1.x 中标记为废弃，将在 v2.0.0 中移除。
  // 请尽快迁移到 ENCRYPTION_KEY 环境变量配置。
  const warningMessage = `
  ⚠️  SECURITY WARNING: Reading encryption key from database
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Your system is using the legacy database-stored encryption key.
  This path is DEPRECATED and will be REMOVED in v2.0.0.

  Please configure ENCRYPTION_KEY environment variable:
  1. Generate a new key: openssl rand -hex 32
  2. Add to your .env file: ENCRYPTION_KEY=<generated_key>
  3. Restart the application

  Security risk: If database is compromised, all encrypted data
  (github_client_secret, jwt_secret, etc.) will be exposed.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `;
  console.warn(warningMessage);
  logger.warn(
    '[Encryption] ⚠️ SECURITY WARNING: ENCRYPTION_KEY not found in environment variables. ' +
      'Falling back to database storage (DEPRECATED, will be removed in v2.0.0). ' +
      'Please migrate to ENCRYPTION_KEY environment variable for production.'
  );

  const rawClient = new PrismaClient();
  try {
    const config = await rawClient.appConfig.findUnique({
      where: { configKey: 'encryption_key' },
    });

    if (config?.configValue) {
      cachedEncryptionKey = config.configValue;
      encryptionKeyLoaded = true;
      logger.warn('[Encryption] Loaded encryption key from database (less secure than env var)');
      return config.configValue;
    }
  } catch (err) {
    // 数据库不可用，降级为仅环境变量模式
    logger.warn('[Encryption] Failed to read key from database:', err);
  } finally {
    await rawClient.$disconnect();
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

/**
 * 加密对象中的指定字段
 *
 * 注意：仅对字符串类型进行加密。如果字段值为 null/undefined/数字等非字符串类型，
 * 则跳过加密。这是有意为之的设计：加密算法只处理字符串，非字符串值不需要加密。
 */
function encryptObject(
  obj: Record<string, unknown>,
  model: string,
  key: string
): Record<string, unknown> {
  const result = { ...obj };
  for (const [k, value] of Object.entries(result)) {
    if (isEncryptedField(model, k)) {
      if (typeof value === 'string') {
        result[k] = encrypt(value, key);
      } else if (value !== null && value !== undefined) {
        // 非字符串类型的加密字段，记录警告（可能需要检查数据模型）
        logger.warn(
          `[Encryption] Field "${k}" in model "${model}" is marked for encryption ` +
            `but has non-string type (${typeof value}). Skipping encryption.`
        );
      }
    }
  }
  return result;
}

/**
 * 解密对象中的指定字段
 *
 * 注意：仅对字符串类型进行解密。如果字段值为 null/undefined/数字等非字符串类型，
 * 则跳过解密。解密失败时抛出异常防止明文密文混合。
 */
function decryptObject(
  obj: Record<string, unknown>,
  model: string,
  key: string
): Record<string, unknown> {
  const result = { ...obj };
  for (const [k, value] of Object.entries(result)) {
    if (isEncryptedField(model, k)) {
      if (typeof value === 'string') {
        result[k] = decrypt(value, key);
      } else if (value !== null && value !== undefined) {
        // 非字符串类型的加密字段，记录警告
        logger.warn(
          `[Encryption] Field "${k}" in model "${model}" is marked for encryption ` +
            `but has non-string type (${typeof value}). Skipping decryption.`
        );
      }
    }
  }
  return result;
}

/** 递归处理查询结果：对包含加密字段的模型自动解密 */
function processResult(result: unknown, model: string, key: string | null): unknown {
  if (result === null || result === undefined) return result;
  if (Array.isArray(result)) return result.map((item) => processResult(item, model, key));
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    // 仅当模型存在需要加密的字段时才尝试解密，避免对非模型对象误操作
    if (model && ENCRYPTED_FIELDS[model]?.length && key) {
      return decryptObject(obj, model, key);
    }
    return obj;
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
