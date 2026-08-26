import { logger } from '@/lib/logger';
import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { setConfig, getConfig } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-utils';

/**
 * GitHub App 私钥管理
 * GET  — 检查私钥是否已配置
 * POST — 上传/更新私钥（存储到 AppConfig，加密）
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 私钥属高危配置：必须校验管理员身份。
  // 此前只校验登录态（注释却写"管理员"），任意登录用户都能替换私钥
  const payload = await requireAdmin(req, res);
  if (!payload) return;

  if (req.method === 'GET') {
    try {
      const privateKey = await getConfig('github_private_key');
      return res.status(200).json({
        configured: !!privateKey,
        source: process.env.GITHUB_PRIVATE_KEY_PATH ? 'file' : privateKey ? 'database' : 'none',
      });
    } catch (err) {
      logger.warn('[GitHub Private Key] Failed to check private key status:', err);
      return res.status(200).json({ configured: false, source: 'none' });
    }
  }

  if (req.method === 'POST') {
    const { privateKey } = req.body;

    if (!privateKey || typeof privateKey !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid privateKey' });
    }

    // 验证 PEM 格式（使用 crypto.createPrivateKey 验证是否为有效私钥）
    if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END')) {
      return res.status(400).json({ error: 'Invalid PEM format' });
    }
    try {
      crypto.createPrivateKey(privateKey);
    } catch {
      return res.status(400).json({ error: 'Invalid private key: not a valid RSA/EC private key' });
    }

    try {
      // 存储到 AppConfig（中间件自动加密）
      await setConfig('github_private_key', privateKey, true);

      // 验证能正常读取和使用
      const { generateJWT } = await import('@/lib/github/auth');
      const appId = process.env.GITHUB_APP_ID || (await getConfig('github_app_id'));

      if (appId) {
        const testJwt = generateJWT(appId, privateKey);
        // 解码验证结构
        const decoded = jwt.decode(testJwt) as { iss?: string } | null;
        if (!decoded?.iss) {
          return res.status(500).json({ error: 'JWT generation test failed' });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Private key saved and verified',
      });
    } catch (error) {
      logger.error('Failed to save private key:', error);
      return res.status(500).json({
        error: `Failed to save private key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
