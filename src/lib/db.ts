import { prisma } from './prisma';
import { encrypt, decrypt } from './crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * 检查是否为全新应用（无管理员）
 */
export async function isNewApplication(): Promise<boolean> {
  const count = await prisma.admin.count();
  return count === 0;
}

/**
 * 获取管理员
 */
export async function getAdmin(githubId: number) {
  return prisma.admin.findUnique({
    where: { githubId },
  });
}

/**
 * 创建管理员
 */
export async function createAdmin(
  githubId: number,
  githubLogin: string,
  avatarUrl: string
) {
  return prisma.admin.create({
    data: {
      githubId,
      githubLogin,
      avatarUrl,
    },
  });
}

/**
 * 更新管理员最后登录时间
 */
export async function updateAdminLogin(githubId: number) {
  return prisma.admin.update({
    where: { githubId },
    data: { lastLogin: new Date() },
  });
}

/**
 * 获取配置
 */
export async function getConfig(key: string): Promise<string | null> {
  const config = await prisma.appConfig.findUnique({
    where: { configKey: key },
  });

  if (!config) {
    return null;
  }

  if (config.encrypted) {
    return decrypt(config.configValue, ENCRYPTION_KEY);
  }

  return config.configValue;
}

/**
 * 设置配置
 */
export async function setConfig(key: string, value: string, encrypted: boolean = false) {
  const configValue = encrypted ? encrypt(value, ENCRYPTION_KEY) : value;

  return prisma.appConfig.upsert({
    where: { configKey: key },
    update: { configValue, encrypted },
    create: { configKey: key, configValue, encrypted },
  });
}

/**
 * 获取 Webhook 配置
 */
export async function getWebhookConfig() {
  return prisma.webhookConfig.findFirst({
    where: { isActive: true },
  });
}

/**
 * 设置 Webhook 配置
 */
export async function setWebhookConfig(
  appId: string,
  webhookSecret: string,
  privateKey: string,
  repoOwner: string,
  repoName: string
) {
  // 先停用旧配置
  await prisma.webhookConfig.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  // 插入新配置
  return prisma.webhookConfig.create({
    data: {
      appId,
      webhookSecretEncrypted: encrypt(webhookSecret, ENCRYPTION_KEY),
      privateKeyEncrypted: encrypt(privateKey, ENCRYPTION_KEY),
      repoOwner,
      repoName,
    },
  });
}

/**
 * 解密 Webhook 配置
 */
export async function getDecryptedWebhookConfig() {
  const config = await getWebhookConfig();
  if (!config) {
    return null;
  }

  return {
    ...config,
    webhookSecret: decrypt(config.webhookSecretEncrypted, ENCRYPTION_KEY),
    privateKey: decrypt(config.privateKeyEncrypted, ENCRYPTION_KEY),
  };
}

/**
 * 创建构建记录
 */
export async function createBuild(
  prNumber: number,
  branchName: string,
  triggerUser: string
) {
  return prisma.build.create({
    data: {
      prNumber,
      branchName,
      triggerUser,
      startedAt: new Date(),
      status: 'running',
    },
  });
}

/**
 * 更新构建状态
 */
export async function updateBuildStatus(
  buildId: number,
  status: string,
  totalDuration?: number
) {
  return prisma.build.update({
    where: { id: buildId },
    data: {
      status,
      completedAt: new Date(),
      totalDuration,
    },
  });
}

/**
 * 创建构建步骤
 */
export async function createBuildStep(
  buildId: number,
  stepName: string,
  status: string,
  duration?: number,
  exitCode?: number,
  output?: string
) {
  return prisma.buildStep.create({
    data: {
      buildId,
      stepName,
      status,
      duration,
      exitCode,
      output,
    },
  });
}

/**
 * 删除非管理员用户数据
 */
export async function discardNonAdminData(githubId: number) {
  const admin = await getAdmin(githubId);
  if (!admin) {
    // 非管理员，删除相关构建数据
    await prisma.buildStep.deleteMany({
      where: {
        build: {
          triggerUser: githubId.toString(),
        },
      },
    });
    await prisma.build.deleteMany({
      where: {
        triggerUser: githubId.toString(),
      },
    });
  }
}
