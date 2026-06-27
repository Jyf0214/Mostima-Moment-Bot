import { NextApiRequest, NextApiResponse } from 'next';
import { getConfig, setConfig } from '@/lib/db';
import { DEFAULT_RULES } from '@/lib/ci/triggers/default-rules';
import type { TriggerRule } from '@/lib/ci/triggers/types';
import { requireAuth } from '@/lib/auth-utils';

/**
 * 触发规则管理
 * GET  /api/ci/trigger-rules?repo=owner/repo — 获取仓库的触发规则
 * POST /api/ci/trigger-rules                — 保存仓库的触发规则
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 验证管理员身份
  const payload = await requireAuth(req, res);
  if (!payload) return;

  if (req.method === 'GET') {
    const repo = String(req.query.repo || '');
    if (!repo) {
      return res.status(400).json({ error: 'Missing repo parameter' });
    }

    try {
      // 读取仓库专属配置，没有则使用默认规则
      const configKey = `trigger_rules_${repo.replace('/', '_')}`;
      const saved = await getConfig(configKey);
      const rules: TriggerRule[] = saved ? JSON.parse(saved) : DEFAULT_RULES;

      return res.status(200).json({
        repo,
        rules,
        isCustom: !!saved,
      });
    } catch {
      return res.status(200).json({
        repo,
        rules: DEFAULT_RULES,
        isCustom: false,
      });
    }
  }

  if (req.method === 'POST') {
    const { repo, rules } = req.body;

    if (!repo || typeof repo !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid repo' });
    }

    if (!Array.isArray(rules)) {
      return res.status(400).json({ error: 'rules must be an array' });
    }

    // 验证每条规则的结构
    for (const rule of rules) {
      if (
        !rule.id ||
        !rule.name ||
        typeof rule.enabled !== 'boolean' ||
        !Array.isArray(rule.events)
      ) {
        return res.status(400).json({ error: `Invalid rule structure: ${JSON.stringify(rule)}` });
      }
      // 验证 events 值
      const validEvents = [
        'push',
        'pull_request',
        'issue',
        'issue_comment',
        'schedule',
        'workflow_dispatch',
      ];
      for (const event of rule.events) {
        if (!validEvents.includes(event)) {
          return res.status(400).json({ error: `Invalid event type: ${event}` });
        }
      }
    }

    try {
      const configKey = `trigger_rules_${repo.replace('/', '_')}`;
      await setConfig(configKey, JSON.stringify(rules), true);

      return res.status(200).json({
        success: true,
        message: `Trigger rules saved for ${repo}`,
        rulesCount: rules.length,
      });
    } catch (error) {
      return res.status(500).json({
        error: `Failed to save trigger rules: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
