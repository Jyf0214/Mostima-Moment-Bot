import { Router, Request, Response } from 'express';
import { verifyWebhookSignature } from '../lib/github/webhook';
import { handlePullRequest, handleIssueComment, handleWorkflowRun } from '../lib/ci/runner';

export const webhookRouter = Router();

/**
 * GitHub Webhook 接收端
 */
webhookRouter.post('/github', async (req: Request, res: Response) => {
  // 1. 验证签名
  const signature = req.headers['x-hub-signature-256'] as string;
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    console.error('WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!req.rawBody || !verifyWebhookSignature(req.rawBody, signature, secret)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. 解析事件
  const event = req.headers['x-github-event'] as string;
  const payload = req.body;

  console.log(`Received GitHub event: ${event}`);

  // 3. 事件路由
  try {
    switch (event) {
      case 'pull_request':
        await handlePullRequest(payload);
        break;
      case 'issue_comment':
        await handleIssueComment(payload);
        break;
      case 'workflow_run':
        await handleWorkflowRun(payload);
        break;
      default:
        console.log(`Unhandled event: ${event}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
