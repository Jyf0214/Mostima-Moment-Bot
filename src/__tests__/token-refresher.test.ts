import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock 依赖
vi.mock('@/lib/github/auth', () => ({
  generateJWTAuto: vi.fn().mockResolvedValue('mock-jwt-token'),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    gitHubInstallation: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Token Refresher', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // 清理环境变量
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    // 重置 token 缓存
    const { resetTokenCache } = await import('@/lib/ci/token-refresher');
    resetTokenCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startTokenRefresher', () => {
    it('应该在启动时立即刷新 token', async () => {
      const { startTokenRefresher, stopTokenRefresher } = await import('@/lib/ci/token-refresher');
      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // 模拟数据库返回有效的 installation
      (
        mockPrisma.gitHubInstallation.findFirst as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        installationId: 12345678,
        isActive: true,
        createdAt: new Date(),
      });

      // 模拟 GitHub API 响应
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: 'ghs_test_token_123',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          }),
      });

      startTokenRefresher();

      // 等待异步操作完成
      await vi.advanceTimersByTimeAsync(100);

      // 验证环境变量已设置
      expect(process.env.GITHUB_TOKEN).toBe('ghs_test_token_123');
      expect(process.env.GH_TOKEN).toBe('ghs_test_token_123');

      // 验证调用了数据库查询
      expect(mockPrisma.gitHubInstallation.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      // 验证调用了 GitHub API
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/12345678/access_tokens',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
        })
      );

      stopTokenRefresher();
    });

    it('没有 active installation 时应该记录警告', async () => {
      const { startTokenRefresher, stopTokenRefresher } = await import('@/lib/ci/token-refresher');
      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // 模拟数据库返回空
      (
        mockPrisma.gitHubInstallation.findFirst as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      startTokenRefresher();

      // 等待异步操作完成
      await vi.advanceTimersByTimeAsync(100);

      // 验证环境变量未设置
      expect(process.env.GITHUB_TOKEN).toBeUndefined();
      expect(process.env.GH_TOKEN).toBeUndefined();

      stopTokenRefresher();
    });

    it('GitHub API 失败时应该记录错误', async () => {
      const { startTokenRefresher, stopTokenRefresher } = await import('@/lib/ci/token-refresher');
      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // 模拟数据库返回有效的 installation
      (
        mockPrisma.gitHubInstallation.findFirst as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        installationId: 12345678,
        isActive: true,
        createdAt: new Date(),
      });

      // 模拟 GitHub API 失败
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
      });

      startTokenRefresher();

      // 等待异步操作完成
      await vi.advanceTimersByTimeAsync(100);

      // 验证环境变量未设置
      expect(process.env.GITHUB_TOKEN).toBeUndefined();
      expect(process.env.GH_TOKEN).toBeUndefined();

      stopTokenRefresher();
    });
  });

  describe('stopTokenRefresher', () => {
    it('应该停止定时刷新', async () => {
      const { startTokenRefresher, stopTokenRefresher } = await import('@/lib/ci/token-refresher');
      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // 模拟数据库返回有效的 installation
      (
        mockPrisma.gitHubInstallation.findFirst as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        installationId: 12345678,
        isActive: true,
        createdAt: new Date(),
      });

      // 模拟 GitHub API 响应
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: 'ghs_test_token_456',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          }),
      });

      startTokenRefresher();

      // 等待初始刷新完成
      await vi.advanceTimersByTimeAsync(100);

      // 清除 fetch 调用记录
      vi.mocked(global.fetch).mockClear();

      // 停止刷新
      stopTokenRefresher();

      // 等待 30 分钟
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      // 验证没有再次调用 API
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('token 缓存', () => {
    it('应该缓存 token 避免重复请求', async () => {
      const { startTokenRefresher, stopTokenRefresher } = await import('@/lib/ci/token-refresher');
      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // 模拟数据库返回有效的 installation
      (
        mockPrisma.gitHubInstallation.findFirst as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        installationId: 12345678,
        isActive: true,
        createdAt: new Date(),
      });

      // 模拟 GitHub API 响应
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: 'ghs_cached_token',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          }),
      });

      startTokenRefresher();

      // 等待第一次刷新完成
      await vi.advanceTimersByTimeAsync(100);

      // 清除 fetch 调用记录
      vi.mocked(global.fetch).mockClear();

      // 等待 5 分钟（不到 30 分钟刷新间隔）
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // 验证没有再次调用 API（使用缓存）
      expect(global.fetch).not.toHaveBeenCalled();

      stopTokenRefresher();
    });
  });
});
