import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 依赖
vi.mock('@/lib/github/auth', () => ({
  fetchBotSlug: vi.fn().mockResolvedValue('test-bot-slug'),
}));

vi.mock('@/lib/ci/token-refresher', () => ({
  startTokenRefresher: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('应该调用 fetchBotSlug 预热缓存', async () => {
      const { register } = await import('@/instrumentation');
      const { fetchBotSlug } = await import('@/lib/github/auth');
      const { logger } = await import('@/lib/logger');

      await register();

      expect(fetchBotSlug).toHaveBeenCalledOnce();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Bot slug preloaded: test-bot-slug')
      );
    });

    it('应该调用 startTokenRefresher 启动定时刷新', async () => {
      const { register } = await import('@/instrumentation');
      const { startTokenRefresher } = await import('@/lib/ci/token-refresher');

      await register();

      expect(startTokenRefresher).toHaveBeenCalledOnce();
    });

    it('fetchBotSlug 失败时应该静默跳过', async () => {
      const { register } = await import('@/instrumentation');
      const { fetchBotSlug } = await import('@/lib/github/auth');

      // 模拟 fetchBotSlug 失败
      vi.mocked(fetchBotSlug).mockRejectedValueOnce(new Error('Network error'));

      // 不应该抛出错误
      await expect(register()).resolves.toBeUndefined();
    });
  });
});
