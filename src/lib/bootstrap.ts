import { prisma } from '@/lib/prisma';

/**
 * 首次启动自动保存环境变量到数据库
 *
 * 当数据库为空（无管理员）时，将环境变量中的配置保存到 AppConfig。
 * 后续启动从数据库读取，不再依赖环境变量。
 *
 * 可保存的配置：
 * - GITHUB_CLIENT_ID → github_client_id
 * - GITHUB_CLIENT_SECRET → github_client_secret
 * - JWT_SECRET → jwt_secret
 * - GITHUB_APP_ID → github_app_id
 * - GITHUB_PRIVATE_KEY_PATH → github_private_key_path（仅路径，私钥需单独上传）
 */
export async function autoSaveEnvVars(): Promise<void> {
  try {
    const adminCount = await prisma.admin.count();
    if (adminCount > 0) {
      // 已有管理员，跳过自动保存
      return;
    }

    console.log('[Bootstrap] Empty database detected, auto-saving env vars...');

    const varsToSave: Array<{ key: string; value: string }> = [];

    const envMap: Record<string, string | undefined> = {
      github_client_id: process.env.GITHUB_CLIENT_ID,
      github_client_secret: process.env.GITHUB_CLIENT_SECRET,
      jwt_secret: process.env.JWT_SECRET,
      github_app_id: process.env.GITHUB_APP_ID,
      github_private_key_path: process.env.GITHUB_PRIVATE_KEY_PATH,
    };

    for (const [key, value] of Object.entries(envMap)) {
      if (value) {
        varsToSave.push({ key, value });
      }
    }

    // 批量保存（不加密，因为加密密钥可能尚未启用）
    for (const { key, value } of varsToSave) {
      await prisma.appConfig.upsert({
        where: { configKey: key },
        update: { configValue: value },
        create: { configKey: key, configValue: value, encrypted: false },
      });
    }

    console.log(`[Bootstrap] Saved ${varsToSave.length} env vars to database`);
  } catch (error) {
    console.error('[Bootstrap] Failed to auto-save env vars:', error);
    // 不阻塞启动
  }
}
