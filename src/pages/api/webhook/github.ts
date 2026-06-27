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
import { getFixCommand } from '@/lib/ci/config';
import { auditPR } from '@/lib/ci/security-auditor';
import { recordCiRun, updateCiRun } from '@/lib/ci/run-logger';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
      case 'pull_request': {
        const prPayload = payload as unknown as PREventPayload;

        // fire-and-forget：不阻塞 webhook 响应
        handlePullRequest(prPayload as unknown as PRPayload).catch((err) => {
          logger.error(
            `[Webhook] CI pipeline failed for PR #${prPayload.pull_request.number}:`,
            err
          );
        });

        // PR 安全审计（bot 自身的工作流）
        if (prPayload.action === 'opened' || prPayload.action === 'synchronize') {
          const prNumber = prPayload.pull_request.number;
          const baseBranch = prPayload.pull_request.base.ref;
          const headSha = prPayload.pull_request.head.sha;
          const repo = String(
            (payload as Record<string, unknown>).repository
              ? ((payload as Record<string, unknown>).repository as Record<string, unknown>)
                  .full_name || ''
              : ''
          );

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

          auditPR(prNumber, baseBranch, headSha, workspaceDir)
            .then(() => {
              if (auditRunId) {
                updateCiRun(auditRunId, { status: 'success', conclusion: 'success' });
              }
            })
            .catch((err) => {
              logger.error(`Security audit failed for PR #${prNumber}:`, err);
              if (auditRunId) {
                updateCiRun(auditRunId, {
                  status: 'failure',
                  conclusion: 'failure',
                  logs: err instanceof Error ? err.message : String(err),
                });
              }
            });
        }
        break;
      }

      case 'issues':
      case 'issue_comment': {
        const issuePayload = payload as unknown as IssueEventPayload;

        logger.info(
          `[Webhook] Issue event: ${event}, action=${issuePayload.action}, ` +
            `issue=#${issuePayload.issue.number}, ` +
            `label=${issuePayload.label?.name || 'none'}, ` +
            `comment_body=${(issuePayload.comment?.body || '').slice(0, 80)}, ` +
            `comment_assoc=${issuePayload.comment?.author_association || 'none'}`
        );

        // Issue 自动修复
        const shouldFix = shouldTriggerIssueFix(event, issuePayload);
        logger.info(`[Webhook] shouldTriggerIssueFix=${shouldFix}, fixCmd="${getFixCommand()}"`);
        if (shouldFix) {
          logger.info(`[Webhook] Issue auto-fix triggered for Issue #${issuePayload.issue.number}`);

          // 记录 bot 触发的工作流日志
          const issueRepo = String(
            (payload as Record<string, unknown>).repository
              ? ((payload as Record<string, unknown>).repository as Record<string, unknown>)
                  .full_name || ''
              : ''
          );
          const issueRunId = await recordCiRun({
            repo: issueRepo,
            event: event === 'issues' ? 'issue_labeled' : 'issue_comment',
            action: event === 'issues' ? 'auto-fix' : 'fix-command',
            status: 'running',
            triggeredBy: 'bot',
            isBotInitiated: true,
            logs: `Issue #${issuePayload.issue.number}: ${issuePayload.issue.title}`,
          });

          solveIssue(event, issuePayload, workspaceDir)
            .then(() => {
              if (issueRunId) {
                updateCiRun(issueRunId, { status: 'success', conclusion: 'success' });
              }
            })
            .catch((err) => {
              logger.error(`Issue solver failed:`, err);
              if (issueRunId) {
                updateCiRun(issueRunId, {
                  status: 'failure',
                  conclusion: 'failure',
                  logs: err instanceof Error ? err.message : String(err),
                });
              }
            });
        }

        // 原有的 issue_comment 重试逻辑
        if (event === 'issue_comment') {
          await handleIssueComment(payload as unknown as CommentPayload);
        }
        break;
      }

      case 'workflow_run':
        await handleWorkflowRun(payload as unknown as WorkflowPayload);
        break;

      case 'push': {
        const pushPayload = payload as unknown as PushPayload;
        const commitMsg = pushPayload.head_commit?.message?.slice(0, 80) || 'no message';
        const pushBranch = String(pushPayload.ref || '').replace('refs/heads/', '');
        logger.info(
          `[Webhook] Push to ${pushPayload.ref}: ${pushPayload.head_commit?.id?.slice(0, 7) || 'unknown'} — ${commitMsg}`
        );
        // 不记录 push 事件到 CiRun（禁止存储 GitHub Actions 记录）
        break;
      }

      case 'workflow_job': {
        const jobPayload = payload as unknown as WorkflowJobPayload;
        const job = jobPayload.workflow_job;
        logger.info(
          `[Webhook] Workflow job ${jobPayload.action}: ${job.name} — status=${job.status}, conclusion=${job.conclusion || 'pending'}`
        );
        // 不记录 workflow_job 事件到 CiRun（禁止存储 GitHub Actions 记录）
        break;
      }

      case 'installation': {
        const installPayload = payload as unknown as InstallationPayload;
        const { action, installation } = installPayload;

        if (action === 'created' || action === 'reopened') {
          logger.info(
            `[Webhook] Installation ${action}: ID=${installation.id}, account=${installation.account.login}`
          );

          // 查找管理员（取第一个管理员）
          const admin = await prisma.admin.findFirst();
          if (!admin) {
            logger.error('[Webhook] No admin found, cannot store installation');
            break;
          }

          // 检查是否已存在
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
        break;
      }

      default:
        logger.info(`Unhandled event: ${event}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
