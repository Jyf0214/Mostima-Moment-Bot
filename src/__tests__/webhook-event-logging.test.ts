import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockPrisma, mockRecordCiRun, mockUpdateCiRun } = vi.hoisted(() => ({
  mockPrisma: {
    admin: { findFirst: vi.fn() },
    gitHubInstallation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  mockRecordCiRun: vi.fn(),
  mockUpdateCiRun: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/ci/run-logger', () => ({
  recordCiRun: mockRecordCiRun,
  updateCiRun: mockUpdateCiRun,
}));
vi.mock('@/lib/github/webhook', () => ({
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/ci/runner', () => ({
  handlePullRequest: vi.fn().mockResolvedValue(undefined),
  handleIssueComment: vi.fn().mockResolvedValue(undefined),
  handleWorkflowRun: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/ci/issue-solver', () => ({
  shouldTriggerIssueFix: vi.fn().mockReturnValue(false),
  solveIssue: vi.fn(),
}));
vi.mock('@/lib/ci/security-auditor', () => ({
  auditPR: vi.fn().mockResolvedValue(undefined),
}));

import handler from '@/pages/api/webhook/github';

function createWebhookRequest(event: string, payload: unknown) {
  const body = JSON.stringify(payload);
  return {
    method: 'POST',
    headers: {
      'x-github-event': event,
      'x-hub-signature-256': 'sha256=test',
      'content-type': 'application/json',
    },
    body,
    cookies: {},
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(body);
    },
  } as any;
}

function createMockResponse() {
  let statusCode = 200;
  let responseData: unknown = null;

  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: unknown) => {
      responseData = data;
      return res;
    },
    _getStatusCode: () => statusCode,
    _getData: () => JSON.stringify(responseData),
  } as any;

  return res;
}

describe('Webhook 事件日志记录', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordCiRun.mockResolvedValue(1);
    mockUpdateCiRun.mockResolvedValue(undefined);
  });

  describe('push 事件日志', () => {
    it('应该为 push 事件创建运行日志', async () => {
      const pushPayload = {
        ref: 'refs/heads/main',
        head_commit: { id: 'abc123def456', message: 'feat: new feature' },
        pusher: { name: 'testuser' },
        repository: { full_name: 'owner/repo' },
      };

      const req = createWebhookRequest('push', pushPayload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockRecordCiRun).toHaveBeenCalledTimes(1);

      const callArgs = mockRecordCiRun.mock.calls[0][0];
      expect(callArgs.repo).toBe('owner/repo');
      expect(callArgs.event).toBe('push');
      expect(callArgs.branch).toBe('main');
      expect(callArgs.commitSha).toBe('abc123def456');
      expect(callArgs.status).toBe('success');
      expect(callArgs.triggeredBy).toBe('testuser');
      expect(callArgs.logs).toBe('feat: new feature');
    });

    it('push 事件 head_commit 为 null 时应安全处理', async () => {
      const pushPayload = {
        ref: 'refs/heads/feature',
        head_commit: null,
        pusher: { name: 'testuser' },
        repository: { full_name: 'owner/repo' },
      };

      const req = createWebhookRequest('push', pushPayload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const callArgs = mockRecordCiRun.mock.calls[0][0];
      expect(callArgs.branch).toBe('feature');
      expect(callArgs.commitSha).toBeUndefined();
      expect(callArgs.logs).toBe('no message');
    });

    it('push 事件应去除 refs/heads/ 前缀', async () => {
      const pushPayload = {
        ref: 'refs/heads/develop',
        head_commit: { id: 'abc123', message: 'update' },
        pusher: { name: 'user' },
        repository: { full_name: 'owner/repo' },
      };

      const req = createWebhookRequest('push', pushPayload);
      const res = createMockResponse();

      await handler(req, res);

      const callArgs = mockRecordCiRun.mock.calls[0][0];
      expect(callArgs.branch).toBe('develop');
    });
  });

  describe('workflow_job 事件日志', () => {
    it('应该为已完成的 workflow_job 创建运行日志', async () => {
      const jobPayload = {
        action: 'completed',
        workflow_job: {
          id: 123,
          name: 'ci-build',
          status: 'completed',
          conclusion: 'success',
        },
        repository: { full_name: 'owner/repo' },
      };

      const req = createWebhookRequest('workflow_job', jobPayload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockRecordCiRun).toHaveBeenCalledTimes(1);

      const callArgs = mockRecordCiRun.mock.calls[0][0];
      expect(callArgs.repo).toBe('owner/repo');
      expect(callArgs.event).toBe('workflow_job');
      expect(callArgs.action).toBe('completed');
      expect(callArgs.status).toBe('success');
      expect(callArgs.conclusion).toBe('success');
      expect(callArgs.logs).toContain('ci-build');
    });

    it('失败的 workflow_job 应记录 failure 状态', async () => {
      const jobPayload = {
        action: 'completed',
        workflow_job: {
          id: 456,
          name: 'test',
          status: 'completed',
          conclusion: 'failure',
        },
        repository: { full_name: 'owner/repo' },
      };

      const req = createWebhookRequest('workflow_job', jobPayload);
      const res = createMockResponse();

      await handler(req, res);

      const callArgs = mockRecordCiRun.mock.calls[0][0];
      expect(callArgs.status).toBe('failure');
      expect(callArgs.conclusion).toBe('failure');
    });

    it('in_progress 状态的 workflow_job 不应创建日志', async () => {
      const jobPayload = {
        action: 'in_progress',
        workflow_job: {
          id: 789,
          name: 'deploy',
          status: 'in_progress',
          conclusion: null,
        },
        repository: { full_name: 'owner/repo' },
      };

      const req = createWebhookRequest('workflow_job', jobPayload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockRecordCiRun).not.toHaveBeenCalled();
    });

    it('pending 状态的 workflow_job 不应创建日志', async () => {
      const jobPayload = {
        action: 'queued',
        workflow_job: {
          id: 101,
          name: 'lint',
          status: 'pending',
          conclusion: null,
        },
        repository: { full_name: 'owner/repo' },
      };

      const req = createWebhookRequest('workflow_job', jobPayload);
      const res = createMockResponse();

      await handler(req, res);

      expect(mockRecordCiRun).not.toHaveBeenCalled();
    });
  });

  describe('PR 事件日志', () => {
    it('PR 事件应创建 running 状态日志', async () => {
      const prPayload = {
        action: 'opened',
        pull_request: {
          number: 42,
          head: { sha: 'abc123', ref: 'feature/test' },
          base: { ref: 'main' },
        },
        repository: { full_name: 'owner/repo' },
        sender: { login: 'testuser' },
      };

      const req = createWebhookRequest('pull_request', prPayload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockRecordCiRun).toHaveBeenCalledTimes(1);

      const callArgs = mockRecordCiRun.mock.calls[0][0];
      expect(callArgs.repo).toBe('owner/repo');
      expect(callArgs.event).toBe('pull_request');
      expect(callArgs.action).toBe('opened');
      expect(callArgs.branch).toBe('feature/test');
      expect(callArgs.commitSha).toBe('abc123');
      expect(callArgs.prNumber).toBe(42);
      expect(callArgs.status).toBe('running');
      expect(callArgs.triggeredBy).toBe('testuser');
    });
  });

  describe('未处理事件', () => {
    it('未处理的事件类型应返回 200 但不创建日志', async () => {
      const req = createWebhookRequest('ping', { zen: 'test' });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockRecordCiRun).not.toHaveBeenCalled();
    });
  });
});
