import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth-utils';
import { setCookie } from '@/lib/cookie';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * API 密钥登录
 * POST /api/auth/api-key-login  { apiKey: "xxx" }
 * GET  /api/auth/api-key-login?key=xxx （浏览器直接访问）
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // IP 级别速率限制：每 IP 每分钟最多 10 次尝试
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(`auth-apikey:${clientIp}`, 10, 60_000)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // 从 body 或 query 获取 apiKey
  const apiKey = req.method === 'POST' ? req.body?.apiKey : req.query?.key;

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'API key required' });
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

  // 更新最后使用时间
  await prisma.apiKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsedAt: new Date() },
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

  // 设置 cookie
  res.setHeader('Set-Cookie', setCookie('auth_token', token, { maxAge: 7 * 24 * 60 * 60 }));

  // GET 请求重定向到仪表盘，POST 请求返回成功
  if (req.method === 'GET') {
    return res.redirect('/dashboard');
  }

  return res.status(200).json({ success: true });
}
