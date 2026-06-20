import { NextApiRequest, NextApiResponse } from 'next';
import { verifyWebhookSignature } from '@/lib/github/webhook';
import { handlePullRequest, handleIssueComment, handleWorkflowRun } from '@/lib/ci/runner';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. 解析事件
  const event = req.headers['x-github-event'] as string;
  let payload: any;

  try {
    payload = JSON.parse(rawBody.toString());
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

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

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
