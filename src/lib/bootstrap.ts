import { logger } from './logger';
import { prisma } from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';

/**
 * 不能存入数据库的环境变量
 * 这些变量需要在启动时通过环境变量提供
 */
const EXCLUDED_ENV_VARS = new Set([
  'ENCRYPTION_KEY', // 加密核心密钥，需要解密数据库数据
  'DATABASE_URL', // 数据库连接字符串，需要连接数据库
  'NODE_ENV', // 系统运行模式
  'HOME', // 用户目录
]);

/**
 * 可以存入数据库的环境变量列表
 */
const STORABLE_ENV_VARS = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'JWT_SECRET',
  'GITHUB_APP_ID',
  'GITHUB_PRIVATE_KEY_PATH',
  'UNLIMITED_OPENAI_API_KEY',
  'QWEN_SETTINGS_JSON',
  'SCAN_TRIGGER_TOKEN',
  'APP_URL',
  'CI_STEP_TIMEOUT_MS',
  'QWEN_MAX_DURATION_MS',
  'QWEN_TIMEOUT_MS',
  'GITHUB_TOKEN',
  'INTERNAL_API_KEY',
  'WORKSPACE_DIR',
  'REPO_OWNER',
  'REPO_NAME',
  'COLLABORATORS',
];

/**
 * 收集当前环境变量（排除不能存入数据库的变量）
 */
function collectEnvVars(): Record<string, string> {
  const envVars: Record<string, string> = {};

  for (const varName of STORABLE_ENV_VARS) {
    const value = process.env[varName];
    if (value !== undefined && value !== '') {
      envVars[varName] = value;
    }
  }

  return envVars;
}

/**
 * 从数据库加载环境变量到 process.env
 * 使用原始 PrismaClient 绕过加密中间件
 */
export async function loadEnvVarsFromDatabase(): Promise<boolean> {
  try {
    const rawClient = new PrismaClient();

    // 检查数据库运行模式标志
    const modeConfig = await rawClient.appConfig.findUnique({
      where: { configKey: 'env_vars_mode' },
    });

    if (!modeConfig || modeConfig.configValue !== 'true') {
      await rawClient.$disconnect();
      return false;
    }

    // 读取环境变量
    const envConfig = await rawClient.appConfig.findUnique({
      where: { configKey: 'env_vars' },
    });

    if (!envConfig?.configValue) {
      logger.warn('[Bootstrap] env_vars_mode is true but env_vars is empty');
      await rawClient.$disconnect();
      return false;
    }

    const envVars = JSON.parse(envConfig.configValue) as Record<string, string>;

    // 设置到 process.env（不覆盖已有的环境变量）
    let loadedCount = 0;
    for (const [key, value] of Object.entries(envVars)) {
      if (!EXCLUDED_ENV_VARS.has(key) && !process.env[key]) {
        process.env[key] = value;
        loadedCount++;
      }
    }

    logger.info(`[Bootstrap] Loaded ${loadedCount} env vars from database`);
    await rawClient.$disconnect();
    return true;
  } catch (error) {
    logger.error('[Bootstrap] Failed to load env vars from database:', error);
    return false;
  }
}

/**
 * 保存环境变量到数据库并启用数据库运行模式
 * 使用原始 PrismaClient 绕过加密中间件
 */
export async function saveEnvVarsToDatabase(): Promise<{ success: boolean; count: number }> {
  try {
    const rawClient = new PrismaClient();

    // 收集环境变量
    const envVars = collectEnvVars();
    const envVarsJson = JSON.stringify(envVars);

    // 保存环境变量
    await rawClient.appConfig.upsert({
      where: { configKey: 'env_vars' },
      update: { configValue: envVarsJson, encrypted: false },
      create: { configKey: 'env_vars', configValue: envVarsJson, encrypted: false },
    });

    // 启用数据库运行模式
    await rawClient.appConfig.upsert({
      where: { configKey: 'env_vars_mode' },
      update: { configValue: 'true', encrypted: false },
      create: { configKey: 'env_vars_mode', configValue: 'true', encrypted: false },
    });

    await rawClient.$disconnect();

    logger.info(`[Bootstrap] Saved ${Object.keys(envVars).length} env vars to database`);
    return { success: true, count: Object.keys(envVars).length };
  } catch (error) {
    logger.error('[Bootstrap] Failed to save env vars to database:', error);
    return { success: false, count: 0 };
  }
}

/**
 * 禁用数据库运行模式（清除标志）
 */
export async function disableDatabaseMode(): Promise<boolean> {
  try {
    const rawClient = new PrismaClient();

    await rawClient.appConfig.upsert({
      where: { configKey: 'env_vars_mode' },
      update: { configValue: 'false', encrypted: false },
      create: { configKey: 'env_vars_mode', configValue: 'false', encrypted: false },
    });

    await rawClient.$disconnect();
    logger.info('[Bootstrap] Database mode disabled');
    return true;
  } catch (error) {
    logger.error('[Bootstrap] Failed to disable database mode:', error);
    return false;
  }
}

/**
 * 首次启动自动保存环境变量到数据库
 *
 * 当数据库为空（无管理员）时，将环境变量中的配置保存到 AppConfig。
 * 后续启动从数据库读取，不再依赖环境变量。
 *
 * 注意：此时加密已通过环境变量 ENCRYPTION_KEY 开启，
 * 所以通过 Prisma 中间件保存的数据会自动加密。
 *
 * [安全警告] ENCRYPTION_KEY 本身以明文形式保存到数据库。
 * 这是设计上的降级路径，生产环境强烈建议始终配置 ENCRYPTION_KEY 环境变量。
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
    // [安全警告] 这是降级路径，生产环境应始终配置 ENCRYPTION_KEY 环境变量
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (encryptionKey) {
      varsToSave.push({ key: 'encryption_key', value: encryptionKey, encrypted: false });
      logger.warn(
        '[Bootstrap] ⚠️ SECURITY NOTE: Storing ENCRYPTION_KEY in database (less secure). ' +
          'Configure via environment variable for production.'
      );
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
        try {
          await rawClient.appConfig.upsert({
            where: { configKey: key },
            update: { configValue: value, encrypted: false },
            create: { configKey: key, configValue: value, encrypted: false },
          });
        } finally {
          await rawClient.$disconnect();
        }
      }
    }

    logger.info(`[Bootstrap] Saved ${varsToSave.length} env vars to database`);
  } catch (error) {
    logger.error('[Bootstrap] Failed to auto-save env vars:', error);
  }
}
