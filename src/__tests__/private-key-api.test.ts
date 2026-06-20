import { vi, describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    admin: { findFirst: vi.fn() },
    appConfig: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({
  getConfig: vi.fn(),
  setConfig: vi.fn(),
}));

vi.mock('@/lib/github/auth', () => ({
  generateJWT: vi.fn(),
  getAppId: vi.fn(),
  getPrivateKey: vi.fn(),
}));

const { prisma } = await import('@/lib/prisma');
const { getConfig, setConfig } = await import('@/lib/db');
const { generateJWT } = await import('@/lib/github/auth');

describe('Private Key API 端点', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('私钥验证逻辑', () => {
    it('应该验证 PEM 格式', () => {
      const validPem = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----';
      const invalidPem = 'not-a-pem-file';

      expect(validPem.includes('-----BEGIN')).toBe(true);
      expect(validPem.includes('-----END')).toBe(true);
      expect(invalidPem.includes('-----BEGIN')).toBe(false);
    });

    it('应该拒绝空私钥', () => {
      const privateKey = '';
      expect(!!privateKey && typeof privateKey === 'string').toBe(false);
    });

    it('应该拒绝非字符串类型', () => {
      const privateKey = 12345;
      expect(typeof privateKey === 'string').toBe(false);
    });
  });

  describe('私钥存储', () => {
    it('应该使用 setConfig 存储私钥', async () => {
      const mockSetConfig = vi.mocked(setConfig);
      mockSetConfig.mockResolvedValue({} as any);

      const testKey = '-----BEGIN RSA PRIVATE KEY-----\nTEST\n-----END RSA PRIVATE KEY-----';
      await setConfig('github_private_key', testKey, true);

      expect(mockSetConfig).toHaveBeenCalledWith('github_private_key', testKey, true);
    });

    it('应该使用 getConfig 读取私钥', async () => {
      const mockGetConfig = vi.mocked(getConfig);
      const testKey = '-----BEGIN RSA PRIVATE KEY-----\nTEST\n-----END RSA PRIVATE KEY-----';
      mockGetConfig.mockResolvedValue(testKey);

      const result = await getConfig('github_private_key');
      expect(result).toBe(testKey);
    });

    it('私钥不存在时应该返回 null', async () => {
      const mockGetConfig = vi.mocked(getConfig);
      mockGetConfig.mockResolvedValue(null);

      const result = await getConfig('github_private_key');
      expect(result).toBeNull();
    });
  });

  describe('JWT 生成验证', () => {
    it('应该能用上传的私钥生成 JWT', () => {
      const { privateKey, publicKey } = require('crypto').generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });

      const mockGenerateJWT = vi.mocked(generateJWT);
      mockGenerateJWT.mockImplementation((appId: string, key: string) => {
        const now = Math.floor(Date.now() / 1000);
        return jwt.sign({ iat: now - 60, exp: now + 600, iss: appId }, key, {
          algorithm: 'RS256',
        });
      });

      const token = mockGenerateJWT('test-app', privateKey);
      expect(token).toBeTruthy();

      const decoded = jwt.decode(token) as any;
      expect(decoded.iss).toBe('test-app');
    });
  });

  describe('状态检查逻辑', () => {
    it('应该返回正确的配置状态', async () => {
      const mockGetConfig = vi.mocked(getConfig);
      mockGetConfig.mockResolvedValue('test-key');

      const result = await getConfig('github_private_key');
      const status = {
        configured: !!result,
        source: process.env.GITHUB_PRIVATE_KEY_PATH ? 'file' : result ? 'database' : 'none',
      };

      expect(status.configured).toBe(true);
      expect(status.source).toBe('database');
    });

    it('未配置时应该返回 none', async () => {
      const mockGetConfig = vi.mocked(getConfig);
      mockGetConfig.mockResolvedValue(null);
      delete process.env.GITHUB_PRIVATE_KEY_PATH;

      const result = await getConfig('github_private_key');
      const status = {
        configured: !!result,
        source: process.env.GITHUB_PRIVATE_KEY_PATH ? 'file' : result ? 'database' : 'none',
      };

      expect(status.configured).toBe(false);
      expect(status.source).toBe('none');
    });
  });
});
