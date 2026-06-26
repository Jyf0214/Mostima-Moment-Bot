import { NextApiRequest, NextApiResponse } from 'next';
import { resolveBotSlug } from '@/lib/ci/config';

/**
 * 机器人信息
 * GET /api/bot/info
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = await resolveBotSlug();
  const appId = process.env.GITHUB_APP_ID || '';

  return res.status(200).json({
    slug,
    appId,
    mention: slug ? `@${slug}` : '',
    fixCommand: slug ? `@${slug} /fix` : '',
    installUrl: slug ? `https://github.com/apps/${slug}/installations/new` : '',
  });
}
