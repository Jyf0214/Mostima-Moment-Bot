import { NextApiRequest, NextApiResponse } from 'next';
import { verifyWebhookSignature } from '@/lib/github/webhook';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  handlePullRequest,
  handleIssueComment,
  handleWorkflowRun,
  type PRPayload,
  type CommentPayload,
  type WorkflowPayload,
} from '@/lib/ci/runner';
import { shouldTriggerIssueFix, solveIssue } from '@/lib/ci/issue-solver';
import { resolveBotSlug } from '@/lib/ci/config';
import { auditPR } from '@/lib/ci/security-auditor';
import { recordCiRun, updateCiRun, flushLogs } from '@/lib/ci/run-logger';
import { LogCollector } from '@/lib/ci/log-collector';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * 从 webhook payload 中安全提取 repository.full_name
 */
function getRepoFullName(payload: Record<string, unknown>): string {
  const repo = payload.repository as Record<string, unknown> | undefined;
  return String(repo?.full_name || '');
}

interface IssueEventPayload {
  action: string;
  issue: { number: number; title: string; body: string };
  label?: { name: string };
  comment?: { body: string; author_association: string; user: { login: string } };
}

interface PREventPayload {
  action: string;
  pull_request: {
    number: number;
    head: { sha: string };
    base: { ref: string };
  };
}

interface InstallationPayload {
  action: string;
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
      type: string;
      avatar_url: string;
    };
  };
}

interface PushPayload {
  ref: string;
  head_commit: { id: string; message: string } | null;
  pusher?: { name?: string };
  repository: { full_name: string };
}

interface WorkflowJobPayload {
  action: string;
  workflow_job: { id: number; name: string; status: string; conclusion: string | null };
  repository: { full_name: string };
}

/**
 * 处理 PR 事件：CI 流水线 + 安全审计
 */
async function handlePREvent(
  payload: Record<string, unknown>,
  workspaceDir: string
): Promise<void> {
  const prPayload = payload as unknown as PREventPayload;

  // CI 流水线日志收集器
  const ciLogger = new LogCollector();

  // fire-and-forget：不阻塞 webhook 响应
  handlePullRequest(prPayload as unknown as PRPayload, ciLogger)
    .then(async () => {
      logger.info(`[Webhook] CI pipeline completed for PR #${prPayload.pull_request.number}`);
      // CI 流水线完成后刷新日志（暂不更新数据库，等审计完成后一起更新）
    })
    .catch((err) => {
      logger.error(`[Webhook] CI pipeline failed for PR #${prPayload.pull_request.number}:`, err);
    });

  // PR 安全审计（bot 自身的工作流）
  if (prPayload.action === 'opened' || prPayload.action === 'synchronize') {
    const prNumber = prPayload.pull_request.number;
    const baseBranch = prPayload.pull_request.base.ref;
    const headSha = prPayload.pull_request.head.sha;
    const repo = getRepoFullName(payload);

    // 审计日志收集器
    const auditLogger = new LogCollector();

    const auditRunId = await recordCiRun({
      repo,
      event: 'security_audit',
      action: prPayload.action,
      branch: baseBranch,
      commitSha: headSha,
      prNumber,
      status: 'running',
      triggeredBy: 'bot',
      isBotInitiated: true,
    });

    auditPR(prNumber, baseBranch, headSha, workspaceDir, auditLogger)
      .then(async () => {
        logger.info(`[Webhook] Security audit completed for PR #${prNumber}`);
        if (auditRunId) {
          await updateCiRun(auditRunId, { status: 'success', conclusion: 'success' });
          await flushLogs(auditRunId, auditLogger);
        }
      })
      .catch(async (err) => {
        logger.error(`Security audit failed for PR #${prNumber}:`, err);
        if (auditRunId) {
          await updateCiRun(auditRunId, {
            status: 'failure',
            conclusion: 'failure',
          });
          auditLogger.addMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
          await flushLogs(auditRunId, auditLogger);
        }
      });
  }
}

/**
 * 处理 Issue / issue_comment 事件：自动修复 + 评论重试
 */
async function handleIssueEvent(
  event: string,
  payload: Record<string, unknown>,
  workspaceDir: string
): Promise<void> {
  const issuePayload = payload as unknown as IssueEventPayload;

  logger.info(
    `[Webhook] Issue event: ${event}, action=${issuePayload.action}, ` +
      `issue=#${issuePayload.issue.number}, ` +
      `label=${issuePayload.label?.name || 'none'}, ` +
      `comment_body=${(issuePayload.comment?.body || '').slice(0, 80)}, ` +
      `comment_assoc=${issuePayload.comment?.author_association || 'none'}`
  );

  // 通过 GitHub API 解析 bot slug（不依赖环境变量）
  const botSlug = await resolveBotSlug();
  const fixCmd = botSlug ? `@${botSlug} /fix` : '';
  logger.info(`[Webhook] Resolved bot slug="${botSlug}", fixCmd="${fixCmd}"`);

  // Issue 自动修复
  const shouldFix = await shouldTriggerIssueFix(event, issuePayload, fixCmd);
  logger.info(`[Webhook] shouldTriggerIssueFix=${shouldFix}`);
  if (shouldFix) {
    logger.info(`[Webhook] Issue auto-fix triggered for Issue #${issuePayload.issue.number}`);

    // Issue 修复日志收集器
    const issueLogger = new LogCollector();

    const issueRepo = getRepoFullName(payload);
    const issueRunId = await recordCiRun({
      repo: issueRepo,
      event: event === 'issues' ? 'issue_labeled' : 'issue_comment',
      action: event === 'issues' ? 'auto-fix' : 'fix-command',
      status: 'running',
      triggeredBy: 'bot',
      isBotInitiated: true,
      logs: `Issue #${issuePayload.issue.number}: ${issuePayload.issue.title}`,
    });

    solveIssue(event, issuePayload, workspaceDir, issueLogger)
      .then(async () => {
        logger.info(`[Webhook] Issue solver completed for issue #${issuePayload.issue.number}`);
        if (issueRunId) {
          await updateCiRun(issueRunId, { status: 'success', conclusion: 'success' });
          await flushLogs(issueRunId, issueLogger);
        }
      })
      .catch(async (err) => {
        logger.error(`Issue solver failed:`, err);
        if (issueRunId) {
          await updateCiRun(issueRunId, {
            status: 'failure',
            conclusion: 'failure',
          });
          issueLogger.addMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
          await flushLogs(issueRunId, issueLogger);
        }
      });
  }

  // issue_comment 重试逻辑
  if (event === 'issue_comment') {
    await handleIssueComment(payload as unknown as CommentPayload);
  }
}

/**
 * 处理 installation 事件：记录/更新/停用 GitHub App 安装
 */
async function handleInstallationEvent(payload: Record<string, unknown>): Promise<void> {
  const installPayload = payload as unknown as InstallationPayload;
  const { action, installation } = installPayload;

  if (action === 'created' || action === 'reopened') {
    logger.info(
      `[Webhook] Installation ${action}: ID=${installation.id}, account=${installation.account.login}`
    );

    const admin = await prisma.admin.findFirst();
    if (!admin) {
      logger.error('[Webhook] No admin found, cannot store installation');
      return;
    }

    const existing = await prisma.gitHubInstallation.findUnique({
      where: { installationId: installation.id },
    });

    if (existing) {
      await prisma.gitHubInstallation.update({
        where: { installationId: installation.id },
        data: { isActive: true, adminId: admin.id },
      });
    } else {
      await prisma.gitHubInstallation.create({
        data: {
          installationId: installation.id,
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          accountId: installation.account.id,
          avatarUrl: installation.account.avatar_url,
          adminId: admin.id,
        },
      });
    }
    logger.info(`[Webhook] Installation record saved: ${installation.account.login}`);
  } else if (action === 'deleted' || action === 'suspend') {
    logger.info(`[Webhook] Installation ${action}: ID=${installation.id}`);
    await prisma.gitHubInstallation.updateMany({
      where: { installationId: installation.id },
      data: { isActive: false },
    });
  }
}

/**
 * GitHub Webhook 接收端
 * POST /api/webhook/github
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 获取原始请求体
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks);

  // 1. 验证签名
  const signature = req.headers['x-hub-signature-256'] as string;
  const secret = process.env.ENCRYPTION_KEY;

  if (!secret) {
    logger.error('ENCRYPTION_KEY is not configured');
    return res.status(500).json({ error: 'Server configuration error: ENCRYPTION_KEY not set' });
  }

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    logger.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. 解析事件
  const event = req.headers['x-github-event'] as string;

  logger.info(`[Webhook] Received: event=${event}`);
  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const workspaceDir = process.env.WORKSPACE_DIR || '.';

  // 3. 事件路由
  try {
    switch (event) {
      case 'pull_request':
        await handlePREvent(payload, workspaceDir);
        break;

      case 'issues':
      case 'issue_comment':
        await handleIssueEvent(event, payload, workspaceDir);
        break;

      case 'workflow_run':
        await handleWorkflowRun(payload as unknown as WorkflowPayload);
        break;

      case 'push': {
        const pushPayload = payload as unknown as PushPayload;
        const commitMsg = pushPayload.head_commit?.message?.slice(0, 80) || 'no message';
        logger.info(
          `[Webhook] Push to ${pushPayload.ref}: ${pushPayload.head_commit?.id?.slice(0, 7) || 'unknown'} — ${commitMsg}`
        );
        break;
      }

      case 'workflow_job': {
        const jobPayload = payload as unknown as WorkflowJobPayload;
        const job = jobPayload.workflow_job;
        logger.info(
          `[Webhook] Workflow job ${jobPayload.action}: ${job.name} — status=${job.status}, conclusion=${job.conclusion || 'pending'}`
        );
        break;
      }

      case 'installation':
        await handleInstallationEvent(payload);
        break;

      default:
        logger.info(`Unhandled event: ${event}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
