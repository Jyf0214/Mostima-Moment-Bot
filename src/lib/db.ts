import { prisma } from './prisma';

let tablesReady = false;

/**
 * Ensure all database tables exist. Creates them via raw SQL if missing.
 * Called once per process lifetime.
 */
export async function ensureTables(): Promise<void> {
  if (tablesReady) return;

  const check = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admins'
    ) as exists
  `;
  if ((check as any[])[0].exists) {
    tablesReady = true;
    return;
  }

  console.log('[DB] Tables missing, creating...');
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "admins" ("id" SERIAL PRIMARY KEY,"githubId" INTEGER NOT NULL UNIQUE,"github_login" TEXT NOT NULL UNIQUE,"avatar_url" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"last_login" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "app_config" ("id" SERIAL PRIMARY KEY,"config_key" TEXT NOT NULL UNIQUE,"config_value" TEXT NOT NULL,"encrypted" BOOLEAN NOT NULL DEFAULT false,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "webhook_config" ("id" SERIAL PRIMARY KEY,"app_id" TEXT NOT NULL,"webhook_secret_encrypted" TEXT NOT NULL,"private_key_encrypted" TEXT NOT NULL,"repo_owner" TEXT NOT NULL,"repo_name" TEXT NOT NULL,"is_active" BOOLEAN NOT NULL DEFAULT true,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "builds" ("id" SERIAL PRIMARY KEY,"pr_number" INTEGER NOT NULL,"branch_name" TEXT NOT NULL,"trigger_user" TEXT NOT NULL,"started_at" TIMESTAMP(3) NOT NULL,"completed_at" TIMESTAMP(3),"status" TEXT NOT NULL,"total_duration" INTEGER,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "build_steps" ("id" SERIAL PRIMARY KEY,"build_id" INTEGER NOT NULL,"step_name" TEXT NOT NULL,"status" TEXT NOT NULL,"duration" INTEGER,"exit_code" INTEGER,"output" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "builds_pr_number_idx" ON "builds"("pr_number")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "builds_created_at_idx" ON "builds"("created_at")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "build_steps_build_id_idx" ON "build_steps"("build_id")`
  );

  tablesReady = true;
  console.log('[DB] Tables created');
}

/**
 * Check if this is a fresh application (no admins)
 */
export async function isNewApplication(): Promise<boolean> {
  await ensureTables();
  const count = await prisma.admin.count();
  return count === 0;
}

/**
 * 获取管理员
 */
export async function getAdmin(githubId: number) {
  await ensureTables();
  return prisma.admin.findUnique({
    where: { githubId },
  });
}

/**
 * 创建管理员
 */
export async function createAdmin(githubId: number, githubLogin: string, avatarUrl: string) {
  await ensureTables();
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
  await ensureTables();
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

/**
 * 获取 Webhook 配置
 */
export async function getWebhookConfig() {
  return prisma.webhookConfig.findFirst({
    where: { isActive: true },
  });
}

/**
 * 设置 Webhook 配置（自动加密敏感字段）
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

  // 插入新配置（中间件自动加密 webhookSecretEncrypted 和 privateKeyEncrypted）
  return prisma.webhookConfig.create({
    data: {
      appId,
      webhookSecretEncrypted: webhookSecret,
      privateKeyEncrypted: privateKey,
      repoOwner,
      repoName,
    },
  });
}

/**
 * 获取解密后的 Webhook 配置
 */
export async function getDecryptedWebhookConfig() {
  const config = await getWebhookConfig();
  if (!config) {
    return null;
  }

  // 中间件已自动解密 webhookSecretEncrypted 和 privateKeyEncrypted
  return {
    ...config,
    webhookSecret: config.webhookSecretEncrypted,
    privateKey: config.privateKeyEncrypted,
  };
}

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
  await ensureTables();
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
