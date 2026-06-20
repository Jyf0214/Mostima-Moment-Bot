---
name: prisma-encryption-middleware
description: Prisma Client Extensions 实现数据库字段自动加密/解密中间件
source: auto-skill
extracted_at: '2026-06-20T04:48:33.039Z'
---

# Prisma 加密中间件

使用 Prisma Client Extensions 实现数据库敏感字段的自动加密和解密。

## 架构

```
代码层 → db.ts（业务逻辑）→ middleware.ts（自动加密/解密）→ Prisma → 数据库
```

## 实现步骤

### 1. 定义加密字段配置

```typescript
// src/lib/middleware.ts
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  AppConfig: ['configValue'],
  WebhookConfig: ['webhookSecretEncrypted', 'privateKeyEncrypted'],
};
```

### 2. 创建加密/解密工具函数

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

export function encrypt(data: string, password: string): string {
  const salt = crypto.randomBytes(64);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encryptedData: string, password: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted data format');
  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const encrypted = Buffer.from(parts[3], 'hex');
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
```

### 3. 创建 Prisma Client Extensions 中间件

```typescript
// src/lib/middleware.ts
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from './crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

function isEncryptedField(model: string, field: string): boolean {
  return ENCRYPTED_FIELDS[model]?.includes(field) ?? false;
}

function encryptObject(obj: Record<string, unknown>, model: string): Record<string, unknown> {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (isEncryptedField(model, key) && typeof value === 'string') {
      result[key] = encrypt(value, ENCRYPTION_KEY);
    }
  }
  return result;
}

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

export function createEncryptedPrismaClient(): PrismaClient {
  const client = new PrismaClient();
  const extended = client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          const model = (args.model as string) || '';

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
          return processResult(result, model);
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}
```

### 4. 注册到 Prisma 客户端

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { createEncryptedPrismaClient } from './middleware';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createEncryptedPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 5. 业务代码无需手动加密

```typescript
// src/lib/db.ts
import { prisma } from './prisma';

// 写入时自动加密
export async function setConfig(key: string, value: string) {
  return prisma.appConfig.upsert({
    where: { configKey: key },
    update: { configValue: value },
    create: { configKey: key, configValue: value },
  });
}

// 读取时自动解密
export async function getConfig(key: string): Promise<string | null> {
  const config = await prisma.appConfig.findUnique({
    where: { configKey: key },
  });
  return config?.configValue ?? null;
}
```

## 注意事项

1. **Prisma v6 使用 Client Extensions**，不再支持 `$use` 中间件
2. **加密字段配置**在 `ENCRYPTED_FIELDS` 中定义
3. **解密失败**时保持原值，不抛出异常
4. **环境变量** `ENCRYPTION_KEY` 必须配置
5. **测试时**需要 mock Prisma 客户端

## 参考

- Prisma Client Extensions: https://www.prisma.io/docs/orm/prisma-client/client-extensions
- AES-256-GCM: Node.js crypto 模块
- PBKDF2: 密钥派生函数
