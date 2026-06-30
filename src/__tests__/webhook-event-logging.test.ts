import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from './helpers';

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
  return createMockReq({
    method: 'POST',
    headers: {
      'x-github-event': event,
      'x-hub-signature-256': 'sha256=test',
      'content-type': 'application/json',
    },
    body: payload as Record<string, unknown>,
  });
}

function createMockResponse() {
  return createMockRes();
}

describe('Webhook 事件日志记录', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordCiRun.mockResolvedValue(1);
    mockUpdateCiRun.mockResolvedValue(undefined);
  });

  describe('push 事件', () => {
    it('push 事件不应创建 CiRun 记录（禁止存储 GitHub Actions 记录）', async () => {
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
      expect(mockRecordCiRun).not.toHaveBeenCalled();
    });

    it('push 事件应安全处理', async () => {
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
      expect(mockRecordCiRun).not.toHaveBeenCalled();
    });
  });

  describe('workflow_job 事件', () => {
    it('workflow_job 事件不应创建 CiRun 记录（禁止存储 GitHub Actions 记录）', async () => {
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
      expect(mockRecordCiRun).not.toHaveBeenCalled();
    });

    it('失败的 workflow_job 也不应创建日志', async () => {
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

      expect(mockRecordCiRun).not.toHaveBeenCalled();
    });
  });

  describe('PR 事件日志', () => {
    it('PR 事件应只创建安全审计日志（bot 触发）', async () => {
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
      // PR opened 事件只记录 1 条：安全审计（bot 触发）
      expect(mockRecordCiRun).toHaveBeenCalledTimes(1);

      const auditCallArgs = mockRecordCiRun.mock.calls[0][0];
      expect(auditCallArgs.repo).toBe('owner/repo');
      expect(auditCallArgs.event).toBe('security_audit');
      expect(auditCallArgs.isBotInitiated).toBe(true);
      expect(auditCallArgs.triggeredBy).toBe('bot');
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
