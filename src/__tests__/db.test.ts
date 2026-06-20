import { vi, describe, it, expect, beforeEach } from 'vitest';
import { isNewApplication, getAdmin, createAdmin, updateAdminLogin } from '@/lib/db';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ exists: true }]),
    admin: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

describe('数据库操作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isNewApplication', () => {
    it('应该正确检测全新应用', async () => {
      mockPrisma.admin.count.mockResolvedValue(0);
      expect(await isNewApplication()).toBe(true);
      expect(mockPrisma.admin.count).toHaveBeenCalled();
    });

    it('应该正确检测已有管理员的应用', async () => {
      mockPrisma.admin.count.mockResolvedValue(1);
      expect(await isNewApplication()).toBe(false);
    });
  });

  describe('getAdmin', () => {
    it('应该返回存在的管理员', async () => {
      const mockAdmin = { id: 1, githubId: 12345, githubLogin: 'testuser', avatarUrl: 'url' };
      mockPrisma.admin.findUnique.mockResolvedValue(mockAdmin);
      expect(await getAdmin(12345)).toEqual(mockAdmin);
      expect(mockPrisma.admin.findUnique).toHaveBeenCalledWith({ where: { githubId: 12345 } });
    });

    it('应该返回 null 当管理员不存在', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null);
      expect(await getAdmin(99999)).toBeNull();
    });
  });

  describe('createAdmin', () => {
    it('应该正确创建管理员', async () => {
      const mockAdmin = { id: 1, githubId: 12345, githubLogin: 'testuser', avatarUrl: 'url' };
      mockPrisma.admin.create.mockResolvedValue(mockAdmin);
      const result = await createAdmin(12345, 'testuser', 'url');
      expect(result).toEqual(mockAdmin);
      expect(mockPrisma.admin.create).toHaveBeenCalledWith({
        data: { githubId: 12345, githubLogin: 'testuser', avatarUrl: 'url' },
      });
    });
  });

  describe('updateAdminLogin', () => {
    it('应该更新管理员最后登录时间', async () => {
      mockPrisma.admin.update.mockResolvedValue({});
      await updateAdminLogin(12345);
      expect(mockPrisma.admin.update).toHaveBeenCalledWith({
        where: { githubId: 12345 },
        data: { lastLogin: expect.any(Date) },
      });
    });
  });
});
