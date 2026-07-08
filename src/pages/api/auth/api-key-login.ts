import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth-utils';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * API 密钥登录（仅支持 POST）
 * POST /api/auth/api-key-login  { apiKey: "xxx" }
 *
 * 注意：API Key 现在可以直接用于 API 调用（作为 Bearer Token），
 * 此端点仅用于需要 JWT token 的场景（如浏览器 cookie 认证）。
 * 推荐直接使用 API Key：Authorization: Bearer manticore_xxx
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 仅支持 POST 方法
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // IP 级别速率限制：每 IP 每分钟最多 10 次尝试
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(`auth-apikey:${clientIp}`, 10, 60_000)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // 从 body 获取 apiKey
  const apiKey = req.body?.apiKey;

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API key required in request body' });
  }

  // 输入长度验证（manticore_ + 64 hex = 75 字符，加上合理余量）
  if (apiKey.length > 200) {
    return res.status(400).json({ error: 'API key too long' });
  }

  // 计算密钥的 SHA-256 哈希
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // 查找密钥
  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { admin: true },
  });

  if (!apiKeyRecord || !apiKeyRecord.isActive) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // 更新最后使用时间（异步，不阻塞响应）
  prisma.apiKey
    .update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // 忽略更新错误
    });

  // 签发 JWT
  let JWT_SECRET: string;
  try {
    JWT_SECRET = getJwtSecret();
  } catch {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const token = jwt.sign(
    {
      githubId: apiKeyRecord.admin.githubId,
      githubLogin: apiKeyRecord.admin.githubLogin,
      avatarUrl: apiKeyRecord.admin.avatarUrl || '',
      isAdmin: true,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // 返回 token（不再设置 cookie，推荐直接使用 API Key）
  return res.status(200).json({ success: true, token });
}
