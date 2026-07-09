import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import {
  registerRunner,
  startRunner,
  stopRunner,
  deleteRunner,
  refreshRunnerStatus,
  reregisterRunner,
} from '@/lib/runner/service';
import { logger } from '@/lib/logger';

/**
 * Runner 管理 API
 *
 * GET    /api/admin/runners          — 列出所有 Runner
 * POST   /api/admin/runners          — 创建并注册新 Runner
 * DELETE /api/admin/runners?id=xxx   — 删除 Runner
 * POST   /api/admin/runners/action   — 启动/停止/刷新/重新注册 Runner
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 管理员权限校验
  const admin = await requireAdmin(req, res);
  if (!admin || admin.githubId === undefined) return;

  try {
    switch (req.method) {
      case 'GET':
        return handleList(req, res, admin.githubId);
      case 'POST':
        return handlePost(req, res, admin.githubId);
      case 'DELETE':
        return handleDelete(req, res, admin.githubId);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    logger.error('[Runner API] Error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}

/**
 * 列出所有 Runner
 */
async function handleList(_req: NextApiRequest, res: NextApiResponse, githubId: number) {
  const admin = await prisma.admin.findUnique({ where: { githubId } });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  const runners = await prisma.gitHubRunner.findMany({
    where: { adminId: admin.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      scopeType: true,
      scopeTarget: true,
      labels: true,
      status: true,
      runnerId: true,
      pid: true,
      lastError: true,
      installationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.json({ runners });
}

/**
 * 创建新 Runner
 */
async function handlePost(req: NextApiRequest, res: NextApiResponse, githubId: number) {
  const admin = await prisma.admin.findUnique({ where: { githubId } });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  // 检查操作类型
  const { action } = req.body as { action?: string };

  if (action) {
    return handleAction(req, res, admin, action);
  }

  // 创建新 Runner
  const { name, scopeType, scopeTarget, labels, installationId } = req.body as {
    name?: string;
    scopeType?: string;
    scopeTarget?: string;
    labels?: string[];
    installationId?: number;
  };

  if (!name || !scopeType || !scopeTarget) {
    return res.status(400).json({ error: 'Missing required fields: name, scopeType, scopeTarget' });
  }

  if (scopeType !== 'repo' && scopeType !== 'org') {
    return res.status(400).json({ error: 'scopeType must be "repo" or "org"' });
  }

  // 对于 repo 类型，验证格式（应为 owner/repo）
  if (scopeType === 'repo' && !scopeTarget.includes('/')) {
    return res
      .status(400)
      .json({ error: 'For repo scope, scopeTarget must be "owner/repo" format' });
  }

  // 创建数据库记录
  const runner = await prisma.gitHubRunner.create({
    data: {
      name,
      scopeType,
      scopeTarget,
      labels: labels || ['self-hosted', 'linux', 'x64'],
      adminId: admin.id,
      installationId: installationId || null,
    },
  });

  logger.info(`[Runner API] Runner created: ${runner.id} (${name})`);

  // 尝试立即注册
  try {
    await registerRunner(runner.id);
    logger.info(`[Runner API] Runner ${runner.id} registered successfully`);
  } catch (err) {
    logger.warn(`[Runner API] Runner ${runner.id} registration deferred:`, err);
    // 注册失败不影响创建，稍后可以重试
  }

  // 返回创建的 Runner 信息
  const created = await prisma.gitHubRunner.findUnique({
    where: { id: runner.id },
    select: {
      id: true,
      name: true,
      scopeType: true,
      scopeTarget: true,
      labels: true,
      status: true,
      runnerId: true,
      pid: true,
      lastError: true,
      installationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.status(201).json({ runner: created });
}

/**
 * 处理 Runner 操作
 */
async function handleAction(
  req: NextApiRequest,
  res: NextApiResponse,
  admin: { githubId: number; id: number },
  action: string
) {
  const { runnerId } = req.body as { runnerId?: number };

  if (!runnerId) {
    return res.status(400).json({ error: 'Missing required field: runnerId' });
  }

  // 验证 Runner 归属
  const runner = await prisma.gitHubRunner.findFirst({
    where: { id: runnerId, adminId: admin.id },
  });

  if (!runner) {
    return res.status(404).json({ error: 'Runner not found' });
  }

  switch (action) {
    case 'start':
      await startRunner(runnerId);
      break;
    case 'stop':
      await stopRunner(runnerId);
      break;
    case 'refresh':
      await refreshRunnerStatus(runnerId);
      break;
    case 'reregister':
      await reregisterRunner(runnerId);
      break;
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  // 返回更新后的 Runner 信息
  const updated = await prisma.gitHubRunner.findUnique({
    where: { id: runnerId },
    select: {
      id: true,
      name: true,
      scopeType: true,
      scopeTarget: true,
      labels: true,
      status: true,
      runnerId: true,
      pid: true,
      lastError: true,
      installationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.json({ runner: updated });
}

/**
 * 删除 Runner
 */
async function handleDelete(req: NextApiRequest, res: NextApiResponse, githubId: number) {
  const admin = await prisma.admin.findUnique({ where: { githubId } });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  const idParam = req.query.id;
  const runnerId = Array.isArray(idParam) ? parseInt(idParam[0]) : parseInt(idParam as string);

  if (!runnerId || isNaN(runnerId)) {
    return res.status(400).json({ error: 'Missing or invalid id parameter' });
  }

  // 验证 Runner 归属
  const runner = await prisma.gitHubRunner.findFirst({
    where: { id: runnerId, adminId: admin.id },
  });

  if (!runner) {
    return res.status(404).json({ error: 'Runner not found' });
  }

  await deleteRunner(runnerId);
  return res.json({ success: true });
}
