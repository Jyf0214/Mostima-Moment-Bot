import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-utils';

/**
 * 管理 API 密钥
 * GET    /api/auth/api-keys     - 列出当前用户的所有密钥
 * POST   /api/auth/api-keys     - 生成新密钥
 * DELETE /api/auth/api-keys?id=x - 撤销密钥
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 验证管理员身份
  const payload = await requireAdmin(req, res);
  if (!payload) return;

  // 查找管理员
  const admin = await prisma.admin.findUnique({
    where: { githubId: payload.githubId },
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
