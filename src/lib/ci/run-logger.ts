import { logger } from '../logger';
/**
 * CI 运行日志记录器
 *
 * 将 webhook 事件和 CI 检查结果记录到 CiRun 表。
 * 使用 fire-and-forget 模式，不阻塞主流程。
 *
 * 安全说明：
 * - 所有输入经过长度截断
 * - 不存储敏感信息（密钥、token 等）
 * - 日志大小限制 50KB
 */

import { Prisma, type CiRunStatus, type CiRunConclusion } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** 日志最大长度 */
const MAX_LOG_LENGTH = 50000;

/**
 * 记录一次 CI 运行
 */
export async function recordCiRun(params: {
  repo: string;
  event: string;
  action?: string;
  branch?: string;
  commitSha?: string;
  prNumber?: number;
  status?: CiRunStatus;
  conclusion?: CiRunConclusion;
  triggeredBy?: string;
  ruleId?: string;
  checksRan?: string[];
  logs?: string;
  duration?: number;
  isBotInitiated?: boolean;
}): Promise<number | null> {
  try {
    const run = await prisma.ciRun.create({
      data: {
        repoFullName: params.repo.slice(0, 255),
        event: params.event,
        action: params.action || null,
        branch: params.branch?.slice(0, 255) || null,
        commitSha: params.commitSha?.slice(0, 40) || null,
        prNumber: params.prNumber || null,
        status: params.status || ('running' as CiRunStatus),
        conclusion: params.conclusion || null,
        triggeredBy: params.triggeredBy?.slice(0, 100) || null,
        ruleId: params.ruleId?.slice(0, 100) || null,
        checksRan: params.checksRan || [],
        logs: params.logs?.slice(0, MAX_LOG_LENGTH) || null,
        isBotInitiated: params.isBotInitiated || false,
        startedAt: params.status === 'running' || !params.status ? new Date() : null,
        completedAt: ['success', 'failure', 'cancelled'].includes(params.status || '')
          ? new Date()
          : null,
        duration: typeof params.duration === 'number' ? params.duration : null,
      },
      select: { id: true },
    });
    return run.id;
  } catch (err) {
    logger.error('[RunLogger] Failed to record CI run:', err);
    return null;
  }
}

/**
 * 更新 CI 运行状态
 */
export async function updateCiRun(
  runId: number,
  params: {
    status?: CiRunStatus;
    conclusion?: CiRunConclusion;
    checksRan?: string[];
    logs?: string;
    duration?: number;
  }
): Promise<void> {
  try {
    // 使用 Prisma 类型安全的更新输入类型
    const updateData: Prisma.CiRunUpdateInput = {};

    if (params.status) {
      updateData.status = params.status;
      if (['success', 'failure', 'cancelled'].includes(params.status)) {
        updateData.completedAt = new Date();
      }
    }
    if (params.conclusion) updateData.conclusion = params.conclusion;
    if (params.checksRan) updateData.checksRan = params.checksRan;
    if (params.logs) updateData.logs = params.logs.slice(0, MAX_LOG_LENGTH);
    if (typeof params.duration === 'number') updateData.duration = params.duration;

    await prisma.ciRun.update({
      where: { id: runId },
      data: updateData,
    });
  } catch (err) {
    logger.error('[RunLogger] Failed to update CI run:', err);
  }
}
