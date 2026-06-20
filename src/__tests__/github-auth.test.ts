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
  getDecryptedWebhookConfig: vi.fn(),
  getConfig: vi.fn(),
}));

const mockFs = vi.mocked(fs);
const { getDecryptedWebhookConfig, getConfig } = await import('@/lib/db');
const mockGetDecryptedWebhookConfig = vi.mocked(getDecryptedWebhookConfig);
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

    it('AppConfig 不存在时应该从 WebhookConfig 读取', async () => {
      delete process.env.GITHUB_APP_ID;
      mockGetConfig.mockResolvedValueOnce(null);
      mockGetDecryptedWebhookConfig.mockResolvedValueOnce({
        appId: '11111',
        privateKey: 'key',
        webhookSecret: 'secret',
        repoOwner: 'owner',
        repoName: 'repo',
        isActive: true,
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        webhookSecretEncrypted: '',
        privateKeyEncrypted: '',
      });
      const result = await getAppId();
      expect(result).toBe('11111');
    });

    it('所有来源都没有时应该抛出错误', async () => {
      delete process.env.GITHUB_APP_ID;
      mockGetConfig.mockResolvedValueOnce(null);
      mockGetDecryptedWebhookConfig.mockResolvedValueOnce(null);
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

    it('AppConfig 不存在时应该从 WebhookConfig 读取', async () => {
      process.env.GITHUB_PRIVATE_KEY_PATH = '/nonexistent/path.pem';
      mockFs.readFileSync.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      mockGetConfig.mockResolvedValueOnce(null);
      mockGetDecryptedWebhookConfig.mockResolvedValueOnce({
        appId: '12345',
        privateKey: 'webhook-private-key',
        webhookSecret: 'secret',
        repoOwner: 'owner',
        repoName: 'repo',
        isActive: true,
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        webhookSecretEncrypted: '',
        privateKeyEncrypted: '',
      });
      const result = await getPrivateKey();
      expect(result).toBe('webhook-private-key');
    });

    it('所有来源都没有时应该抛出错误', async () => {
      process.env.GITHUB_PRIVATE_KEY_PATH = '/nonexistent/path.pem';
      mockFs.readFileSync.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      mockGetConfig.mockResolvedValueOnce(null);
      mockGetDecryptedWebhookConfig.mockResolvedValueOnce(null);
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
      // 注意：这里使用真实的 RSA 密钥对来测试
      const { privateKey, publicKey } = require('crypto').generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });

      const appId = 'test-app-id';
      const token = generateJWT(appId, privateKey);

      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);

      // 验证 JWT 结构
      const decoded = jwt.decode(token) as any;
      expect(decoded.iss).toBe(appId);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp - decoded.iat).toBe(660); // iat = now-60, exp = now+600, 差值 660
    });

    it('应该拒绝使用错误私钥验证的 JWT', () => {
      const { privateKey: wrongKey } = require('crypto').generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });

      const { privateKey: correctKey, publicKey } = require('crypto').generateKeyPairSync('rsa', {
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

      const decoded = jwt.decode(token) as any;
      // iat 应该在 before-60 和 after-60 之间
      expect(decoded.iat).toBeGreaterThanOrEqual(before - 61);
      expect(decoded.iat).toBeLessThanOrEqual(after - 59);
      // exp 应该比 iat 多 660 秒（iat=now-60, exp=now+600）
      expect(decoded.exp - decoded.iat).toBe(660);
    });
  });
});
