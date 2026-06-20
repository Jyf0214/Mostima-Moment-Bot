import { describe, it, expect, beforeEach } from 'vitest';
import { ConcurrencyManager, renderConcurrencyGroup } from '@/lib/ci/triggers/concurrency';

describe('并发控制', () => {
  describe('renderConcurrencyGroup', () => {
    it('应该替换 {{event}} 占位符', () => {
      const result = renderConcurrencyGroup('{{event}}-ci', { event: 'push' });
      expect(result).toBe('push-ci');
    });

    it('应该替换多个占位符', () => {
      const result = renderConcurrencyGroup('{{event}}-{{ref}}', {
        event: 'pull_request',
        ref: 'main',
      });
      expect(result).toBe('pull_request-main');
    });

    it('应该替换 {{pr_number}} 占位符', () => {
      const result = renderConcurrencyGroup('audit-pr-{{pr_number}}', { pr_number: 42 });
      expect(result).toBe('audit-pr-42');
    });

    it('未定义的变量应该替换为 unknown', () => {
      const result = renderConcurrencyGroup('{{event}}-{{unknown}}', { event: 'push' });
      expect(result).toBe('push-unknown');
    });

    it('应该 sanitize 替换值中的特殊字符', () => {
      const result = renderConcurrencyGroup('{{ref}}', { ref: 'feature/my-branch' });
      expect(result).toBe('feature/my-branch');
    });

    it('空模板应该返回 default', () => {
      expect(renderConcurrencyGroup('', {})).toBe('default');
    });

    it('过长模板应该返回 default', () => {
      expect(renderConcurrencyGroup('a'.repeat(300), {})).toBe('default');
    });

    it('注入攻击应该被 sanitize', () => {
      const result = renderConcurrencyGroup('{{event}}', { event: '<script>alert(1)</script>' });
      // < → _, > → _, ( → _, ) → _, < → _, / → /, > → _
      expect(result).toBe('_script_alert_1__/script_');
    });
  });

  describe('ConcurrencyManager', () => {
    let manager: ConcurrencyManager;

    beforeEach(() => {
      manager = new ConcurrencyManager();
    });

    it('新并发组应该被允许', () => {
      const result = manager.check(
        { group: 'ci-{{event}}', cancelInProgress: false },
        'ci-push',
        'run-1'
      );
      expect(result.allowed).toBe(true);
      expect(result.cancelledPrevious).toBeUndefined();
    });

    it('cancelInProgress=false 时相同组的第二个运行应该被拒绝', () => {
      manager.check({ group: 'ci-{{event}}', cancelInProgress: false }, 'ci-push', 'run-1');
      const result = manager.check(
        { group: 'ci-{{event}}', cancelInProgress: false },
        'ci-push',
        'run-2'
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('run-1');
    });

    it('cancelInProgress=true 时应该取消旧运行', () => {
      manager.check({ group: 'ci-{{event}}', cancelInProgress: true }, 'ci-push', 'run-1');
      const result = manager.check(
        { group: 'ci-{{event}}', cancelInProgress: true },
        'ci-push',
        'run-2'
      );
      expect(result.allowed).toBe(true);
      expect(result.cancelledPrevious).toBe(true);
    });

    it('complete 后应该允许新运行', () => {
      manager.check({ group: 'ci-{{event}}', cancelInProgress: false }, 'ci-push', 'run-1');
      manager.complete('ci-push', 'run-1');
      const result = manager.check(
        { group: 'ci-{{event}}', cancelInProgress: false },
        'ci-push',
        'run-2'
      );
      expect(result.allowed).toBe(true);
    });

    it('complete 应该只移除匹配的 runId', () => {
      manager.check({ group: 'ci-{{event}}', cancelInProgress: false }, 'ci-push', 'run-1');
      manager.complete('ci-push', 'wrong-run-id');
      const result = manager.check(
        { group: 'ci-{{event}}', cancelInProgress: false },
        'ci-push',
        'run-2'
      );
      expect(result.allowed).toBe(false);
    });

    it('应该拒绝不安全的 group key', () => {
      const result = manager.check(
        { group: 'test', cancelInProgress: false },
        '../../etc/passwd',
        'run-1'
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('unsafe');
    });

    it('getSignal 应该返回 AbortSignal', () => {
      manager.check({ group: 'ci-{{event}}', cancelInProgress: false }, 'ci-push', 'run-1');
      const signal = manager.getSignal('ci-push');
      expect(signal).toBeDefined();
      expect(signal?.aborted).toBe(false);
    });

    it('cancelInProgress=true 时旧信号应该被 abort', () => {
      manager.check({ group: 'ci-{{event}}', cancelInProgress: true }, 'ci-push', 'run-1');
      const oldSignal = manager.getSignal('ci-push');

      manager.check({ group: 'ci-{{event}}', cancelInProgress: true }, 'ci-push', 'run-2');
      expect(oldSignal?.aborted).toBe(true);
    });

    it('getActiveCount 应该返回正确的组数', () => {
      expect(manager.getActiveCount()).toBe(0);
      manager.check({ group: 'a', cancelInProgress: false }, 'a', 'run-1');
      expect(manager.getActiveCount()).toBe(1);
      manager.check({ group: 'b', cancelInProgress: false }, 'b', 'run-2');
      expect(manager.getActiveCount()).toBe(2);
      manager.complete('a', 'run-1');
      expect(manager.getActiveCount()).toBe(1);
    });

    it('clear 应该清空所有组', () => {
      manager.check({ group: 'a', cancelInProgress: false }, 'a', 'run-1');
      manager.check({ group: 'b', cancelInProgress: false }, 'b', 'run-2');
      manager.clear();
      expect(manager.getActiveCount()).toBe(0);
    });
  });
});
