import { NextApiRequest, NextApiResponse } from 'next';
import { verifyWebhookSignature } from '@/lib/github/webhook';
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
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    console.error('WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error: WEBHOOK_SECRET missing' });
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

      default:
        console.log(`Unhandled event: ${event}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
