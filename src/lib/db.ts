import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Check if this is a fresh application (no admins)
 * Tables must exist (created by prisma db push at startup)
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
export async function createAdmin(githubId: number, githubLogin: string, avatarUrl: string) {
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
 * 获取配置（自动解密）
 */
export async function getConfig(key: string): Promise<string | null> {
  const config = await prisma.appConfig.findUnique({
    where: { configKey: key },
  });

  if (!config) {
    return null;
  }

  // 中间件已自动解密
  return config.configValue;
}

/**
 * 设置配置（自动加密）
 */
export async function setConfig(key: string, value: string, encrypted: boolean = false) {
  // 中间件会自动加密 configValue 字段
  return prisma.appConfig.upsert({
    where: { configKey: key },
    update: { configValue: value, encrypted },
    create: { configKey: key, configValue: value, encrypted },
  });
}

// TODO: CI/CD 构建记录预留接口，当前未使用，保留供未来扩展
// Build/BuildStep 模型在 discardNonAdminData 中活跃使用；激活时需评估 triggerUser 外键约束兼容性
/**
 * 创建构建记录
 */
export async function createBuild(prNumber: number, branchName: string, triggerUser: string) {
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

// TODO: CI/CD 构建记录预留接口，当前未使用，保留供未来扩展
// Build/BuildStep 模型在 discardNonAdminData 中活跃使用；激活时需评估 triggerUser 外键约束兼容性
/**
 * 更新构建状态
 */
export async function updateBuildStatus(buildId: number, status: string, totalDuration?: number) {
  return prisma.build.update({
    where: { id: buildId },
    data: {
      status,
      completedAt: new Date(),
      totalDuration,
    },
  });
}

// TODO: CI/CD 构建记录预留接口，当前未使用，保留供未来扩展
// Build/BuildStep 模型在 discardNonAdminData 中活跃使用；激活时需评估 triggerUser 外键约束兼容性
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
 * @param githubLogin - 非管理员的 GitHub 用户名（与 Build.triggerUser 类型匹配）
 */
export async function discardNonAdminData(githubId: number, githubLogin: string) {
  const admin = await getAdmin(githubId);
  if (!admin) {
    // 非管理员，删除相关构建数据
    logger.info(
      `[DB] Discarding build data for non-admin user: ${githubLogin} (githubId: ${githubId})`
    );
    const deletedSteps = await prisma.buildStep.deleteMany({
      where: {
        build: {
          triggerUser: githubLogin,
        },
      },
    });
    const deletedBuilds = await prisma.build.deleteMany({
      where: {
        triggerUser: githubLogin,
      },
    });
    logger.info(
      `[DB] Discarded ${deletedBuilds.count} builds and ${deletedSteps.count} build steps for ${githubLogin}`
    );
  }
}
