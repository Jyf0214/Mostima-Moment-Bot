import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';

/**
 * Qwen 配置 API
 * GET  /api/qwen-settings  — 获取 Qwen 配置（管理员）
 * PUT  /api/qwen-settings  — 更新 Qwen 配置（管理员）
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = await requireAdmin(req, res);
  if (!payload) return;

  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'PUT') {
    return handlePut(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { configKey: 'qwen_settings' },
    });

    // 不返回完整内容，只返回状态
    return res.status(200).json({
      configured: !!config?.configValue,
      hasContent: !!(config?.configValue && config.configValue.length > 2),
    });
  } catch (error) {
    logger.error('[Qwen Settings] Failed to get config:', error);
    return res.status(500).json({ error: 'Failed to get Qwen settings' });
  }
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { settings } = req.body;

    if (settings === undefined || settings === null) {
      return res.status(400).json({ error: 'Missing settings field' });
    }

    // 验证 JSON 格式（如果非空）
    if (typeof settings === 'string' && settings.trim()) {
      try {
        JSON.parse(settings);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON format' });
      }
    }

    const value = typeof settings === 'string' ? settings.trim() : '';

    await prisma.appConfig.upsert({
      where: { configKey: 'qwen_settings' },
      update: { configValue: value },
      create: { configKey: 'qwen_settings', configValue: value },
    });

    logger.info(`[Qwen Settings] Config updated: ${value ? 'saved' : 'cleared'}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('[Qwen Settings] Failed to save config:', error);
    return res.status(500).json({ error: 'Failed to save Qwen settings' });
  }
}
