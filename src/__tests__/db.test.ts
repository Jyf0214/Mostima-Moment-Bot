import { prisma } from '@/lib/prisma';
import { isNewApplication, getAdmin, createAdmin, updateAdminLogin } from '@/lib/db';

// 模拟 Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    admin: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('数据库操作', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isNewApplication', () => {
    it('应该正确检测全新应用', async () => {
      (prisma.admin.count as jest.Mock).mockResolvedValue(0);

      const result = await isNewApplication();

      expect(result).toBe(true);
      expect(prisma.admin.count).toHaveBeenCalled();
    });

    it('应该正确检测已有管理员的应用', async () => {
      (prisma.admin.count as jest.Mock).mockResolvedValue(1);

      const result = await isNewApplication();

      expect(result).toBe(false);
    });
  });

  describe('getAdmin', () => {
    it('应该返回存在的管理员', async () => {
      const mockAdmin = {
        id: 1,
        githubId: 12345,
        githubLogin: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
      };
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(mockAdmin);

      const result = await getAdmin(12345);

      expect(result).toEqual(mockAdmin);
      expect(prisma.admin.findUnique).toHaveBeenCalledWith({
        where: { githubId: 12345 },
      });
    });

    it('应该返回 null 当管理员不存在', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getAdmin(99999);

      expect(result).toBeNull();
    });
  });

  describe('createAdmin', () => {
    it('应该正确创建管理员', async () => {
      const mockAdmin = {
        id: 1,
        githubId: 12345,
        githubLogin: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: new Date(),
        lastLogin: new Date(),
      };
      (prisma.admin.create as jest.Mock).mockResolvedValue(mockAdmin);

      const result = await createAdmin(12345, 'testuser', 'https://example.com/avatar.jpg');

      expect(result).toEqual(mockAdmin);
      expect(prisma.admin.create).toHaveBeenCalledWith({
        data: {
          githubId: 12345,
          githubLogin: 'testuser',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });
    });
  });

  describe('updateAdminLogin', () => {
    it('应该更新管理员最后登录时间', async () => {
      (prisma.admin.update as jest.Mock).mockResolvedValue({});

      await updateAdminLogin(12345);

      expect(prisma.admin.update).toHaveBeenCalledWith({
        where: { githubId: 12345 },
        data: { lastLogin: expect.any(Date) },
      });
    });
  });
});
