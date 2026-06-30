import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { generateJWT, getAppId, getPrivateKey } from '@/lib/github/auth';

// Mock fs
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

// Mock db
vi.mock('@/lib/db', () => ({
  getConfig: vi.fn(),
}));

const mockFs = vi.mocked(fs);
const { getConfig } = await import('@/lib/db');
const mockGetConfig = vi.mocked(getConfig);

// 测试用私钥（RSA 2048）
const TEST_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy5AH763BhOGJt9Jz8K
-----END RSA PRIVATE KEY-----`;

describe('GitHub Auth 模块', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_PRIVATE_KEY_PATH;
  });

  describe('getAppId', () => {
    it('应该优先从环境变量读取 App ID', async () => {
      process.env.GITHUB_APP_ID = '12345';
      const result = await getAppId();
      expect(result).toBe('12345');
    });

    it('环境变量不存在时应该从 AppConfig 读取', async () => {
      delete process.env.GITHUB_APP_ID;
      mockGetConfig.mockResolvedValueOnce('67890');
      const result = await getAppId();
      expect(result).toBe('67890');
      expect(mockGetConfig).toHaveBeenCalledWith('github_app_id');
    });

    it('所有来源都没有时应该抛出错误', async () => {
      delete process.env.GITHUB_APP_ID;
      mockGetConfig.mockResolvedValueOnce(null);
      await expect(getAppId()).rejects.toThrow('GITHUB_APP_ID not configured');
    });
  });

  describe('getPrivateKey', () => {
    it('应该优先从文件读取私钥', async () => {
      process.env.GITHUB_PRIVATE_KEY_PATH = '/path/to/key.pem';
      mockFs.readFileSync.mockReturnValueOnce(TEST_PRIVATE_KEY);
      const result = await getPrivateKey();
      expect(result).toBe(TEST_PRIVATE_KEY);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/key.pem', 'utf8');
    });

    it('文件读取失败时应该从 AppConfig 读取', async () => {
      process.env.GITHUB_PRIVATE_KEY_PATH = '/nonexistent/path.pem';
      mockFs.readFileSync.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      mockGetConfig.mockResolvedValueOnce('db-private-key');
      const result = await getPrivateKey();
      expect(result).toBe('db-private-key');
    });

    it('所有来源都没有时应该抛出错误', async () => {
      process.env.GITHUB_PRIVATE_KEY_PATH = '/nonexistent/path.pem';
      mockFs.readFileSync.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      mockGetConfig.mockResolvedValueOnce(null);
      await expect(getPrivateKey()).rejects.toThrow('private key not configured');
    });

    it('GITHUB_PRIVATE_KEY_PATH 未设置时应该跳过文件读取', async () => {
      delete process.env.GITHUB_PRIVATE_KEY_PATH;
      mockGetConfig.mockResolvedValueOnce('db-key');
      const result = await getPrivateKey();
      expect(result).toBe('db-key');
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });
  });

  describe('generateJWT', () => {
    it('应该使用私钥字符串生成有效的 JWT', () => {
      const { privateKey } = require('crypto').generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });

      const appId = 'test-app-id';
      const token = generateJWT(appId, privateKey);

      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);

      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.iss).toBe(appId);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect((decoded.exp as number) - (decoded.iat as number)).toBe(660);
    });

    it('应该拒绝使用错误私钥验证的 JWT', () => {
      const { privateKey: wrongKey } = require('crypto').generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });

      const { publicKey } = require('crypto').generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });

      const token = generateJWT('app-id', wrongKey);

      expect(() => jwt.verify(token, publicKey)).toThrow('invalid signature');
    });

    it('应该正确设置签发时间和过期时间', () => {
      const { privateKey } = require('crypto').generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });

      const before = Math.floor(Date.now() / 1000);
      const token = generateJWT('app-id', privateKey);
      const after = Math.floor(Date.now() / 1000);

      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.iat).toBeGreaterThanOrEqual(before - 61);
      expect(decoded.iat).toBeLessThanOrEqual(after - 59);
      expect((decoded.exp as number) - (decoded.iat as number)).toBe(660);
    });
  });
});
