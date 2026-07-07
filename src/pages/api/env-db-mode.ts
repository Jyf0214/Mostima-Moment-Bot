import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';
import { saveEnvVarsToDatabase, disableDatabaseMode } from '@/lib/bootstrap';
import { PrismaClient } from '@prisma/client';

/**
 * 数据库运行模式 API
 * GET    /api/env-db-mode  — 获取当前状态
 * POST   /api/env-db-mode  — 启用数据库模式（保存环境变量）
 * DELETE /api/env-db-mode  — 禁用数据库模式
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = await requireAdmin(req, res);
  if (!payload) return;

  if (req.method === 'GET') {
    return handleGet(res);
  }
  if (req.method === 'POST') {
    return handlePost(res);
  }
  if (req.method === 'DELETE') {
    return handleDelete(res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(res: NextApiResponse) {
  try {
    const rawClient = new PrismaClient();

    // 检查数据库运行模式标志
    const modeConfig = await rawClient.appConfig.findUnique({
      where: { configKey: 'env_vars_mode' },
    });

    const isEnabled = modeConfig?.configValue === 'true';

    // 获取存储的环境变量数量（不返回实际值）
    let envCount = 0;
    if (isEnabled) {
      const envConfig = await rawClient.appConfig.findUnique({
        where: { configKey: 'env_vars' },
      });
      if (envConfig?.configValue) {
        const envVars = JSON.parse(envConfig.configValue) as Record<string, string>;
        envCount = Object.keys(envVars).length;
      }
    }

    await rawClient.$disconnect();

    return res.status(200).json({
      enabled: isEnabled,
      envCount,
    });
  } catch (error) {
    logger.error('[Env DB Mode] Failed to get status:', error);
    return res.status(500).json({ error: 'Failed to get status' });
  }
}

async function handlePost(res: NextApiResponse) {
  try {
    const result = await saveEnvVarsToDatabase();

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to save environment variables' });
    }

    return res.status(200).json({
      success: true,
      envCount: result.count,
      message: 'Database mode enabled. Restart required for changes to take effect.',
    });
  } catch (error) {
    logger.error('[Env DB Mode] Failed to enable:', error);
    return res.status(500).json({ error: 'Failed to enable database mode' });
  }
}

async function handleDelete(res: NextApiResponse) {
  try {
    const success = await disableDatabaseMode();

    if (!success) {
      return res.status(500).json({ error: 'Failed to disable database mode' });
    }

    return res.status(200).json({
      success: true,
      message: 'Database mode disabled. Environment variables will be read from system.',
    });
  } catch (error) {
    logger.error('[Env DB Mode] Failed to disable:', error);
    return res.status(500).json({ error: 'Failed to disable database mode' });
  }
}
