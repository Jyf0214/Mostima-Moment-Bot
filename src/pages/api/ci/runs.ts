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
 * GET  /api/ci/runs                    — 查询所有仓库摘要（仓库列表页）
 * GET  /api/ci/runs?repo=owner/repo    — 查询指定仓库运行日志（详情页）
 * POST /api/ci/runs                    — 记录新的运行（内部调用）
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

  // 没有 repo 参数时，返回所有仓库摘要
  if (!repo) {
    return handleGetRepos(req, res);
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
          logs: false,
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

/**
 * 返回所有有运行记录的仓库摘要
 * 每个仓库包含：名称、总运行数、最近一次运行状态/时间
 */
async function handleGetRepos(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 获取最近 500 条运行记录，按仓库分组统计
    const recentRuns = (await db.ciRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        repoFullName: true,
        status: true,
        createdAt: true,
        event: true,
        branch: true,
      },
    })) as Array<{
      repoFullName: string;
      status: string;
      createdAt: Date;
      event: string;
      branch: string | null;
    }>;

    // 按仓库分组，取每个仓库的统计和最新运行
    const repoMap = new Map<
      string,
      {
        total: number;
        latest: { status: string; createdAt: string; event: string; branch: string | null };
      }
    >();

    for (const run of recentRuns) {
      const existing = repoMap.get(run.repoFullName);
      if (existing) {
        existing.total++;
      } else {
        repoMap.set(run.repoFullName, {
          total: 1,
          latest: {
            status: run.status,
            createdAt: String(run.createdAt),
            event: run.event,
            branch: run.branch,
          },
        });
      }
    }

    // 也统计每个仓库的总数（包括不在最近 500 条中的）
    const repoNames = Array.from(repoMap.keys());
    const countResults = await Promise.all(
      repoNames.map((name) => db.ciRun.count({ where: { repoFullName: name } }))
    );

    const repos = repoNames.map((name, i) => ({
      repoFullName: name,
      totalRuns: countResults[i],
      latest: repoMap.get(name)!.latest,
    }));

    // 按最新运行时间排序
    repos.sort(
      (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime()
    );

    return res.status(200).json({ repos, total: repos.length });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to query repos: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
