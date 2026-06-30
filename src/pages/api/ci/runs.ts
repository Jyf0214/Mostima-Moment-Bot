import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth-utils';
import { getQueryParam, getQueryParamNumber, getQueryParamBoolean } from '@/lib/api-utils';

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
  const authToken = req.cookies.auth_token;
  if (!authToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    verifyAuthToken(authToken);
  } catch (err) {
    logger.warn('[CI Runs] JWT verification failed:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }

  const repo = getQueryParam(req, 'repo') || '';
  const idParam = getQueryParam(req, 'id');

  // 按 ID 查询单条运行（含日志详情）
  if (idParam) {
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid run id' });
    }
    try {
      const run = await prisma.ciRun.findUnique({
        where: { id },
        select: {
          id: true,
          repoFullName: true,
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
          isBotInitiated: true,
          startedAt: true,
          completedAt: true,
          duration: true,
          createdAt: true,
          logs: true,
        },
      });
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }
      return res.status(200).json(run);
    } catch (error) {
      return res.status(500).json({
        error: `Failed to query run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // 没有 repo 参数时，返回所有仓库摘要
  if (!repo) {
    return handleGetRepos(req, res);
  }

  const limit = getQueryParamNumber(req, 'limit', 50, 1, 200);
  const offset = getQueryParamNumber(req, 'offset', 0, 0);
  const botOnly = getQueryParamBoolean(req, 'botOnly');

  const where: Record<string, unknown> = { repoFullName: repo };
  if (botOnly) where.isBotInitiated = true;

  try {
    const [runs, total] = await Promise.all([
      prisma.ciRun.findMany({
        where,
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
          isBotInitiated: true,
          startedAt: true,
          completedAt: true,
          duration: true,
          createdAt: true,
          logs: false,
        },
      }),
      prisma.ciRun.count({ where }),
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
    // 获取最近 500 条 bot 触发的运行记录，按仓库分组统计
    // Prisma 根据 select 子句自动推断返回类型，无需手动类型断言
    const recentRuns = await prisma.ciRun.findMany({
      where: { isBotInitiated: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        repoFullName: true,
        status: true,
        createdAt: true,
        event: true,
        branch: true,
      },
    });

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
      repoNames.map((name) =>
        prisma.ciRun.count({ where: { repoFullName: name, isBotInitiated: true } })
      )
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
  // 认证逻辑：优先使用 INTERNAL_API_KEY，否则要求 JWT 管理员认证
  const authHeader = req.headers.authorization;
  const internalKey = process.env.INTERNAL_API_KEY;

  if (internalKey && authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    // 使用 timing-safe 比较防止时序攻击
    const keyBuf = Buffer.from(internalKey, 'utf-8');
    const tokenBuf = Buffer.from(token, 'utf-8');
    if (keyBuf.length === tokenBuf.length && crypto.timingSafeEqual(keyBuf, tokenBuf)) {
      // 内部密钥认证通过，允许写入
    } else {
      // 未匹配内部密钥时，要求 JWT 管理员认证
      const authToken = req.cookies.auth_token;
      if (!authToken) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      try {
        verifyAuthToken(authToken);
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
  } else {
    // 未匹配内部密钥或未设置密钥时，一律要求 JWT 管理员认证
    const authToken = req.cookies.auth_token;
    if (!authToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      verifyAuthToken(authToken);
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

  const validStatuses: string[] = ['pending', 'running', 'success', 'failure', 'cancelled'];
  const runStatus: string = validStatuses.includes(status as string)
    ? (status as string)
    : 'pending';

  try {
    const run = await prisma.ciRun.create({
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
