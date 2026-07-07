import { describe, it, expect } from 'vitest';
import { evaluateRule, evaluateAllRules, findFirstMatch } from '@/lib/ci/triggers/rule-evaluator';
import { getDefaultRules } from '@/lib/ci/triggers/default-rules';
import type { TriggerRule, WebhookPayload } from '@/lib/ci/triggers/types';
import { getBotSlug } from '@/lib/ci/config';

describe('规则匹配引擎', () => {
  describe('evaluateRule - 基础匹配', () => {
    it('应该拒绝禁用的规则', () => {
      const rule: TriggerRule = {
        id: 'test',
        name: 'Test',
        enabled: false,
        events: ['push'],
        checks: [],
      };
      const payload: WebhookPayload = { event: 'push', branch: 'main' };
      const result = evaluateRule(rule, payload);
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('应该拒绝事件类型不匹配的规则', () => {
      const rule: TriggerRule = {
        id: 'test',
        name: 'Test',
        enabled: true,
        events: ['pull_request'],
        checks: [],
      };
      const payload: WebhookPayload = { event: 'push', branch: 'main' };
      const result = evaluateRule(rule, payload);
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('push');
    });
  });

  describe('evaluateRule - Push 事件', () => {
    const pushRule: TriggerRule = {
      id: 'push-ci',
      name: 'Push CI',
      enabled: true,
      events: ['push'],
      branches: { include: ['main', 'master'] },
      checks: [],
    };

    it('应该匹配 push 到 main', () => {
      const payload: WebhookPayload = { event: 'push', branch: 'main' };
      expect(evaluateRule(pushRule, payload).matched).toBe(true);
    });

    it('应该匹配 push 到 master', () => {
      const payload: WebhookPayload = { event: 'push', branch: 'master' };
      expect(evaluateRule(pushRule, payload).matched).toBe(true);
    });

    it('应该拒绝 push 到 develop', () => {
      const payload: WebhookPayload = { event: 'push', branch: 'develop' };
      const result = evaluateRule(pushRule, payload);
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('develop');
    });

    it('应该拒绝缺少分支的 push', () => {
      const payload: WebhookPayload = { event: 'push' };
      const result = evaluateRule(pushRule, payload);
      expect(result.matched).toBe(false);
    });
  });

  describe('evaluateRule - PR 事件', () => {
    const prRule: TriggerRule = {
      id: 'pr-audit',
      name: 'PR Audit',
      enabled: true,
      events: ['pull_request'],
      actions: ['opened', 'synchronize'],
      branches: { include: ['main'] },
      checks: [],
    };

    it('应该匹配 opened PR 到 main', () => {
      const payload: WebhookPayload = {
        event: 'pull_request',
        action: 'opened',
        baseBranch: 'main',
      };
      expect(evaluateRule(prRule, payload).matched).toBe(true);
    });

    it('应该匹配 synchronize PR 到 main', () => {
      const payload: WebhookPayload = {
        event: 'pull_request',
        action: 'synchronize',
        baseBranch: 'main',
      };
      expect(evaluateRule(prRule, payload).matched).toBe(true);
    });

    it('应该拒绝 closed PR', () => {
      const payload: WebhookPayload = {
        event: 'pull_request',
        action: 'closed',
        baseBranch: 'main',
      };
      const result = evaluateRule(prRule, payload);
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('closed');
    });

    it('应该拒绝到 develop 的 PR', () => {
      const payload: WebhookPayload = {
        event: 'pull_request',
        action: 'opened',
        baseBranch: 'develop',
      };
      const result = evaluateRule(prRule, payload);
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('develop');
    });
  });

  describe('evaluateRule - Issue 事件', () => {
    const issueRule: TriggerRule = {
      id: 'issue-fix',
      name: 'Issue Fix',
      enabled: true,
      events: ['issue'],
      actions: ['labeled'],
      labels: ['auto-fix'],
      checks: [],
    };

    it('应该匹配带 auto-fix 标签的 labeled 事件', () => {
      const payload: WebhookPayload = {
        event: 'issue',
        action: 'labeled',
        labels: ['auto-fix'],
      };
      expect(evaluateRule(issueRule, payload).matched).toBe(true);
    });

    it('应该拒绝没有 auto-fix 标签的 issue', () => {
      const payload: WebhookPayload = {
        event: 'issue',
        action: 'labeled',
        labels: ['bug'],
      };
      const result = evaluateRule(issueRule, payload);
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('labels');
    });

    it('应该拒绝没有标签的 issue', () => {
      const payload: WebhookPayload = {
        event: 'issue',
        action: 'labeled',
        labels: [],
      };
      const result = evaluateRule(issueRule, payload);
      expect(result.matched).toBe(false);
    });
  });

  describe('evaluateRule - Comment 事件', () => {
    const commentRule: TriggerRule = {
      id: 'auto-solver',
      name: 'Auto Solver',
      enabled: true,
      events: ['issue_comment'],
      actions: ['created'],
      requiredAuthorAssociation: ['OWNER', 'MEMBER', 'COLLABORATOR'],
      commentPattern: `^@${getBotSlug()}\\s+/fix`,
      labels: ['auto-fix'],
      checks: [],
    };

    it('应该匹配 OWNER 发送的 @{GITHUB_APP_SLUG} /fix 评论', () => {
      const payload: WebhookPayload = {
        event: 'issue_comment',
        action: 'created',
        authorAssociation: 'OWNER',
        commentBody: `@${getBotSlug()} /fix please fix this bug`,
        labels: ['auto-fix'],
      };
      expect(evaluateRule(commentRule, payload).matched).toBe(true);
    });

    it('应该匹配 MEMBER 发送的评论', () => {
      const payload: WebhookPayload = {
        event: 'issue_comment',
        action: 'created',
        authorAssociation: 'MEMBER',
        commentBody: `@${getBotSlug()} /fix`,
        labels: ['auto-fix'],
      };
      expect(evaluateRule(commentRule, payload).matched).toBe(true);
    });

    it('应该拒绝 NONE 权限用户的评论', () => {
      const payload: WebhookPayload = {
        event: 'issue_comment',
        action: 'created',
        authorAssociation: 'NONE',
        commentBody: `@${getBotSlug()} /fix`,
        labels: ['auto-fix'],
      };
      const result = evaluateRule(commentRule, payload);
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('Author association');
    });

    it('应该拒绝不匹配模式的评论', () => {
      const payload: WebhookPayload = {
        event: 'issue_comment',
        action: 'created',
        authorAssociation: 'OWNER',
        commentBody: 'hello world',
        labels: ['auto-fix'],
      };
      const result = evaluateRule(commentRule, payload);
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('pattern');
    });

    it('应该拒绝 edited 动作', () => {
      const payload: WebhookPayload = {
        event: 'issue_comment',
        action: 'edited',
        authorAssociation: 'OWNER',
        commentBody: `@${getBotSlug()} /fix`,
        labels: ['auto-fix'],
      };
      const result = evaluateRule(commentRule, payload);
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('edited');
    });
  });

  describe('evaluateRule - Schedule 事件', () => {
    const scheduleRule: TriggerRule = {
      id: 'scheduled',
      name: 'Scheduled Scan',
      enabled: true,
      events: ['schedule'],
      checks: [],
    };

    it('应该匹配 schedule 事件', () => {
      const payload: WebhookPayload = { event: 'schedule' };
      expect(evaluateRule(scheduleRule, payload).matched).toBe(true);
    });
  });

  describe('evaluateAllRules', () => {
    it('应该返回所有匹配的规则', () => {
      const payload: WebhookPayload = { event: 'push', branch: 'main' };
      const results = evaluateAllRules(getDefaultRules(), payload);
      const matched = results.filter((r) => r.matched);
      expect(matched.length).toBeGreaterThanOrEqual(2); // ci-verification + build-check
    });

    it('应该返回不匹配规则的原因', () => {
      const payload: WebhookPayload = { event: 'push', branch: 'develop' };
      const results = evaluateAllRules(getDefaultRules(), payload);
      const unmatched = results.filter((r) => !r.matched);
      expect(unmatched.length).toBeGreaterThan(0);
      expect(unmatched[0].reason).toBeDefined();
    });
  });

  describe('findFirstMatch', () => {
    it('应该返回第一条匹配的规则', () => {
      const payload: WebhookPayload = { event: 'push', branch: 'main' };
      const result = findFirstMatch(getDefaultRules(), payload);
      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('ci-verification');
    });

    it('没有匹配时应该返回 no matching rule', () => {
      const payload: WebhookPayload = { event: 'push', branch: 'develop' };
      const result = findFirstMatch(getDefaultRules(), payload);
      expect(result.matched).toBe(false);
    });
  });
});
