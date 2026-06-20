import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

// Prisma Client 类型在 db push 前可能不包含 CiRun
const db = prisma as unknown as {
  ciRun: {
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args: unknown) => Promise<number>;
    create: (args: unknown) => Promise<{ id: number }>;
  };
};

/**
 * CI 运行日志
 * GET  /api/ci/runs?repo=owner/repo&limit=50  — 查询仓库运行日志
 * POST /api/ci/runs                           — 记录新的运行（内部调用）
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  // 验证管理员身份
  const JWT_SECRET = process.env.JWT_SECRET;
  const authToken = req.cookies.auth_token;
  if (!authToken || !JWT_SECRET) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    jwt.verify(authToken, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const repo = String(req.query.repo || '');
  if (!repo) {
    return res.status(400).json({ error: 'Missing repo parameter' });
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const [runs, total] = await Promise.all([
      db.ciRun.findMany({
        where: { repoFullName: repo },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          event: true,
          action: true,
          branch: true,
          commitSha: true,
          prNumber: true,
          status: true,
          conclusion: true,
          triggeredBy: true,
          ruleId: true,
          checksRan: true,
          startedAt: true,
          completedAt: true,
          duration: true,
          createdAt: true,
          logs: false, // 列表不返回完整日志，节省带宽
        },
      }),
      db.ciRun.count({ where: { repoFullName: repo } }),
    ]);

    return res.status(200).json({ runs, total, limit, offset });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to query CI runs: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  // 内部调用，通过 API key 或 webhook 签名验证
  const authHeader = req.headers.authorization;
  const internalKey = process.env.INTERNAL_API_KEY;

  if (internalKey && authHeader !== `Bearer ${internalKey}`) {
    // 如果设置了内部密钥，则需要验证
    const JWT_SECRET = process.env.JWT_SECRET;
    const authToken = req.cookies.auth_token;
    if (!authToken || !JWT_SECRET) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      jwt.verify(authToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  const {
    repo,
    event,
    action,
    branch,
    commitSha,
    prNumber,
    status,
    conclusion,
    triggeredBy,
    ruleId,
    checksRan,
    logs,
    duration,
  } = req.body;

  if (!repo || !event) {
    return res.status(400).json({ error: 'Missing required fields: repo, event' });
  }

  // 输入验证
  if (typeof repo !== 'string' || repo.length > 255) {
    return res.status(400).json({ error: 'Invalid repo' });
  }

  const validStatuses = ['pending', 'running', 'success', 'failure', 'cancelled'];
  const runStatus = validStatuses.includes(status) ? status : 'pending';

  try {
    const run = await db.ciRun.create({
      data: {
        repoFullName: repo,
        event,
        action: action || null,
        branch: branch || null,
        commitSha: commitSha || null,
        prNumber: prNumber || null,
        status: runStatus,
        conclusion: conclusion || null,
        triggeredBy: triggeredBy || null,
        ruleId: ruleId || null,
        checksRan: Array.isArray(checksRan) ? checksRan : [],
        logs: typeof logs === 'string' ? logs.slice(0, 50000) : null, // 限制日志大小
        startedAt: runStatus === 'running' ? new Date() : null,
        completedAt: ['success', 'failure', 'cancelled'].includes(runStatus) ? new Date() : null,
        duration: typeof duration === 'number' ? duration : null,
      },
      select: { id: true },
    });

    return res.status(200).json({ success: true, runId: run.id });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to create CI run: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
