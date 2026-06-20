import { describe, it, expect } from 'vitest';
import { normalizePayload, matchWebhook, matchWebhookFirst } from '@/lib/ci/triggers/index';
import { DEFAULT_RULES } from '@/lib/ci/triggers/default-rules';
import { getBotSlug } from '@/lib/ci/config';

describe('Webhook 载荷标准化与匹配', () => {
  describe('normalizePayload', () => {
    it('应该正确标准化 push 载荷', () => {
      const payload = {
        ref: 'refs/heads/main',
        after: 'abc123def456',
        pusher: { name: 'Jyf0214' },
        repository: { full_name: 'Jyf0214/Mostima-Moment-Bot' },
      };
      const result = normalizePayload('push', payload);
      expect(result.event).toBe('push');
      expect(result.branch).toBe('main');
      expect(result.commitSha).toBe('abc123def456');
      expect(result.author).toBe('Jyf0214');
      expect(result.repository).toBe('Jyf0214/Mostima-Moment-Bot');
    });

    it('应该正确标准化 PR 载荷', () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 42,
          head: { ref: 'feature/login', sha: 'sha123' },
          base: { ref: 'main' },
          user: { login: 'Jyf0214' },
        },
        repository: { full_name: 'Jyf0214/Mostima-Moment-Bot' },
      };
      const result = normalizePayload('pull_request', payload);
      expect(result.event).toBe('pull_request');
      expect(result.action).toBe('opened');
      expect(result.branch).toBe('feature/login');
      expect(result.baseBranch).toBe('main');
      expect(result.prNumber).toBe(42);
      expect(result.author).toBe('Jyf0214');
    });

    it('应该正确标准化 Issue 载荷', () => {
      const payload = {
        action: 'labeled',
        issue: {
          number: 10,
          user: { login: 'user1' },
          author_association: 'MEMBER',
          labels: [{ name: 'auto-fix' }, { name: 'bug' }],
        },
        repository: { full_name: 'Jyf0214/Mostima-Moment-Bot' },
      };
      const result = normalizePayload('issue', payload);
      expect(result.event).toBe('issue');
      expect(result.action).toBe('labeled');
      expect(result.issueNumber).toBe(10);
      expect(result.labels).toEqual(['auto-fix', 'bug']);
      expect(result.authorAssociation).toBe('MEMBER');
    });

    it('应该正确标准化 Issue Comment 载荷', () => {
      const payload = {
        action: 'created',
        issue: {
          number: 10,
          labels: [{ name: 'auto-fix' }],
        },
        comment: {
          user: { login: 'owner1' },
          author_association: 'OWNER',
          body: `@${getBotSlug()} /fix please help`,
        },
        repository: { full_name: 'Jyf0214/Mostima-Moment-Bot' },
      };
      const result = normalizePayload('issue_comment', payload);
      expect(result.event).toBe('issue_comment');
      expect(result.action).toBe('created');
      expect(result.issueNumber).toBe(10);
      expect(result.commentBody).toBe(`@${getBotSlug()} /fix please help`);
      expect(result.authorAssociation).toBe('OWNER');
      expect(result.labels).toEqual(['auto-fix']);
    });

    it('应该截断过长的评论内容', () => {
      const payload = {
        action: 'created',
        issue: { number: 1, labels: [] },
        comment: {
          user: { login: 'user' },
          body: 'x'.repeat(20000),
        },
      };
      const result = normalizePayload('issue_comment', payload);
      expect(result.commentBody!.length).toBeLessThanOrEqual(10000);
    });

    it('应该清理标签中的危险字符', () => {
      const payload = {
        action: 'labeled',
        issue: {
          number: 1,
          user: { login: 'user' },
          labels: [{ name: 'valid-label' }, { name: 'x'.repeat(200) }],
        },
      };
      const result = normalizePayload('issue', payload);
      expect(result.labels).toEqual(['valid-label']);
    });

    it('未知事件类型应该返回基本载荷', () => {
      const result = normalizePayload('unknown_event', {});
      expect(result.event).toBe('unknown_event');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('matchWebhook', () => {
    it('应该匹配 push 到 main 的 CI 验证规则', () => {
      const payload = {
        ref: 'refs/heads/main',
        after: 'abc123',
        pusher: { name: 'Jyf0214' },
        repository: { full_name: 'Jyf0214/Mostima-Moment-Bot' },
      };
      const results = matchWebhook(DEFAULT_RULES, 'push', payload);
      const matched = results.filter((r) => r.matched);
      expect(matched.length).toBeGreaterThanOrEqual(2);
      expect(matched.some((r) => r.rule?.id === 'ci-verification')).toBe(true);
      expect(matched.some((r) => r.rule?.id === 'build-check')).toBe(true);
    });

    it('应该匹配 PR opened 的安全审计规则', () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 42,
          head: { ref: 'feature/x', sha: 'sha123' },
          base: { ref: 'main' },
          user: { login: 'user' },
        },
        repository: { full_name: 'Jyf0214/Mostima-Moment-Bot' },
      };
      const results = matchWebhook(DEFAULT_RULES, 'pull_request', payload);
      const matched = results.filter((r) => r.matched);
      expect(matched.some((r) => r.rule?.id === 'security-audit')).toBe(true);
    });

    it('应该匹配 Issue labeled auto-fix 的自动修复规则', () => {
      const payload = {
        action: 'labeled',
        issue: {
          number: 5,
          user: { login: 'user' },
          labels: [{ name: 'auto-fix' }],
        },
        repository: { full_name: 'Jyf0214/Mostima-Moment-Bot' },
      };
      const results = matchWebhook(DEFAULT_RULES, 'issue', payload);
      const matched = results.filter((r) => r.matched);
      expect(matched.some((r) => r.rule?.id === 'auto-fix')).toBe(true);
    });

    it('应该拒绝不匹配的 webhook', () => {
      const payload = {
        ref: 'refs/heads/feature/x',
        after: 'abc123',
        pusher: { name: 'user' },
        repository: { full_name: 'Jyf0214/Mostima-Moment-Bot' },
      };
      const results = matchWebhook(DEFAULT_RULES, 'push', payload);
      const matched = results.filter((r) => r.matched);
      expect(matched.length).toBe(0);
    });
  });

  describe('matchWebhookFirst', () => {
    it('应该返回第一条匹配规则', () => {
      const payload = {
        ref: 'refs/heads/main',
        after: 'abc123',
        pusher: { name: 'Jyf0214' },
        repository: { full_name: 'Jyf0214/Mostima-Moment-Bot' },
      };
      const result = matchWebhookFirst(DEFAULT_RULES, 'push', payload);
      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('ci-verification');
    });

    it('没有匹配时应该返回 no matching rule', () => {
      const payload = { ref: 'refs/heads/feature/x' };
      const result = matchWebhookFirst(DEFAULT_RULES, 'push', payload);
      expect(result.matched).toBe(false);
    });
  });
});
