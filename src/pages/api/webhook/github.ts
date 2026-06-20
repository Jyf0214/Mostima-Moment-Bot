import { NextApiRequest, NextApiResponse } from 'next';
import { verifyWebhookSignature } from '@/lib/github/webhook';
import { prisma } from '@/lib/prisma';
import {
  handlePullRequest,
  handleIssueComment,
  handleWorkflowRun,
  type PRPayload,
  type CommentPayload,
  type WorkflowPayload,
} from '@/lib/ci/runner';
import { shouldTriggerIssueFix, solveIssue } from '@/lib/ci/issue-solver';
import { auditPR } from '@/lib/ci/security-auditor';

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
  const secret = process.env.WEBHOOK_SECRET || process.env.ENCRYPTION_KEY;

  if (!secret) {
    console.error('Neither WEBHOOK_SECRET nor ENCRYPTION_KEY is configured');
    return res
      .status(500)
      .json({ error: 'Server configuration error: no webhook secret available' });
  }

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. 解析事件
  const event = req.headers['x-github-event'] as string;
  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  console.log(`Received GitHub event: ${event}`);

  const workspaceDir = process.env.WORKSPACE_DIR || '.';

  // 3. 事件路由
  try {
    switch (event) {
      case 'pull_request': {
        const prPayload = payload as unknown as PREventPayload;
        await handlePullRequest(prPayload as unknown as PRPayload);

        // PR 安全审计（opened / synchronize）
        if (prPayload.action === 'opened' || prPayload.action === 'synchronize') {
          const prNumber = prPayload.pull_request.number;
          const baseBranch = prPayload.pull_request.base.ref;
          const headSha = prPayload.pull_request.head.sha;

          auditPR(prNumber, baseBranch, headSha, workspaceDir).catch((err) => {
            console.error(`Security audit failed for PR #${prNumber}:`, err);
          });
        }
        break;
      }

      case 'issues':
      case 'issue_comment': {
        const issuePayload = payload as unknown as IssueEventPayload;

        // Issue 自动修复
        if (shouldTriggerIssueFix(event, issuePayload)) {
          console.log(`[Webhook] Issue auto-fix triggered for Issue #${issuePayload.issue.number}`);
          solveIssue(event, issuePayload, workspaceDir).catch((err) => {
            console.error(`Issue solver failed:`, err);
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
        console.log(
          `[Webhook] Push to ${pushPayload.ref}: ${pushPayload.head_commit?.id?.slice(0, 7) || 'unknown'} — ${commitMsg}`
        );
        break;
      }

      case 'workflow_job': {
        const jobPayload = payload as unknown as WorkflowJobPayload;
        const job = jobPayload.workflow_job;
        console.log(
          `[Webhook] Workflow job ${jobPayload.action}: ${job.name} — status=${job.status}, conclusion=${job.conclusion || 'pending'}`
        );
        break;
      }

      case 'installation': {
        const installPayload = payload as unknown as InstallationPayload;
        const { action, installation } = installPayload;

        if (action === 'created' || action === 'reopened') {
          console.log(
            `[Webhook] Installation ${action}: ID=${installation.id}, account=${installation.account.login}`
          );

          // 查找管理员（取第一个管理员）
          const admin = await prisma.admin.findFirst();
          if (!admin) {
            console.error('[Webhook] No admin found, cannot store installation');
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
          console.log(`[Webhook] Installation record saved: ${installation.account.login}`);
        } else if (action === 'deleted' || action === 'suspend') {
          console.log(`[Webhook] Installation ${action}: ID=${installation.id}`);
          await prisma.gitHubInstallation.updateMany({
            where: { installationId: installation.id },
            data: { isActive: false },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
