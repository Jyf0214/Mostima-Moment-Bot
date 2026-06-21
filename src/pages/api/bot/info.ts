import { NextApiRequest, NextApiResponse } from 'next';

/**
 * 机器人信息
 * GET /api/bot/info
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = process.env.GITHUB_APP_SLUG || '';
  const appId = process.env.GITHUB_APP_ID || '';

  return res.status(200).json({
    slug,
    appId,
    mention: slug ? `@${slug}` : '',
    fixCommand: slug ? `@${slug} /fix` : '',
    installUrl: slug ? `https://github.com/apps/${slug}/installations/new` : '',
  });
}
