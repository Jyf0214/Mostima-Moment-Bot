import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    admin: {
      findFirst: vi.fn(),
    },
    gitHubInstallation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/github/webhook', () => ({
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/ci/run-logger', () => ({
  recordCiRun: vi.fn().mockResolvedValue(1),
  updateCiRun: vi.fn().mockResolvedValue(undefined),
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

describe('Webhook Installation 事件处理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('installation 事件 — created', () => {
    it('应该在 created 事件时创建安装记录（通过实际 handler）', async () => {
      const mockAdmin = { id: 1, githubId: 12345, githubLogin: 'admin' };
      mockPrisma.admin.findFirst.mockResolvedValue(mockAdmin);
      mockPrisma.gitHubInstallation.findUnique.mockResolvedValue(null);
      mockPrisma.gitHubInstallation.create.mockResolvedValue({
        id: 1,
        installationId: 141528128,
        accountLogin: 'Jyf0214',
        accountType: 'User',
        accountId: 12345,
        avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
        adminId: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const payload = {
        action: 'created',
        installation: {
          id: 141528128,
          account: {
            login: 'Jyf0214',
            id: 12345,
            type: 'User',
            avatar_url: 'https://avatars.githubusercontent.com/u/12345',
          },
        },
      };

      const req = createWebhookRequest('installation', payload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockPrisma.admin.findFirst).toHaveBeenCalled();
      expect(mockPrisma.gitHubInstallation.findUnique).toHaveBeenCalledWith({
        where: { installationId: 141528128 },
      });
      expect(mockPrisma.gitHubInstallation.create).toHaveBeenCalledWith({
        data: {
          installationId: 141528128,
          accountLogin: 'Jyf0214',
          accountType: 'User',
          accountId: 12345,
          avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
          adminId: 1,
        },
      });
    });

    it('管理员不存在时应该记录错误但不创建安装记录', async () => {
      mockPrisma.admin.findFirst.mockResolvedValue(null);

      const payload = {
        action: 'created',
        installation: {
          id: 141528128,
          account: { login: 'Jyf0214', id: 12345, type: 'User', avatar_url: '' },
        },
      };

      const req = createWebhookRequest('installation', payload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockPrisma.gitHubInstallation.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.gitHubInstallation.create).not.toHaveBeenCalled();
    });
  });

  describe('installation 事件 — reopened', () => {
    it('应该在 reopened 事件时激活已存在的安装记录', async () => {
      const mockAdmin = { id: 1, githubId: 12345, githubLogin: 'admin' };
      const existingInstallation = {
        id: 1,
        installationId: 141528128,
        accountLogin: 'Jyf0214',
        isActive: false,
      };

      mockPrisma.admin.findFirst.mockResolvedValue(mockAdmin);
      mockPrisma.gitHubInstallation.findUnique.mockResolvedValue(existingInstallation);
      mockPrisma.gitHubInstallation.update.mockResolvedValue({});

      const payload = {
        action: 'reopened',
        installation: {
          id: 141528128,
          account: { login: 'Jyf0214', id: 12345, type: 'User', avatar_url: '' },
        },
      };

      const req = createWebhookRequest('installation', payload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockPrisma.gitHubInstallation.update).toHaveBeenCalledWith({
        where: { installationId: 141528128 },
        data: { isActive: true, adminId: 1 },
      });
      expect(mockPrisma.gitHubInstallation.create).not.toHaveBeenCalled();
    });
  });

  describe('installation 事件 — deleted', () => {
    it('应该在 deleted 事件时标记为非活跃', async () => {
      mockPrisma.gitHubInstallation.updateMany.mockResolvedValue({ count: 1 });

      const payload = {
        action: 'deleted',
        installation: {
          id: 141528128,
          account: { login: 'Jyf0214', id: 12345, type: 'User', avatar_url: '' },
        },
      };

      const req = createWebhookRequest('installation', payload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockPrisma.gitHubInstallation.updateMany).toHaveBeenCalledWith({
        where: { installationId: 141528128 },
        data: { isActive: false },
      });
    });
  });

  describe('installation 事件 — suspend', () => {
    it('应该在 suspend 事件时标记为非活跃', async () => {
      mockPrisma.gitHubInstallation.updateMany.mockResolvedValue({ count: 1 });

      const payload = {
        action: 'suspend',
        installation: {
          id: 141528128,
          account: { login: 'Jyf0214', id: 12345, type: 'User', avatar_url: '' },
        },
      };

      const req = createWebhookRequest('installation', payload);
      const res = createMockResponse();

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockPrisma.gitHubInstallation.updateMany).toHaveBeenCalled();
    });
  });

  describe('installation payload 结构验证', () => {
    it('应该支持 User 和 Organization 类型', async () => {
      mockPrisma.admin.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.gitHubInstallation.findUnique.mockResolvedValue(null);
      mockPrisma.gitHubInstallation.create.mockResolvedValue({});

      // User 类型
      const userPayload = {
        action: 'created',
        installation: {
          id: 100,
          account: { login: 'user1', id: 100, type: 'User', avatar_url: '' },
        },
      };
      const req1 = createWebhookRequest('installation', userPayload);
      const res1 = createMockResponse();
      await handler(req1, res1);
      expect(res1._getStatusCode()).toBe(200);

      // Organization 类型
      const orgPayload = {
        action: 'created',
        installation: {
          id: 200,
          account: { login: 'org1', id: 200, type: 'Organization', avatar_url: '' },
        },
      };
      const req2 = createWebhookRequest('installation', orgPayload);
      const res2 = createMockResponse();
      await handler(req2, res2);
      expect(res2._getStatusCode()).toBe(200);
    });
  });
});
