import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

interface JwtPayload {
  githubId: number;
  githubLogin: string;
  isAdmin: boolean;
}

/**
 * 管理 API 密钥
 * GET    /api/auth/api-keys     - 列出当前用户的所有密钥
 * POST   /api/auth/api-keys     - 生成新密钥
 * DELETE /api/auth/api-keys?id=x - 撤销密钥
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 验证身份
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!decoded.isAdmin) {
    return res.status(403).json({ error: 'Admin only' });
  }

  // 查找管理员
  const admin = await prisma.admin.findUnique({
    where: { githubId: decoded.githubId },
  });

  if (!admin) {
    return res.status(403).json({ error: 'Admin not found' });
  }

  // GET - 列出密钥
  if (req.method === 'GET') {
    const keys = await prisma.apiKey.findMany({
      where: { adminId: admin.id },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        createdAt: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ keys });
  }

  // POST - 生成新密钥
  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name required' });
    }

    // 生成 32 字节随机密钥
    const rawKey = `manticore_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        name,
        adminId: admin.id,
      },
    });

    // 只在创建时返回原始密钥
    return res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      createdAt: apiKey.createdAt,
    });
  }

  // DELETE - 撤销密钥
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    await prisma.apiKey.deleteMany({
      where: {
        id: Number(id),
        adminId: admin.id,
      },
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
