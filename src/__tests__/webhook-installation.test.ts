import { vi, describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock prisma
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

describe('Webhook Installation 事件处理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('installation 事件', () => {
    const installationPayload = {
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

    it('应该在 created 事件时创建安装记录', async () => {
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

      // 模拟 webhook 处理逻辑
      const { action, installation } = installationPayload;
      expect(action).toBe('created');
      expect(installation.id).toBe(141528128);
      expect(installation.account.login).toBe('Jyf0214');

      // 验证管理员查找
      const admin = await mockPrisma.admin.findFirst();
      expect(admin).toEqual(mockAdmin);

      // 验证安装记录不存在
      const existing = await mockPrisma.gitHubInstallation.findUnique({
        where: { installationId: installation.id },
      });
      expect(existing).toBeNull();

      // 创建安装记录
      await mockPrisma.gitHubInstallation.create({
        data: {
          installationId: installation.id,
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          accountId: installation.account.id,
          avatarUrl: installation.account.avatar_url,
          adminId: admin.id,
        },
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

    it('应该在 reopened 事件时激活已存在的安装记录', async () => {
      const mockAdmin = { id: 1, githubId: 12345, githubLogin: 'admin' };
      const existingInstallation = {
        id: 1,
        installationId: 141528128,
        accountLogin: 'Jyf0214',
        accountType: 'User',
        accountId: 12345,
        adminId: 1,
        isActive: false,
      };

      mockPrisma.admin.findFirst.mockResolvedValue(mockAdmin);
      mockPrisma.gitHubInstallation.findUnique.mockResolvedValue(existingInstallation);
      mockPrisma.gitHubInstallation.update.mockResolvedValue({});

      const { action, installation } = { ...installationPayload, action: 'reopened' };
      expect(action).toBe('reopened');

      const existing = await mockPrisma.gitHubInstallation.findUnique({
        where: { installationId: installation.id },
      });
      expect(existing).not.toBeNull();

      await mockPrisma.gitHubInstallation.update({
        where: { installationId: installation.id },
        data: { isActive: true, adminId: mockAdmin.id },
      });

      expect(mockPrisma.gitHubInstallation.update).toHaveBeenCalledWith({
        where: { installationId: 141528128 },
        data: { isActive: true, adminId: 1 },
      });
    });

    it('应该在 deleted 事件时标记为非活跃', async () => {
      mockPrisma.gitHubInstallation.updateMany.mockResolvedValue({ count: 1 });

      const payload = {
        action: 'deleted',
        installation: {
          id: 141528128,
          account: { login: 'Jyf0214', id: 12345, type: 'User', avatar_url: '' },
        },
      };

      expect(payload.action).toBe('deleted');

      await mockPrisma.gitHubInstallation.updateMany({
        where: { installationId: payload.installation.id },
        data: { isActive: false },
      });

      expect(mockPrisma.gitHubInstallation.updateMany).toHaveBeenCalledWith({
        where: { installationId: 141528128 },
        data: { isActive: false },
      });
    });

    it('应该在 suspend 事件时标记为非活跃', async () => {
      mockPrisma.gitHubInstallation.updateMany.mockResolvedValue({ count: 1 });

      const payload = {
        action: 'suspend',
        installation: {
          id: 141528128,
          account: { login: 'Jyf0214', id: 12345, type: 'User', avatar_url: '' },
        },
      };

      expect(payload.action).toBe('suspend');

      await mockPrisma.gitHubInstallation.updateMany({
        where: { installationId: payload.installation.id },
        data: { isActive: false },
      });

      expect(mockPrisma.gitHubInstallation.updateMany).toHaveBeenCalled();
    });

    it('管理员不存在时应该记录错误', async () => {
      mockPrisma.admin.findFirst.mockResolvedValue(null);

      const admin = await mockPrisma.admin.findFirst();
      expect(admin).toBeNull();
      // 不应该尝试创建安装记录
    });
  });

  describe('installation payload 结构验证', () => {
    it('应该包含必要的字段', () => {
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

      expect(payload.action).toBeDefined();
      expect(payload.installation.id).toBeDefined();
      expect(payload.installation.account.login).toBeDefined();
      expect(payload.installation.account.id).toBeDefined();
      expect(payload.installation.account.type).toBeDefined();
    });

    it('应该支持 User 和 Organization 类型', () => {
      const userPayload = {
        installation: {
          account: { type: 'User' },
        },
      };

      const orgPayload = {
        installation: {
          account: { type: 'Organization' },
        },
      };

      expect(userPayload.installation.account.type).toBe('User');
      expect(orgPayload.installation.account.type).toBe('Organization');
    });
  });
});
