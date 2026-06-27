import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-utils';
import { getQueryParam } from '@/lib/api-utils';

/**
 * 站点配置 API
 * GET  /api/site-config          - 获取所有配置（公开）
 * GET  /api/site-config?key=xxx  - 获取指定配置（公开）
 * PUT  /api/site-config          - 更新配置（需管理员）
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET 请求无需认证（首页需要公开读取）
  if (req.method === 'GET') {
    const key = getQueryParam(req, 'key');

    if (key) {
      const config = await prisma.appConfig.findUnique({
        where: { configKey: key },
      });
      return res.status(200).json({ key, value: config?.configValue || null });
    }

    // 获取所有配置
    const configs = await prisma.appConfig.findMany({
      where: { configKey: { startsWith: 'hero_' } },
    });
    const result: Record<string, string> = {};
    configs.forEach((c) => {
      result[c.configKey] = c.configValue;
    });
    return res.status(200).json(result);
  }

  // PUT 请求需要管理员认证
  if (req.method === 'PUT') {
    const payload = await requireAdmin(req, res);
    if (!payload) return;

    const { key, value } = req.body;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Key required' });
    }

    // 只允许 hero_ 前缀的配置
    if (!key.startsWith('hero_')) {
      return res.status(400).json({ error: 'Only hero_ prefix keys are allowed' });
    }

    await prisma.appConfig.upsert({
      where: { configKey: key },
      update: { configValue: String(value ?? '') },
      create: { configKey: key, configValue: String(value ?? '') },
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
