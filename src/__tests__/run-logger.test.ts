import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    ciRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

// 必须在 mock 之后导入
import { recordCiRun, updateCiRun } from '@/lib/ci/run-logger';

describe('RunLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recordCiRun', () => {
    it('应该创建运行记录并返回 ID', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 42 });

      const id = await recordCiRun({
        repo: 'owner/repo',
        event: 'pull_request',
        action: 'opened',
        branch: 'feature/test',
        commitSha: 'abc123',
        prNumber: 1,
        status: 'running',
        triggeredBy: 'testuser',
      });

      expect(id).toBe(42);
      expect(mockPrisma.ciRun.create).toHaveBeenCalledTimes(1);

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.repoFullName).toBe('owner/repo');
      expect(callData.data.event).toBe('pull_request');
      expect(callData.data.action).toBe('opened');
      expect(callData.data.branch).toBe('feature/test');
      expect(callData.data.commitSha).toBe('abc123');
      expect(callData.data.prNumber).toBe(1);
      expect(callData.data.status).toBe('running');
      expect(callData.data.triggeredBy).toBe('testuser');
      expect(callData.data.startedAt).toBeInstanceOf(Date);
      expect(callData.data.completedAt).toBeNull();
    });

    it('应该截断超长 repo 名称到 255 字符', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const longRepo = 'a'.repeat(300);
      await recordCiRun({ repo: longRepo, event: 'push' });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.repoFullName).toHaveLength(255);
    });

    it('应该截断超长 branch 名称到 255 字符', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const longBranch = 'b'.repeat(300);
      await recordCiRun({ repo: 'repo', event: 'push', branch: longBranch });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.branch).toHaveLength(255);
    });

    it('应该截断超长 commitSha 到 40 字符', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const longSha = 'c'.repeat(64);
      await recordCiRun({ repo: 'repo', event: 'push', commitSha: longSha });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.commitSha).toHaveLength(40);
    });

    it('应该截断超长 triggeredBy 到 100 字符', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const longUser = 'u'.repeat(200);
      await recordCiRun({ repo: 'repo', event: 'push', triggeredBy: longUser });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.triggeredBy).toHaveLength(100);
    });

    it('应该截断超长日志到 50000 字符', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const longLogs = 'x'.repeat(60000);
      await recordCiRun({ repo: 'repo', event: 'push', logs: longLogs });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.logs).toHaveLength(50000);
    });

    it('success 状态应设置 completedAt', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      await recordCiRun({ repo: 'repo', event: 'push', status: 'success' });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.completedAt).toBeInstanceOf(Date);
      expect(callData.data.startedAt).toBeNull();
    });

    it('failure 状态应设置 completedAt', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      await recordCiRun({ repo: 'repo', event: 'push', status: 'failure' });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.completedAt).toBeInstanceOf(Date);
    });

    it('cancelled 状态应设置 completedAt', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      await recordCiRun({ repo: 'repo', event: 'push', status: 'cancelled' });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.completedAt).toBeInstanceOf(Date);
    });

    it('pending 状态不应设置 startedAt 和 completedAt', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      await recordCiRun({ repo: 'repo', event: 'push', status: 'pending' });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.startedAt).toBeNull();
      expect(callData.data.completedAt).toBeNull();
    });

    it('应正确传递 duration 参数', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      await recordCiRun({ repo: 'repo', event: 'push', duration: 1500 });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.duration).toBe(1500);
    });

    it('应正确传递 checksRan 数组', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      await recordCiRun({
        repo: 'repo',
        event: 'pull_request',
        checksRan: ['lint', 'typecheck', 'build'],
      });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.checksRan).toEqual(['lint', 'typecheck', 'build']);
    });

    it('数据库错误时应返回 null 而非抛出', async () => {
      mockPrisma.ciRun.create.mockRejectedValue(new Error('DB connection failed'));

      const id = await recordCiRun({ repo: 'repo', event: 'push' });

      expect(id).toBeNull();
    });

    it('可选参数缺失时应使用默认值', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      await recordCiRun({ repo: 'repo', event: 'push' });

      const callData = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(callData.data.action).toBeNull();
      expect(callData.data.branch).toBeNull();
      expect(callData.data.commitSha).toBeNull();
      expect(callData.data.prNumber).toBeNull();
      expect(callData.data.conclusion).toBeNull();
      expect(callData.data.triggeredBy).toBeNull();
      expect(callData.data.ruleId).toBeNull();
      expect(callData.data.checksRan).toEqual([]);
      expect(callData.data.logs).toBeNull();
      expect(callData.data.duration).toBeNull();
    });
  });

  describe('updateCiRun', () => {
    it('应该更新状态并设置 completedAt', async () => {
      mockPrisma.ciRun.update.mockResolvedValue({});

      await updateCiRun(42, { status: 'success', conclusion: 'success' });

      expect(mockPrisma.ciRun.update).toHaveBeenCalledTimes(1);
      const callData = mockPrisma.ciRun.update.mock.calls[0][0];
      expect(callData.where).toEqual({ id: 42 });
      expect(callData.data.status).toBe('success');
      expect(callData.data.conclusion).toBe('success');
      expect(callData.data.completedAt).toBeInstanceOf(Date);
    });

    it('failure 状态应设置 completedAt', async () => {
      mockPrisma.ciRun.update.mockResolvedValue({});

      await updateCiRun(1, { status: 'failure' });

      const callData = mockPrisma.ciRun.update.mock.calls[0][0];
      expect(callData.data.completedAt).toBeInstanceOf(Date);
    });

    it('running 状态不应设置 completedAt', async () => {
      mockPrisma.ciRun.update.mockResolvedValue({});

      await updateCiRun(1, { status: 'running' });

      const callData = mockPrisma.ciRun.update.mock.calls[0][0];
      expect(callData.data.completedAt).toBeUndefined();
    });

    it('应正确更新日志并截断', async () => {
      mockPrisma.ciRun.update.mockResolvedValue({});

      const longLogs = 'x'.repeat(60000);
      await updateCiRun(1, { logs: longLogs });

      const callData = mockPrisma.ciRun.update.mock.calls[0][0];
      expect(callData.data.logs).toHaveLength(50000);
    });

    it('应正确更新 duration', async () => {
      mockPrisma.ciRun.update.mockResolvedValue({});

      await updateCiRun(1, { duration: 3500 });

      const callData = mockPrisma.ciRun.update.mock.calls[0][0];
      expect(callData.data.duration).toBe(3500);
    });

    it('应正确更新 checksRan', async () => {
      mockPrisma.ciRun.update.mockResolvedValue({});

      await updateCiRun(1, { checksRan: ['lint', 'build'] });

      const callData = mockPrisma.ciRun.update.mock.calls[0][0];
      expect(callData.data.checksRan).toEqual(['lint', 'build']);
    });

    it('数据库错误时应静默失败不抛出', async () => {
      mockPrisma.ciRun.update.mockRejectedValue(new Error('DB error'));

      // 不应抛出
      await expect(updateCiRun(1, { status: 'success' })).resolves.toBeUndefined();
    });

    it('只传 status 不传其他字段时应只更新 status', async () => {
      mockPrisma.ciRun.update.mockResolvedValue({});

      await updateCiRun(1, { status: 'success' });

      const callData = mockPrisma.ciRun.update.mock.calls[0][0];
      expect(callData.data).toHaveProperty('status');
      expect(callData.data).toHaveProperty('completedAt');
      expect(callData.data).not.toHaveProperty('conclusion');
      expect(callData.data).not.toHaveProperty('logs');
      expect(callData.data).not.toHaveProperty('duration');
    });
  });
});
