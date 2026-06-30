import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from './helpers';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    appConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import handler from '@/pages/api/qwen-settings';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-utils';

describe('/api/qwen-settings', () => {
  const mockAdmin = { githubId: 123, githubLogin: 'testuser' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin as any);
  });

  describe('GET', () => {
    it('should return configured status when config exists', async () => {
      vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
        configKey: 'qwen_settings',
        configValue: '{"model": "qwen-plus"}',
      } as any);

      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.configured).toBe(true);
      expect(data.hasContent).toBe(true);
    });

    it('should return not configured when config is empty', async () => {
      vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null);

      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.configured).toBe(false);
      expect(data.hasContent).toBe(false);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(prisma.appConfig.findUnique).mockRejectedValue(new Error('DB error'));

      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();
      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
    });
  });

  describe('PUT', () => {
    it('should save valid JSON settings', async () => {
      vi.mocked(prisma.appConfig.upsert).mockResolvedValue({} as any);

      const req = createMockReq({
        method: 'PUT',
        body: { settings: '{"model": "qwen-plus", "apiKey": "sk-xxx"}' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(prisma.appConfig.upsert).toHaveBeenCalledWith({
        where: { configKey: 'qwen_settings' },
        update: { configValue: '{"model": "qwen-plus", "apiKey": "sk-xxx"}' },
        create: {
          configKey: 'qwen_settings',
          configValue: '{"model": "qwen-plus", "apiKey": "sk-xxx"}',
        },
      });
    });

    it('should clear settings when empty string provided', async () => {
      vi.mocked(prisma.appConfig.upsert).mockResolvedValue({} as any);

      const req = createMockReq({
        method: 'PUT',
        body: { settings: '' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(prisma.appConfig.upsert).toHaveBeenCalledWith({
        where: { configKey: 'qwen_settings' },
        update: { configValue: '' },
        create: { configKey: 'qwen_settings', configValue: '' },
      });
    });

    it('should reject invalid JSON format', async () => {
      const req = createMockReq({
        method: 'PUT',
        body: { settings: '{invalid json}' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Invalid JSON format');
    });

    it('should return 400 when settings field is missing', async () => {
      const req = createMockReq({
        method: 'PUT',
        body: {},
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Missing settings field');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(prisma.appConfig.upsert).mockRejectedValue(new Error('DB error'));

      const req = createMockReq({
        method: 'PUT',
        body: { settings: '{"model": "qwen-plus"}' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
    });
  });

  describe('authentication', () => {
    it('should require admin authentication', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(null as any);

      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();
      await handler(req, res);

      // requireAdmin returns null, so response is already sent
      expect(requireAdmin).toHaveBeenCalled();
    });

    it('should return 405 for unsupported methods', async () => {
      const req = createMockReq({ method: 'DELETE' });
      const res = createMockRes();
      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
    });
  });
});
